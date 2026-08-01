"""
demand_forecasting.py — Facade and entrypoint for PharmaSync Demand Forecasting.

Maintains 100% backward compatibility with existing Django views, scripts, and tests
while delegating to the underlying training/serving split:
  - train_demand_model.py : fits and saves RandomForest models via model_registry
  - predict_demand.py     : loads persisted models and serves 7-day demand forecasts
"""

import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from train_demand_model import (
    LOOKBACK_DAYS,
    MODEL_NAME,
    get_db,
    load_sales_df,
    train_demand_models,
)
from predict_demand import (
    RESULT_COLLECTION,
    generate_forecast,
)

__all__ = [
    'LOOKBACK_DAYS',
    'RESULT_COLLECTION',
    'MODEL_NAME',
    'get_db',
    'load_sales_df',
    'train_demand_models',
    'generate_forecast',
]

if __name__ == '__main__':
    res = generate_forecast()
    print(f"[demand_forecasting] Forecast generated at {res['generatedAt'].isoformat()}. "
          f"Served {len(res['predictions'])} predictions using model version '{res.get('modelVersion')}'.")
