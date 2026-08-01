"""
train_revenue_model.py — Training pipeline for PharmaSync's Revenue Forecasting model.

Separates training from serving:
- Fits Holt-Winters Exponential Smoothing or Linear Regression model over 180 days of transaction data.
- Persists trained model object + versioned metadata to python-service/models/ via model_registry.
"""

import os
import sys
import pandas as pd
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv
from pymongo import MongoClient

sys.path.insert(0, os.path.dirname(__file__))
from model_registry import save_model
from ml_config import (
    REVENUE_LOOKBACK_DAYS as LOOKBACK_DAYS,
    REVENUE_MODEL_NAME as MODEL_NAME,
    REVENUE_SEASONAL_PERIODS,
    REVENUE_MIN_DAYS_HOLT_WINTERS,
)



def get_db():
    mongo_uri = os.getenv('MONGO_URI')
    if not mongo_uri:
        sys.exit('MONGO_URI is not set.')
    client = MongoClient(mongo_uri)
    return client.get_default_database()


def load_transactions_df(db, since):
    """
    Load daily total amounts from online orders and POS sales.
    """
    online_rows = list(db.orders.aggregate([
        {'$match': {'orderStatus': {'$ne': 'Cancelled'}, 'createdAt': {'$gte': since}}},
        {'$project': {
            '_id': 0,
            'date': '$createdAt',
            'amount': '$totalAmount',
        }},
    ]))
    pos_rows = list(db.possales.aggregate([
        {'$match': {'status': {'$ne': 'Refunded'}, 'createdAt': {'$gte': since}}},
        {'$project': {
            '_id': 0,
            'date': '$createdAt',
            'amount': '$totalAmount',
        }},
    ]))

    rows = online_rows + pos_rows
    if not rows:
        return pd.DataFrame(columns=['date', 'amount'])

    df = pd.DataFrame(rows)
    df['date'] = pd.to_datetime(df['date'], utc=True).dt.tz_localize(None)
    df['amount'] = pd.to_numeric(df['amount'], errors='coerce').fillna(0.0)
    return df


def train_revenue_model(db=None, lookback_days=LOOKBACK_DAYS):
    """
    Fits and saves Holt-Winters or Linear Regression model for revenue forecasting.
    """
    if db is None:
        db = get_db()

    now = datetime.now(timezone.utc)
    since = now - timedelta(days=lookback_days)

    df = load_transactions_df(db, since)
    date_index = pd.date_range(end=now.date(), periods=lookback_days, freq='D')

    if df.empty:
        daily_series = pd.Series(0.0, index=date_index)
    else:
        daily_series = df.groupby(df['date'].dt.date)['amount'].sum().reindex(date_index.date, fill_value=0.0)

    model_type = "Baseline (Mean)"
    model_to_persist = None
    feature_importances = {}

    # Try statsmodels Holt-Winters Exponential Smoothing
    try:
        from statsmodels.tsa.holtwinters import ExponentialSmoothing
        if len(daily_series) >= REVENUE_MIN_DAYS_HOLT_WINTERS and daily_series.sum() > 0:
            data_to_fit = daily_series.values + 1e-4
            model = ExponentialSmoothing(data_to_fit, trend='add', seasonal='add', seasonal_periods=REVENUE_SEASONAL_PERIODS)
            fitted = model.fit(optimized=True)

            model_type = "Holt-Winters Exponential Smoothing"
            model_to_persist = fitted
            feature_importances = {
                'smoothing_level_alpha': float(round(fitted.params.get('smoothing_level', 0.0), 4)),
                'smoothing_trend_beta': float(round(fitted.params.get('smoothing_trend', 0.0), 4)),
                'smoothing_seasonal_gamma': float(round(fitted.params.get('smoothing_seasonal', 0.0), 4)),
            }
    except Exception as e:
        print(f"[train_revenue_model] Statsmodels fit failed: {e}. Falling back to scikit-learn Linear Regression.")

    if model_to_persist is None:
        try:
            from sklearn.linear_model import LinearRegression
            df_reg = pd.DataFrame({'revenue': daily_series.values}, index=daily_series.index)
            df_reg['day_of_week'] = pd.to_datetime(df_reg.index).dayofweek
            df_reg['day_of_month'] = pd.to_datetime(df_reg.index).day
            df_reg['lag_1'] = df_reg['revenue'].shift(1)
            df_reg['lag_7'] = df_reg['revenue'].shift(7)
            df_reg = df_reg.dropna()

            if len(df_reg) >= 10:
                feature_names = ['day_of_week', 'day_of_month', 'lag_1', 'lag_7']
                X = df_reg[feature_names]
                y = df_reg['revenue']
                model = LinearRegression()
                model.fit(X, y)
                model_type = "Linear Regression (Lags)"
                model_to_persist = model
                feature_importances = {
                    fn: float(round(coef, 4)) for fn, coef in zip(feature_names, model.coef_)
                }
        except Exception as e:
            print(f"[train_revenue_model] Linear regression fit failed: {e}.")

    if model_to_persist is not None:
        meta = save_model(MODEL_NAME, model_to_persist, {
            'model_type': model_type,
            'training_days': int(len(daily_series)),
            'feature_importances': feature_importances,
        })
        return meta

    return {'model_type': model_type, 'status': 'no_trainable_model'}


if __name__ == '__main__':
    print("[train_revenue_model] Starting revenue model training...")
    meta_info = train_revenue_model()
    print(f"[train_revenue_model] Training complete. Version: {meta_info.get('version', 'N/A')}, "
          f"Model Type: {meta_info.get('model_type', 'N/A')}")
    if meta_info.get('feature_importances'):
        print("[train_revenue_model] Model Parameters / Coefficients:", meta_info['feature_importances'])

