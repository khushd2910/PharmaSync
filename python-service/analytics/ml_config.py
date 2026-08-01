"""
ml_config.py — Centralized Machine Learning Hyperparameters & MLOps Thresholds.

Provides a single source of truth for all ML hyperparameters, model configuration constants,
and quality thresholds across PharmaSync's analytics, forecasting, and chatbot modules.

Supports environment variable overrides so hyperparameters can be tuned per deployment
without code changes.
"""

import os

# ---------------------------------------------------------------------------
# 1. Demand Forecasting (RandomForestRegressor)
# ---------------------------------------------------------------------------
DEMAND_LOOKBACK_DAYS = int(os.getenv('DEMAND_LOOKBACK_DAYS', '90'))
DEMAND_RF_N_ESTIMATORS = int(os.getenv('DEMAND_RF_N_ESTIMATORS', '30'))
DEMAND_RF_MAX_DEPTH = int(os.getenv('DEMAND_RF_MAX_DEPTH', '5'))
DEMAND_MIN_HISTORICAL_SALES = int(os.getenv('DEMAND_MIN_HISTORICAL_SALES', '5'))
DEMAND_MIN_FEATURE_ROWS = int(os.getenv('DEMAND_MIN_FEATURE_ROWS', '10'))
DEMAND_MODEL_NAME = 'demand_forecast_rf_models'
DEMAND_MAX_MODEL_AGE_HOURS = int(os.getenv('DEMAND_MAX_MODEL_AGE_HOURS', '168'))  # 7 days

# ---------------------------------------------------------------------------
# 2. Revenue Forecasting (Holt-Winters / Linear Regression)
# ---------------------------------------------------------------------------
REVENUE_LOOKBACK_DAYS = int(os.getenv('REVENUE_LOOKBACK_DAYS', '180'))
REVENUE_SEASONAL_PERIODS = int(os.getenv('REVENUE_SEASONAL_PERIODS', '7'))
REVENUE_MIN_DAYS_HOLT_WINTERS = int(os.getenv('REVENUE_MIN_DAYS_HOLT_WINTERS', '14'))
REVENUE_MODEL_NAME = 'revenue_forecast_model'
REVENUE_MAX_MODEL_AGE_HOURS = int(os.getenv('REVENUE_MAX_MODEL_AGE_HOURS', '168'))  # 7 days

# ---------------------------------------------------------------------------
# 3. Chatbot Intent Classifier (TF-IDF + LogisticRegression)
# ---------------------------------------------------------------------------
CHATBOT_CONFIDENCE_THRESHOLD = float(os.getenv('CHATBOT_CONFIDENCE_THRESHOLD', '0.42'))
CHATBOT_LOGREG_C = float(os.getenv('CHATBOT_LOGREG_C', '10.0'))
CHATBOT_LOGREG_MAX_ITER = int(os.getenv('CHATBOT_LOGREG_MAX_ITER', '200'))
CHATBOT_MODEL_NAME = 'chatbot_intent_classifier'
CHATBOT_MAX_MODEL_AGE_HOURS = int(os.getenv('CHATBOT_MAX_MODEL_AGE_HOURS', '720'))  # 30 days

# ---------------------------------------------------------------------------
# 4. Inventory Behavioural Segmentation (KMeans)
# ---------------------------------------------------------------------------
KMEANS_N_CLUSTERS = int(os.getenv('KMEANS_N_CLUSTERS', '4'))
KMEANS_RANDOM_STATE = int(os.getenv('KMEANS_RANDOM_STATE', '42'))
KMEANS_N_INIT = int(os.getenv('KMEANS_N_INIT', '10'))
KMEANS_MODEL_NAME = 'inventory_kmeans_segments'

# ---------------------------------------------------------------------------
# 5. Inventory Anomaly Detection (Isolation Forest)
# ---------------------------------------------------------------------------
ISOLATION_FOREST_CONTAMINATION = float(os.getenv('ISOLATION_FOREST_CONTAMINATION', '0.05'))
ISOLATION_FOREST_N_ESTIMATORS = int(os.getenv('ISOLATION_FOREST_N_ESTIMATORS', '150'))
ISOLATION_FOREST_RANDOM_STATE = int(os.getenv('ISOLATION_FOREST_RANDOM_STATE', '42'))
ISOLATION_FOREST_MODEL_NAME = 'inventory_isolation_forest'

# ---------------------------------------------------------------------------
# 6. MLOps Evaluation Quality Thresholds (CI Alerts)
# ---------------------------------------------------------------------------
MLOPS_MAX_DEMAND_MAE = float(os.getenv('MLOPS_MAX_DEMAND_MAE', '2.5'))
MLOPS_MIN_INTENT_ACCURACY = float(os.getenv('MLOPS_MIN_INTENT_ACCURACY', '0.65'))
MLOPS_MIN_KMEANS_SILHOUETTE = float(os.getenv('MLOPS_MIN_KMEANS_SILHOUETTE', '0.50'))
