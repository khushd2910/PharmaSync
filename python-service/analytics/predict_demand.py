"""
predict_demand.py — Serving/Inference pipeline for PharmaSync's Demand Forecasting.

Separates serving from training:
- Loads the persisted RandomForest models from python-service/models/ via model_registry.
- Evaluates active medicine stock and recent sales history.
- Runs 7-day multi-step autoregressive forecasting for each medicine.
- Persists forecast outputs to MongoDB collection 'demand_forecasts'.
"""

import os
import sys
import numpy as np
import pandas as pd
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv
from pymongo import MongoClient

sys.path.insert(0, os.path.dirname(__file__))
from model_registry import load_model, is_stale
from train_demand_model import train_demand_models, load_sales_df
from ml_config import (
    DEMAND_LOOKBACK_DAYS as LOOKBACK_DAYS,
    DEMAND_MODEL_NAME as MODEL_NAME,
    DEMAND_MAX_MODEL_AGE_HOURS as MAX_MODEL_AGE_HOURS,
    DEMAND_MIN_HISTORICAL_SALES,
    DEMAND_MIN_FEATURE_ROWS,
)
from snapshot_retention import ensure_snapshot_index, prune_old_snapshots

RESULT_COLLECTION = 'demand_forecasts'



def get_db():
    mongo_uri = os.getenv('MONGO_URI')
    if not mongo_uri:
        sys.exit('MONGO_URI is not set.')
    client = MongoClient(mongo_uri)
    return client.get_default_database()


def generate_forecast(db=None, lookback_days=LOOKBACK_DAYS):
    if db is None:
        db = get_db()

    now = datetime.now(timezone.utc)
    since = now - timedelta(days=lookback_days)

    cursor = db.medicines.find({'isDiscontinued': {'$ne': True}}, {'name': 1, 'stock': 1})
    medicines = {str(m['_id']): {'name': m['name'], 'stock': int(m.get('stock', 0))} for m in cursor}

    sales_df = load_sales_df(db, since)
    date_index = pd.date_range(start=since.date(), end=now.date(), freq='D')

    # Load saved model or trigger training if no model exists or model is stale
    saved_models, saved_meta = load_model(MODEL_NAME)
    if saved_models is None or is_stale(saved_meta, MAX_MODEL_AGE_HOURS):
        print("[predict_demand] No active model found or model is stale. Triggering model training...")
        train_demand_models(db, lookback_days=lookback_days)
        saved_models, saved_meta = load_model(MODEL_NAME)
        saved_models = saved_models or {}

    predictions = []

    for med_id, med_info in medicines.items():
        name = med_info['name']
        current_stock = med_info['stock']

        med_sales = sales_df[sales_df['medicineId'] == med_id] if not sales_df.empty else pd.DataFrame()

        if med_sales.empty:
            weekly_demand = 0.0
        else:
            daily_series = med_sales.groupby(med_sales['date'].dt.date)['quantity'].sum().reindex(date_index.date, fill_value=0.0)
            total_sold = daily_series.sum()

            if total_sold < 5:
                weekly_demand = float((total_sold / lookback_days) * 7)
            else:
                try:
                    df_med = pd.DataFrame({'sales': daily_series.values}, index=daily_series.index)
                    df_med['day_of_week'] = pd.to_datetime(df_med.index).dayofweek
                    df_med['day_of_month'] = pd.to_datetime(df_med.index).day
                    df_med['lag_1'] = df_med['sales'].shift(1)
                    df_med['lag_2'] = df_med['sales'].shift(2)
                    df_med['lag_7'] = df_med['sales'].shift(7)
                    df_med['rolling_mean_7'] = df_med['sales'].shift(1).rolling(window=7).mean()
                    df_med = df_med.dropna()

                    model = saved_models.get(med_id)

                    if model is None or len(df_med) < 10:
                        weekly_demand = float((total_sold / lookback_days) * 7)
                    else:
                        history = list(df_med['sales'].values)
                        forecast_dates = pd.date_range(start=now.date() + timedelta(days=1), periods=7, freq='D')

                        forecasted_sales = []
                        for f_date in forecast_dates:
                            lag1 = history[-1]
                            lag2 = history[-2]
                            lag7 = history[-7]
                            roll7 = float(np.mean(history[-7:]))

                            feat = pd.DataFrame([{
                                'day_of_week': f_date.dayofweek,
                                'day_of_month': f_date.day,
                                'lag_1': lag1,
                                'lag_2': lag2,
                                'lag_7': lag7,
                                'rolling_mean_7': roll7
                            }])

                            pred = float(model.predict(feat)[0])
                            pred = max(0.0, pred)
                            forecasted_sales.append(pred)
                            history.append(pred)

                        weekly_demand = sum(forecasted_sales)
                except Exception as e:
                    weekly_demand = float((total_sold / lookback_days) * 7)

        weekly_demand = round(weekly_demand, 2)
        restock_suggested = weekly_demand > current_stock
        suggested_qty = int(np.ceil(weekly_demand - current_stock)) if restock_suggested else 0

        predictions.append({
            'medicineId': med_id,
            'name': name,
            'currentStock': current_stock,
            'predictedWeeklyDemand': weekly_demand,
            'suggestedRestockQty': suggested_qty,
            'restockSuggested': restock_suggested
        })

    predictions.sort(key=lambda x: (not x['restockSuggested'], -x['predictedWeeklyDemand']))

    result = {
        'generatedAt': datetime.now(timezone.utc),
        'modelVersion': saved_meta.get('version') if saved_meta else None,
        'modelTrainedAt': saved_meta.get('trained_at') if saved_meta else None,
        'featureImportances': saved_meta.get('feature_importances') if saved_meta else {},
        'predictions': predictions
    }

    collection = db[RESULT_COLLECTION]
    ensure_snapshot_index(collection)
    collection.insert_one(result)
    prune_old_snapshots(collection)
    return result


if __name__ == '__main__':
    res = generate_forecast()
    print(f"[predict_demand] Forecast served using model version '{res.get('modelVersion')}' at {res['generatedAt'].isoformat()}. "
          f"Generated predictions for {len(res['predictions'])} medicines.")
    if res.get('featureImportances'):
        print("[predict_demand] Model Feature Importances:", res['featureImportances'])

