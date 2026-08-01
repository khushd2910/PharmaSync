"""
revenue_forecasting.py — Facade and entrypoint for PharmaSync Revenue Forecasting.

Maintains 100% backward compatibility with existing Django views, scripts, and tests
while delegating to the underlying training/serving split:
  - train_revenue_model.py : fits and saves Holt-Winters or Linear Regression model
  - predict_revenue.py     : loads persisted model and serves 30-day revenue forecasts
"""

import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from train_revenue_model import (
    LOOKBACK_DAYS,
    MODEL_NAME,
    get_db,
    load_transactions_df,
    train_revenue_model,
)
from predict_revenue import (
    RESULT_COLLECTION,
    generate_forecast,
)

__all__ = [
    'LOOKBACK_DAYS',
    'RESULT_COLLECTION',
    'MODEL_NAME',
    'get_db',
    'load_transactions_df',
    'train_revenue_model',
    'generate_forecast',
]

if __name__ == '__main__':
    res = generate_forecast()
    print(f"[revenue_forecasting] Forecast generated at {res['generatedAt'].isoformat()} using {res['modelType']}. "
          f"Projected 30-day revenue: Rs. {res['totalForecastedRevenue']}.")
