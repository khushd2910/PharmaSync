"""
evaluate_models.py — Model evaluation report for PharmaSync's ML layer.

Run standalone, same way you'd run demand_forecasting.py or
revenue_forecasting.py:

    cd python-service
    python analytics/evaluate_models.py

Or add a Django management command that just calls main() if you want
`python manage.py evaluate_models` instead — this file has no Django
dependency itself, so either works.

WHAT THIS DOES
--------------
For every model in the project that is genuinely "trained" (as opposed to
a fixed formula like EOQ or ABC classification), this script holds out
real data the model never saw during training, generates predictions for
that held-out window, and scores them against a plain baseline. That
baseline comparison is the actual point: "MAE = 4.2 units" means nothing
on its own — "our model beats a naive average by 30%" is the number a
reviewer / examiner can actually evaluate.

Models covered (5):
  1. Demand Forecasting     — RandomForestRegressor   (regression)
  2. Revenue Forecasting     — Holt-Winters / LinearRegression (time series)
  3. Chatbot Intent Classifier — TF-IDF + LogisticRegression (classification)
  4. Inventory KMeans segmentation — unsupervised clustering
  5. Inventory Isolation Forest — unsupervised anomaly detection

Models NOT covered here on purpose, because they are not learned models
and "evaluating" them the same way would be meaningless — see
ML_FEATURES.md for why each of these is classical stats/rules instead:
  - ABC (Pareto) classification        (fixed cumulative-share rule)
  - Reorder point / safety stock / EOQ (textbook formulas)
  - Market Basket Analysis (Apriori)   (rule mining, scored by
                                         support/confidence/lift already
                                         shown in its own output)
"""

import os
import sys
import json
from datetime import datetime, timedelta, timezone

import numpy as np
import pandas as pd
from dotenv import load_dotenv
from pymongo import MongoClient
from sklearn.metrics import mean_absolute_error, mean_squared_error

sys.path.insert(0, os.path.dirname(__file__))          # analytics/
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))  # python-service/

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '..', '.env'))


def get_db():
    mongo_uri = os.getenv('MONGO_URI')
    if not mongo_uri:
        sys.exit('MONGO_URI is not set.')
    return MongoClient(mongo_uri).get_default_database()


def mape(y_true, y_pred):
    """Mean Absolute Percentage Error, ignoring days with zero actuals
    (MAPE is undefined there — dividing by zero isn't a model failure,
    it's a metric that doesn't apply on that day)."""
    y_true, y_pred = np.array(y_true, dtype=float), np.array(y_pred, dtype=float)
    mask = y_true != 0
    if not mask.any():
        return None
    return float(np.mean(np.abs((y_true[mask] - y_pred[mask]) / y_true[mask])) * 100)


# ---------------------------------------------------------------------------
# 1. Demand Forecasting (RandomForestRegressor) — per-medicine time backtest
# ---------------------------------------------------------------------------
def evaluate_demand_forecasting(db, holdout_days=7, lookback_days=90):
    from sklearn.ensemble import RandomForestRegressor

    now = datetime.now(timezone.utc)
    since = now - timedelta(days=lookback_days)

    online = list(db.orders.aggregate([
        {'$match': {'orderStatus': {'$ne': 'Cancelled'}, 'createdAt': {'$gte': since}}},
        {'$unwind': '$items'},
        {'$project': {'_id': 0, 'date': '$createdAt', 'medicineId': '$items.medicine', 'quantity': '$items.quantity'}},
    ]))
    pos = list(db.possales.aggregate([
        {'$match': {'status': {'$ne': 'Refunded'}, 'createdAt': {'$gte': since}}},
        {'$unwind': '$items'},
        {'$project': {'_id': 0, 'date': '$createdAt', 'medicineId': '$items.medicine', 'quantity': '$items.quantity'}},
    ]))
    rows = online + pos
    if not rows:
        return {'model': 'Demand Forecasting (RandomForest)', 'status': 'skipped', 'reason': 'no sales history in lookback window'}

    df = pd.DataFrame(rows)
    df['medicineId'] = df['medicineId'].astype(str)
    df['date'] = pd.to_datetime(df['date'], utc=True).dt.tz_localize(None)
    df['quantity'] = pd.to_numeric(df['quantity'], errors='coerce').fillna(0)

    date_index = pd.date_range(start=since.date(), end=now.date(), freq='D')
    holdout_cutoff = date_index[-1] - pd.Timedelta(days=holdout_days)

    model_errors, baseline_errors, evaluated = [], [], 0

    for med_id, g in df.groupby('medicineId'):
        daily = g.groupby(g['date'].dt.date)['quantity'].sum().reindex(date_index.date, fill_value=0.0)
        daily.index = pd.to_datetime(daily.index)

        train = daily[daily.index <= holdout_cutoff]
        test = daily[daily.index > holdout_cutoff]
        if len(train) < 20 or len(test) == 0 or train.sum() < 5:
            continue  # same "not enough data" guard the real script uses

        feat = pd.DataFrame({'sales': train.values}, index=train.index)
        feat['day_of_week'] = feat.index.dayofweek
        feat['day_of_month'] = feat.index.day
        feat['lag_1'] = feat['sales'].shift(1)
        feat['lag_2'] = feat['sales'].shift(2)
        feat['lag_7'] = feat['sales'].shift(7)
        feat['rolling_mean_7'] = feat['sales'].shift(1).rolling(7).mean()
        feat = feat.dropna()
        if len(feat) < 10:
            continue

        X, y = feat[['day_of_week', 'day_of_month', 'lag_1', 'lag_2', 'lag_7', 'rolling_mean_7']], feat['sales']
        rf = RandomForestRegressor(n_estimators=30, max_depth=5, random_state=42)
        rf.fit(X, y)

        history = list(train.values)
        preds = []
        for f_date in test.index:
            lag1, lag2, lag7 = history[-1], history[-2], history[-7]
            roll7 = np.mean(history[-7:])
            row = pd.DataFrame([{'day_of_week': f_date.dayofweek, 'day_of_month': f_date.day,
                                  'lag_1': lag1, 'lag_2': lag2, 'lag_7': lag7, 'rolling_mean_7': roll7}])
            p = max(0.0, float(rf.predict(row)[0]))
            preds.append(p)
            history.append(p)

        actual = test.values
        baseline_pred = [train.tail(7).mean()] * len(actual)  # naive "same as recent average" baseline

        model_errors.append((actual, preds))
        baseline_errors.append((actual, baseline_pred))
        evaluated += 1

    if evaluated == 0:
        return {'model': 'Demand Forecasting (RandomForest)', 'status': 'skipped', 'reason': 'no medicine had enough history for a holdout split'}

    all_actual = np.concatenate([a for a, _ in model_errors])
    all_model_pred = np.concatenate([p for _, p in model_errors])
    all_base_pred = np.concatenate([p for _, p in baseline_errors])

    return {
        'model': 'Demand Forecasting (RandomForest)',
        'status': 'ok',
        'medicines_evaluated': evaluated,
        'holdout_days': holdout_days,
        'model_mae': round(mean_absolute_error(all_actual, all_model_pred), 3),
        'model_rmse': round(mean_squared_error(all_actual, all_model_pred) ** 0.5, 3),
        'baseline_mae': round(mean_absolute_error(all_actual, all_base_pred), 3),
        'baseline_rmse': round(mean_squared_error(all_actual, all_base_pred) ** 0.5, 3),
        'improvement_over_baseline_pct': round(
            (1 - mean_absolute_error(all_actual, all_model_pred) / max(mean_absolute_error(all_actual, all_base_pred), 1e-9)) * 100, 1
        ),
    }


# ---------------------------------------------------------------------------
# 2. Revenue Forecasting (Holt-Winters / Linear Regression) — 30-day backtest
# ---------------------------------------------------------------------------
def evaluate_revenue_forecasting(db, holdout_days=30, lookback_days=180):
    now = datetime.now(timezone.utc)
    since = now - timedelta(days=lookback_days)

    online = list(db.orders.aggregate([
        {'$match': {'orderStatus': {'$ne': 'Cancelled'}, 'createdAt': {'$gte': since}}},
        {'$project': {'_id': 0, 'date': '$createdAt', 'amount': '$totalAmount'}},
    ]))
    pos = list(db.possales.aggregate([
        {'$match': {'status': {'$ne': 'Refunded'}, 'createdAt': {'$gte': since}}},
        {'$project': {'_id': 0, 'date': '$createdAt', 'amount': '$totalAmount'}},
    ]))
    rows = online + pos
    if not rows:
        return {'model': 'Revenue Forecasting', 'status': 'skipped', 'reason': 'no transaction history in lookback window'}

    df = pd.DataFrame(rows)
    df['date'] = pd.to_datetime(df['date'], utc=True).dt.tz_localize(None)
    df['amount'] = pd.to_numeric(df['amount'], errors='coerce').fillna(0.0)

    date_index = pd.date_range(end=now.date(), periods=lookback_days, freq='D')
    daily = df.groupby(df['date'].dt.date)['amount'].sum().reindex(date_index.date, fill_value=0.0)
    daily.index = pd.to_datetime(daily.index)

    if len(daily) <= holdout_days + 14:
        return {'model': 'Revenue Forecasting', 'status': 'skipped', 'reason': 'not enough history for a 30-day holdout'}

    train, test = daily.iloc[:-holdout_days], daily.iloc[-holdout_days:]
    results = {'model': 'Revenue Forecasting', 'status': 'ok', 'holdout_days': holdout_days}

    # Holt-Winters
    try:
        from statsmodels.tsa.holtwinters import ExponentialSmoothing
        fitted = ExponentialSmoothing(train.values + 1e-4, trend='add', seasonal='add', seasonal_periods=7).fit(optimized=True)
        hw_pred = fitted.forecast(holdout_days)
        results['holt_winters_mae'] = round(mean_absolute_error(test.values, hw_pred), 2)
        results['holt_winters_mape_pct'] = round(mape(test.values, hw_pred) or -1, 2)
    except Exception as e:
        results['holt_winters_error'] = str(e)

    # Linear Regression fallback model
    try:
        from sklearn.linear_model import LinearRegression
        feat = pd.DataFrame({'revenue': train.values}, index=train.index)
        feat['day_of_week'] = feat.index.dayofweek
        feat['day_of_month'] = feat.index.day
        feat['lag_1'] = feat['revenue'].shift(1)
        feat['lag_7'] = feat['revenue'].shift(7)
        feat = feat.dropna()
        X, y = feat[['day_of_week', 'day_of_month', 'lag_1', 'lag_7']], feat['revenue']
        lr = LinearRegression().fit(X, y)

        history = list(train.values)
        lr_pred = []
        for f_date in test.index:
            row = pd.DataFrame([{'day_of_week': f_date.dayofweek, 'day_of_month': f_date.day,
                                  'lag_1': history[-1], 'lag_7': history[-7]}])
            p = float(lr.predict(row)[0])
            lr_pred.append(p)
            history.append(p)
        results['linear_regression_mae'] = round(mean_absolute_error(test.values, lr_pred), 2)
        results['linear_regression_mape_pct'] = round(mape(test.values, lr_pred) or -1, 2)
    except Exception as e:
        results['linear_regression_error'] = str(e)

    # Naive baseline: repeat the mean of the training period
    baseline_pred = [train.mean()] * holdout_days
    results['baseline_mean_mae'] = round(mean_absolute_error(test.values, baseline_pred), 2)

    return results


# ---------------------------------------------------------------------------
# 3. Chatbot Intent Classifier (TF-IDF + LogisticRegression) — stratified CV
# ---------------------------------------------------------------------------
def evaluate_intent_classifier():
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.linear_model import LogisticRegression
    from sklearn.model_selection import StratifiedKFold, cross_val_predict
    from sklearn.metrics import accuracy_score, precision_recall_fscore_support, classification_report

    try:
        from chatbot.intent_classifier import TRAINING_DATA
    except Exception as e:
        return {'model': 'Chatbot Intent Classifier', 'status': 'skipped', 'reason': f'could not import TRAINING_DATA: {e}'}

    texts = [t for t, _ in TRAINING_DATA]
    labels = [l for _, l in TRAINING_DATA]

    vec = TfidfVectorizer(ngram_range=(1, 2), stop_words='english', lowercase=True)
    X = vec.fit_transform(texts)
    clf = LogisticRegression(C=10.0, max_iter=200, class_weight='balanced')

    class_counts = pd.Series(labels).value_counts()
    n_splits = min(5, class_counts.min())
    if n_splits < 2:
        return {'model': 'Chatbot Intent Classifier', 'status': 'skipped',
                'reason': f'smallest intent class only has {class_counts.min()} example(s); need >=2 for cross-validation'}

    skf = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=42)
    preds = cross_val_predict(clf, X, labels, cv=skf)

    acc = accuracy_score(labels, preds)
    precision, recall, f1, _ = precision_recall_fscore_support(labels, preds, average='macro', zero_division=0)

    return {
        'model': 'Chatbot Intent Classifier',
        'status': 'ok',
        'cv_folds': n_splits,
        'training_examples': len(texts),
        'num_intents': len(class_counts),
        'accuracy': round(acc, 3),
        'macro_precision': round(precision, 3),
        'macro_recall': round(recall, 3),
        'macro_f1': round(f1, 3),
        'per_class_report': classification_report(labels, preds, zero_division=0),
    }


# ---------------------------------------------------------------------------
# 4 & 5. Inventory Deep Analysis — KMeans silhouette + Isolation Forest stability
# ---------------------------------------------------------------------------
def evaluate_inventory_ml(db, lookback_days=90):
    from sklearn.cluster import KMeans
    from sklearn.preprocessing import StandardScaler
    from sklearn.ensemble import IsolationForest
    from sklearn.metrics import silhouette_score

    now = datetime.now(timezone.utc)
    since = now - timedelta(days=lookback_days)

    online = list(db.orders.aggregate([
        {'$match': {'orderStatus': {'$ne': 'Cancelled'}, 'createdAt': {'$gte': since}}},
        {'$unwind': '$items'},
        {'$project': {'_id': 0, 'medicineId': '$items.medicine', 'quantity': '$items.quantity'}},
    ]))
    pos = list(db.possales.aggregate([
        {'$match': {'status': {'$ne': 'Refunded'}, 'createdAt': {'$gte': since}}},
        {'$unwind': '$items'},
        {'$project': {'_id': 0, 'medicineId': '$items.medicine', 'quantity': '$items.quantity'}},
    ]))
    rows = online + pos
    if not rows:
        return {'model': 'Inventory KMeans + Isolation Forest', 'status': 'skipped', 'reason': 'no sales history'}

    df = pd.DataFrame(rows)
    df['medicineId'] = df['medicineId'].astype(str)
    df['quantity'] = pd.to_numeric(df['quantity'], errors='coerce').fillna(0)

    agg = df.groupby('medicineId')['quantity'].agg(['sum', 'mean', 'std']).fillna(0)
    agg.columns = ['totalDemand', 'avgDailyDemand', 'demandVariability']
    if len(agg) < 10:
        return {'model': 'Inventory KMeans + Isolation Forest', 'status': 'skipped', 'reason': 'fewer than 10 medicines with sales history'}

    # --- KMeans: silhouette score (higher = better-separated clusters; -1..1) ---
    features = agg[['avgDailyDemand', 'demandVariability']].fillna(0.0)
    scaled = StandardScaler().fit_transform(features)
    n_clusters = min(4, len(agg))
    km = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
    cluster_labels = km.fit_predict(scaled)
    sil = silhouette_score(scaled, cluster_labels) if n_clusters > 1 else None

    # --- Isolation Forest: stability across bootstrap resamples ---
    # No ground-truth "this item really is anomalous" labels exist, so
    # accuracy/precision can't be computed. What CAN be measured: does the
    # model flag a *consistent* set of items, or is it noise? Refit on two
    # different random subsamples and measure overlap (Jaccard index) of
    # what gets flagged both times — a stable model should agree with itself.
    rng = np.random.RandomState(42)
    flagged_sets = []
    for seed in (1, 2):
        sample = agg.sample(frac=0.8, random_state=seed)
        iso = IsolationForest(contamination=0.05, random_state=seed, n_estimators=150)
        preds = iso.fit_predict(sample[['avgDailyDemand', 'demandVariability']].fillna(0.0))
        flagged_sets.append(set(sample.index[preds == -1]))

    inter = len(flagged_sets[0] & flagged_sets[1])
    union = len(flagged_sets[0] | flagged_sets[1]) or 1
    jaccard = round(inter / union, 3)

    return {
        'model': 'Inventory KMeans + Isolation Forest',
        'status': 'ok',
        'medicines_evaluated': len(agg),
        'kmeans_clusters': n_clusters,
        'kmeans_silhouette_score': round(sil, 3) if sil is not None else None,
        'isolation_forest_anomaly_rate_pct': round(100 * len(flagged_sets[0]) / len(flagged_sets[0].union(agg.index)), 2),
        'isolation_forest_stability_jaccard': jaccard,
    }


# ---------------------------------------------------------------------------
def main():
    db = get_db()
    report = {
        'generatedAt': datetime.now(timezone.utc).isoformat(),
        'results': [
            evaluate_demand_forecasting(db),
            evaluate_revenue_forecasting(db),
            evaluate_intent_classifier(),
            evaluate_inventory_ml(db),
        ],
    }

    print('\n' + '=' * 70)
    print('PharmaSync — ML Model Evaluation Report')
    print('=' * 70)
    for r in report['results']:
        print(f"\n--- {r['model']} ---")
        if r['status'] != 'ok':
            print(f"  SKIPPED: {r.get('reason')}")
            continue
        for k, v in r.items():
            if k in ('model', 'status', 'per_class_report'):
                continue
            print(f"  {k}: {v}")
        if 'per_class_report' in r:
            print("  per-class report:")
            print('\n'.join('    ' + line for line in r['per_class_report'].splitlines()))
    print('\n' + '=' * 70)

    out_path = os.path.join(os.path.dirname(__file__), '..', 'evaluation_report.json')
    with open(out_path, 'w') as f:
        json.dump(report, f, indent=2, default=str)
    print(f"Full report written to {os.path.abspath(out_path)}\n")


if __name__ == '__main__':
    main()
