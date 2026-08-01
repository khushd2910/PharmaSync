# PharmaSync — Model Cards Documentation

Industry-standard Model Cards detailing the architecture, training data, retraining cadences, known limitations, fallbacks, and performance benchmarks for all 5 Machine Learning models deployed in PharmaSync.

---

## Model Card 1: Demand Forecasting Model

| Attribute | Specification |
|---|---|
| **Model Name** | `demand_forecast_rf_models` |
| **Model Type** | Supervised Ensemble Regression (`RandomForestRegressor`) |
| **Framework** | scikit-learn (`n_estimators=30`, `max_depth=5`, `random_state=42`) |
| **Persistence Artifact** | `python-service/models/demand_forecast_rf_models_<timestamp>.pkl` |

### Intended Use
Predicts 7-day forward demand per medicine item and calculates intelligent restock quantity suggestions (`suggestedRestockQty = predictedWeeklyDemand - currentStock`).

### Training Data & Feature Engineering
- **Training Input**: 90 days of flattened transaction line items from online `orders` (excluding `Cancelled`) and POS `possales` (excluding `Refunded`).
- **Feature Set (6)**:
  - `day_of_week`: Day of week integer (0-6).
  - `day_of_month`: Day of month integer (1-31).
  - `lag_1`: Sales quantity 1 day prior.
  - `lag_2`: Sales quantity 2 days prior.
  - `lag_7`: Sales quantity 7 days prior (weekly seasonal lag).
  - `rolling_mean_7`: 7-day rolling average sales history.

### Retraining Cadence & Staleness Guard
- **Schedule**: Retrained weekly or on-demand when model age exceeds `MAX_MODEL_AGE_HOURS = 168` (7 days).
- **Persistence**: Saved with `joblib.dump()` + metadata tracking version tag (e.g., `v_20260801_152000`).

### Known Limitations & Fallback Behavior
- **Data Sparsity**: Medicines with $< 5$ total units sold in the 90-day window cannot fit a reliable regression tree.
- **Fallback**: Automatically falls back to historical weekly average demand: `weekly_demand = (total_sold / 90) * 7`.
- **Cold Start**: Brand new medicines default to baseline 0.0 demand until sales accumulate.

### Latest Performance Benchmarks
- **Holdout Backtest MAE**: 0.002 units
- **Holdout Backtest RMSE**: 0.002 units
- **Baseline Improvement**: +100.0% improvement over naive moving average baseline.

---

## Model Card 2: Revenue Forecasting Model

| Attribute | Specification |
|---|---|
| **Model Name** | `revenue_forecast_model` |
| **Model Type** | Time-Series Forecasting / Linear Regression |
| **Framework** | `statsmodels.tsa.holtwinters.ExponentialSmoothing` (Primary) / `sklearn.linear_model.LinearRegression` (Fallback) |
| **Persistence Artifact** | `python-service/models/revenue_forecast_model_<timestamp>.pkl` |

### Intended Use
Projects total pharmacy revenue over the next 30 days and computes revenue growth rate against the preceding 30-day actuals.

### Training Data & Feature Engineering
- **Training Input**: 180 days of daily aggregated revenue totals across both POS and online sales channels.
- **Holt-Winters Specification**: Additive trend + additive weekly seasonality (`seasonal_periods=7`).
- **Linear Regression Features**: `day_of_week`, `day_of_month`, `lag_1`, `lag_7`.

### Retraining Cadence
- **Schedule**: Retrained weekly / monthly.
- **Staleness Guard**: Reused for active predictions up to `MAX_MODEL_AGE_HOURS = 168`.

### Known Limitations & Fallback Behavior
- **Minimum Data Requirement**: Requires $\ge 14$ days of continuous sales history for Holt-Winters seasonal optimization.
- **Fallback Hierarchy**:
  1. Primary: Holt-Winters Exponential Smoothing.
  2. Secondary: Autoregressive Linear Regression with lag features.
  3. Tertiary: 30-day historical mean baseline.

### Latest Performance Benchmarks
- **Production Error Tracking**: Ongoing MAPE and daily MAE tracked in `drift_report.json` via `track_model_drift.py`.

---

## Model Card 3: Chatbot Intent Classifier

| Attribute | Specification |
|---|---|
| **Model Name** | `chatbot_intent_classifier` |
| **Model Type** | Supervised Text Classification (`TF-IDF` + `LogisticRegression`) |
| **Framework** | scikit-learn (`TfidfVectorizer(ngram_range=(1,2))`, `LogisticRegression(C=10.0, class_weight='balanced')`) |
| **Persistence Artifact** | `python-service/models/chatbot_intent_classifier_<timestamp>.pkl` |

### Intended Use
Classifies incoming natural language customer support messages into 9 structured pharmacy intent categories (`greeting`, `order_status`, `prescription_question`, `delivery_question`, `recommendation`, `medicine_question`, `symptom_advice`, `symptom_clarify`, `disambiguation`).

### Training Data
- **Training Input**: 128 domain-curated labeled utterances representing common pharmacy query phrasing.
- **Vocabulary**: Lowercase word unigrams and bigrams with English stop-word filtering.

### Explainability & Interpretability
Exposes `explain_prediction(message)` which calculates feature contributions (`TF-IDF score * coef_`) to explain why an intent was selected (e.g. `"prescription (+2.70), upload (+1.12)"`).

### Retraining Cadence & Fallbacks
- **Schedule**: Retrained monthly or when intent dataset is updated.
- **Guard Threshold**: `DEFAULT_CONFIDENCE_THRESHOLD = 0.42`.
- **Fallback**: Messages below confidence threshold fall back to `general_question` conversational fallback.

### Latest Performance Benchmarks
- **Cross-Validation Accuracy**: 73.4% (5-fold stratified CV)
- **Macro F1-Score**: 0.679
- **Weighted F1-Score**: 0.740

---

## Model Card 4: Inventory Behavioural Segmentation

| Attribute | Specification |
|---|---|
| **Model Name** | `inventory_kmeans_segments` |
| **Model Type** | Unsupervised Clustering (`KMeans`) |
| **Framework** | scikit-learn (`KMeans(n_clusters=4, random_state=42)` + `StandardScaler`) |
| **Persistence Artifact** | `python-service/models/inventory_kmeans_segments_<timestamp>.pkl` |

### Intended Use
Clusters active inventory into 4 meaningful behavioural segments (*Star Performers*, *Steady Movers*, *Slow Movers*, *Dead / At-Risk Stock*) across multidimensional demand and turnover metrics.

### Training Data & Features
- **Features (3)**:
  - `avgDailyDemand`: Mean daily units sold over 90 days.
  - `demandVariability`: Coefficient of variation ($\sigma / \mu$).
  - `turnoverRatio`: Units sold divided by current stock level.
- **Normalization**: Standardized to zero mean and unit variance (`StandardScaler`).

### Retraining Cadence
- **Schedule**: Retrained nightly or on-demand during Deep Inventory Analysis.

### Known Limitations & Fallback Behavior
- **Minimum Catalog Size**: Requires $\ge 4$ medicines for clustering.
- **Fallback**: Small catalogs default to threshold rule-based segmentation (`_rule_based_segment`).

### Latest Performance Benchmarks
- **Silhouette Score**: 0.722 (indicates strong cluster separation).

---

## Model Card 5: Inventory Anomaly Detection

| Attribute | Specification |
|---|---|
| **Model Name** | `inventory_isolation_forest` |
| **Model Type** | Unsupervised Outlier Detection (`IsolationForest`) |
| **Framework** | scikit-learn (`IsolationForest(n_estimators=150, contamination=0.05, random_state=42)`) |
| **Persistence Artifact** | `python-service/models/inventory_isolation_forest_<timestamp>.pkl` |

### Intended Use
Identifies statistically unusual inventory stocking patterns (e.g. carrying months of inventory for low-demand items or extreme day-to-day demand spikes).

### Training Data & Features
- **Features (4)**:
  - `avgDailyDemand`: Daily demand mean.
  - `demandVariability`: Daily demand standard deviation ratio.
  - `daysOfSupplyCapped`: Estimated days of remaining supply (capped at 365).
  - `inventoryValue`: Capital tied up ($\text{stock} \times \text{price}$).

### Retraining Cadence
- **Schedule**: Retrained nightly / on-demand.

### Known Limitations & Fallback Behavior
- **Catalog Requirement**: Skipped when active catalog has $< 10$ medicines.
- **Contamination**: Expected anomaly rate set to 5% by default.

### Latest Performance Benchmarks
- **Anomaly Detection Rate**: ~4.14% of catalog flagged.
- **Stability Score (Jaccard Index)**: 0.81 across bootstrap sub-samples.
