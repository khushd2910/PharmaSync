"""
predict_revenue.py — Serving/Inference pipeline for PharmaSync's Revenue Forecasting.

Separates serving from training:
- Loads the persisted revenue model from python-service/models/ via model_registry.
- Evaluates recent 180-day sales transaction history.
- Runs 30-day revenue forecasting.
- Persists forecast outputs to MongoDB collection 'revenue_forecasts'.
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
from train_revenue_model import train_revenue_model, load_transactions_df

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '..', '.env'))

LOOKBACK_DAYS = 180
RESULT_COLLECTION = 'revenue_forecasts'
MODEL_NAME = 'revenue_forecast_model'
MAX_MODEL_AGE_HOURS = 24 * 7  # 7 days max staleness before auto-retraining on prediction request


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

    df = load_transactions_df(db, since)
    date_index = pd.date_range(end=now.date(), periods=lookback_days, freq='D')

    if df.empty:
        daily_series = pd.Series(0.0, index=date_index)
    else:
        daily_series = df.groupby(df['date'].dt.date)['amount'].sum().reindex(date_index.date, fill_value=0.0)

    last_30_actual = daily_series.tail(30)
    historical_data = [
        {'date': date.strftime('%Y-%m-%d'), 'revenue': round(float(val), 2)}
        for date, val in last_30_actual.items()
    ]
    actual_last_30_days_sum = float(last_30_actual.sum())

    forecast_dates = pd.date_range(start=now.date() + timedelta(days=1), periods=30, freq='D')
    forecasted_values = []
    model_type = "Baseline (Mean)"

    saved_model, saved_meta = load_model(MODEL_NAME)
    if saved_model is None or is_stale(saved_meta, MAX_MODEL_AGE_HOURS):
        print("[predict_revenue] No active revenue model found or model is stale. Triggering training...")
        train_revenue_model(db, lookback_days=lookback_days)
        saved_model, saved_meta = load_model(MODEL_NAME)

    if saved_model is not None:
        saved_type = saved_meta.get('model_type', '')
        if saved_type == 'Holt-Winters Exponential Smoothing':
            try:
                forecasted_values = list(saved_model.forecast(30))
                model_type = saved_type
            except Exception as e:
                print(f"[predict_revenue] Evaluating saved Holt-Winters model failed: {e}")
                forecasted_values = []

        elif saved_type == 'Linear Regression (Lags)':
            try:
                history = list(daily_series.values)
                for f_date in forecast_dates:
                    feat = pd.DataFrame([{
                        'day_of_week': f_date.dayofweek,
                        'day_of_month': f_date.day,
                        'lag_1': history[-1],
                        'lag_7': history[-7],
                    }])
                    pred = float(saved_model.predict(feat)[0])
                    forecasted_values.append(pred)
                    history.append(pred)
                model_type = saved_type
            except Exception as e:
                print(f"[predict_revenue] Evaluating saved Linear Regression model failed: {e}")
                forecasted_values = []

    if not forecasted_values:
        mean_val = float(daily_series.tail(30).mean())
        forecasted_values = [mean_val] * 30
        model_type = "Mean Baseline"

    forecast_data = []
    total_forecasted_revenue = 0.0
    for date, val in zip(forecast_dates, forecasted_values):
        val = max(0.0, round(float(val), 2))
        forecast_data.append({
            'date': date.strftime('%Y-%m-%d'),
            'predictedRevenue': val
        })
        total_forecasted_revenue += val

    total_forecasted_revenue = round(total_forecasted_revenue, 2)

    if actual_last_30_days_sum > 0:
        growth_rate = round((total_forecasted_revenue - actual_last_30_days_sum) / actual_last_30_days_sum, 4)
    else:
        growth_rate = 0.0

    result = {
        'generatedAt': datetime.now(timezone.utc),
        'modelType': model_type,
        'modelVersion': saved_meta.get('version') if saved_meta else None,
        'featureImportances': saved_meta.get('feature_importances') if saved_meta else {},
        'historical': historical_data,
        'predictions': forecast_data,
        'totalForecastedRevenue': total_forecasted_revenue,
        'actualLast30DaysRevenue': actual_last_30_days_sum,
        'growthRate': growth_rate
    }

    db[RESULT_COLLECTION].insert_one(result)
    return result


if __name__ == '__main__':
    res = generate_forecast()
    print(f"[predict_revenue] Forecast served at {res['generatedAt'].isoformat()} using {res['modelType']} (Version: {res.get('modelVersion')}). "
          f"Projected 30-day revenue: Rs. {res['totalForecastedRevenue']}.")
    if res.get('featureImportances'):
        print("[predict_revenue] Model Feature Importances / Coefficients:", res['featureImportances'])

