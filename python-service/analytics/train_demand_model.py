"""
train_demand_model.py — Training pipeline for PharmaSync's Demand Forecasting ML models.

Separates training from serving:
- Fits per-medicine RandomForestRegressor models over historical sales data.
- Persists trained model objects + versioned metadata to python-service/models/ via model_registry.
- Designed to run on a weekly/monthly cron schedule or on-demand when retraining is needed.
"""

import os
import sys
from datetime import datetime, timedelta, timezone
import numpy as np
import pandas as pd
from dotenv import load_dotenv
from pymongo import MongoClient


sys.path.insert(0, os.path.dirname(__file__))
from model_registry import save_model
from ml_config import (
    DEMAND_LOOKBACK_DAYS as LOOKBACK_DAYS,
    DEMAND_MODEL_NAME as MODEL_NAME,
    DEMAND_RF_N_ESTIMATORS,
    DEMAND_RF_MAX_DEPTH,
    DEMAND_MIN_HISTORICAL_SALES,
    DEMAND_MIN_FEATURE_ROWS,
)

try:
    from sklearn.ensemble import RandomForestRegressor
except ImportError:
    RandomForestRegressor = None

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '..', '.env'))




def get_db():
    mongo_uri = os.getenv('MONGO_URI')
    if not mongo_uri:
        sys.exit('MONGO_URI is not set.')
    client = MongoClient(mongo_uri)
    return client.get_default_database()


def load_sales_df(db, since):
    """
    Load POS sales and online orders and flatten them.
    """
    online_rows = list(db.orders.aggregate([
        {'$match': {'orderStatus': {'$ne': 'Cancelled'}, 'createdAt': {'$gte': since}}},
        {'$unwind': '$items'},
        {'$project': {
            '_id': 0,
            'date': '$createdAt',
            'medicineId': '$items.medicine',
            'name': '$items.name',
            'quantity': '$items.quantity',
        }},
    ]))
    pos_rows = list(db.possales.aggregate([
        {'$match': {'status': {'$ne': 'Refunded'}, 'createdAt': {'$gte': since}}},
        {'$unwind': '$items'},
        {'$project': {
            '_id': 0,
            'date': '$createdAt',
            'medicineId': '$items.medicine',
            'name': '$items.name',
            'quantity': '$items.quantity',
        }},
    ]))

    rows = online_rows + pos_rows
    if not rows:
        return pd.DataFrame(columns=['date', 'medicineId', 'name', 'quantity'])

    df = pd.DataFrame(rows)
    df['medicineId'] = df['medicineId'].astype(str)
    df['name'] = df['name'].fillna('').astype(str).str.strip()
    df['date'] = pd.to_datetime(df['date'], utc=True).dt.tz_localize(None)
    df['quantity'] = pd.to_numeric(df['quantity'], errors='coerce').fillna(0)

    name_to_id = {}
    for med in db.medicines.find({}, {'_id': 1, 'name': 1}):
        name = med.get('name')
        if name:
            name_to_id[name.strip().lower()] = str(med['_id'])

    df['name_lower'] = df['name'].str.lower()
    df['mappedMedicineId'] = df['name_lower'].map(name_to_id)
    df['medicineId'] = df['mappedMedicineId'].fillna(df['medicineId'])
    df = df.drop(columns=['name_lower', 'mappedMedicineId'])
    return df


def train_demand_models(db=None, lookback_days=LOOKBACK_DAYS):
    """
    Fits RandomForest models for all active medicines with historical sales and
    persists them as a versioned model artifact using model_registry.save_model().
    """
    if RandomForestRegressor is None:
        raise RuntimeError("scikit-learn is required to train demand forecasting models.")

    if db is None:
        db = get_db()

    now = datetime.now(timezone.utc)
    since = now - timedelta(days=lookback_days)

    cursor = db.medicines.find({'isDiscontinued': {'$ne': True}}, {'name': 1, 'stock': 1})
    medicines = {str(m['_id']): {'name': m['name'], 'stock': int(m.get('stock', 0))} for m in cursor}

    sales_df = load_sales_df(db, since)
    date_index = pd.date_range(start=since.date(), end=now.date(), freq='D')

    feature_names = ['day_of_week', 'day_of_month', 'lag_1', 'lag_2', 'lag_7', 'rolling_mean_7']
    trained_models = {}
    all_importances = []
    skipped_count = 0

    for med_id in medicines.keys():
        med_sales = sales_df[sales_df['medicineId'] == med_id] if not sales_df.empty else pd.DataFrame()

        if med_sales.empty:
            skipped_count += 1
            continue

        daily_series = med_sales.groupby(med_sales['date'].dt.date)['quantity'].sum().reindex(date_index.date, fill_value=0.0)
        total_sold = daily_series.sum()

        if total_sold < DEMAND_MIN_HISTORICAL_SALES:
            skipped_count += 1
            continue

        df_med = pd.DataFrame({'sales': daily_series.values}, index=daily_series.index)
        df_med['day_of_week'] = pd.to_datetime(df_med.index).dayofweek
        df_med['day_of_month'] = pd.to_datetime(df_med.index).day
        df_med['lag_1'] = df_med['sales'].shift(1)
        df_med['lag_2'] = df_med['sales'].shift(2)
        df_med['lag_7'] = df_med['sales'].shift(7)
        df_med['rolling_mean_7'] = df_med['sales'].shift(1).rolling(window=7).mean()
        df_med = df_med.dropna()

        if len(df_med) < DEMAND_MIN_FEATURE_ROWS:
            skipped_count += 1
            continue

        X = df_med[feature_names]
        y = df_med['sales']

        rf_model = RandomForestRegressor(
            n_estimators=DEMAND_RF_N_ESTIMATORS,
            max_depth=DEMAND_RF_MAX_DEPTH,
            random_state=42
        )
        rf_model.fit(X, y)
        trained_models[med_id] = rf_model

        all_importances.append(rf_model.feature_importances_)

    avg_importances = {}
    if all_importances:
        mean_vals = np.mean(all_importances, axis=0)
        avg_importances = {fn: float(round(val, 4)) for fn, val in zip(feature_names, mean_vals)}

    meta = save_model(MODEL_NAME, trained_models, {
        'medicines_trained': len(trained_models),
        'medicines_skipped_baseline': skipped_count,
        'total_active_medicines': len(medicines),
        'lookback_days': lookback_days,
        'feature_importances': avg_importances,
    })

    return meta


if __name__ == '__main__':
    print("[train_demand_model] Starting demand model training...")
    meta_info = train_demand_models()
    print(f"[train_demand_model] Training complete. Version: {meta_info.get('version')}, "
          f"Trained: {meta_info.get('medicines_trained')} models. "
          f"Saved artifact: {meta_info.get('artifact_file')}")
    if meta_info.get('feature_importances'):
        print("[train_demand_model] Global Feature Importances:")
        for feat, imp in meta_info['feature_importances'].items():
            print(f"  - {feat}: {imp * 100:.1f}%")

