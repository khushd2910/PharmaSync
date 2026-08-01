"""
track_model_drift.py — Ongoing Model Drift & Accuracy Tracking in Production.

Compares past model forecasts stored in MongoDB ('demand_forecasts' and 'revenue_forecasts')
against actual realized sales/orders that occurred on those predicted dates.

Computes:
  - Demand Forecasting MAE, RMSE, MAPE / % error over time per model version.
  - Revenue Forecasting MAE, MAPE / % error over time per model version.
  - Overall accuracy trends across historical forecast runs (monitoring model drift).
"""

import os
import sys
import json
import numpy as np
import pandas as pd
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv
from pymongo import MongoClient

sys.path.insert(0, os.path.dirname(__file__))

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '..', '.env'))


def get_db():
    mongo_uri = os.getenv('MONGO_URI')
    if not mongo_uri:
        sys.exit('MONGO_URI is not set.')
    client = MongoClient(mongo_uri)
    return client.get_default_database()


def load_actual_sales_period(db, start_date, end_date):
    """
    Fetch actual realized sales quantity per medicine between start_date and end_date.
    """
    online = list(db.orders.aggregate([
        {'$match': {'orderStatus': {'$ne': 'Cancelled'}, 'createdAt': {'$gte': start_date, '$lte': end_date}}},
        {'$unwind': '$items'},
        {'$project': {'_id': 0, 'medicineId': '$items.medicine', 'quantity': '$items.quantity'}}
    ]))
    pos = list(db.possales.aggregate([
        {'$match': {'status': {'$ne': 'Refunded'}, 'createdAt': {'$gte': start_date, '$lte': end_date}}},
        {'$unwind': '$items'},
        {'$project': {'_id': 0, 'medicineId': '$items.medicine', 'quantity': '$items.quantity'}}
    ]))

    rows = online + pos
    if not rows:
        return {}

    df = pd.DataFrame(rows)
    df['medicineId'] = df['medicineId'].astype(str)
    df['quantity'] = pd.to_numeric(df['quantity'], errors='coerce').fillna(0)
    return df.groupby('medicineId')['quantity'].sum().to_dict()


def load_actual_revenue_period(db, start_date, end_date):
    """
    Fetch total actual revenue between start_date and end_date.
    """
    online = list(db.orders.aggregate([
        {'$match': {'orderStatus': {'$ne': 'Cancelled'}, 'createdAt': {'$gte': start_date, '$lte': end_date}}},
        {'$group': {'_id': None, 'total': {'$sum': '$totalAmount'}}}
    ]))
    pos = list(db.possales.aggregate([
        {'$match': {'status': {'$ne': 'Refunded'}, 'createdAt': {'$gte': start_date, '$lte': end_date}}},
        {'$group': {'_id': None, 'total': {'$sum': '$totalAmount'}}}
    ]))

    online_rev = online[0]['total'] if online else 0.0
    pos_rev = pos[0]['total'] if pos else 0.0
    return float(online_rev + pos_rev)


def track_demand_drift(db, max_docs=10):
    """
    Evaluates past demand forecast documents in MongoDB against actual sales realized.
    """
    cursor = db.demand_forecasts.find().sort('generatedAt', -1).limit(max_docs)
    docs = list(cursor)

    if not docs:
        return {'status': 'no_forecasts', 'message': 'No past demand forecasts found in MongoDB.'}

    now = datetime.now(timezone.utc)
    evaluations = []

    for doc in docs:
        gen_at = doc.get('generatedAt')
        if isinstance(gen_at, str):
            gen_at = datetime.fromisoformat(gen_at)
        if gen_at.tzinfo is None:
            gen_at = gen_at.replace(tzinfo=timezone.utc)

        # Target 7-day forecast window
        target_start = gen_at + timedelta(days=1)
        target_end = min(now, gen_at + timedelta(days=7))

        if target_start >= now:
            # Forecast is for future days, cannot evaluate actuals yet
            continue

        days_elapsed = max(1, (target_end - target_start).days + 1)
        actuals = load_actual_sales_period(db, target_start, target_end)

        predictions = doc.get('predictions', [])
        if not predictions:
            continue

        y_true, y_pred = [], []
        for p in predictions:
            med_id = str(p.get('medicineId'))
            pred_demand = float(p.get('predictedWeeklyDemand', 0.0))
            # Scale predicted demand for the elapsed days evaluated
            pred_scaled = (pred_demand / 7.0) * days_elapsed
            actual_qty = float(actuals.get(med_id, 0.0))

            y_pred.append(pred_scaled)
            y_true.append(actual_qty)

        if not y_true:
            continue

        y_true_arr, y_pred_arr = np.array(y_true), np.array(y_pred)
        mae = float(np.mean(np.abs(y_true_arr - y_pred_arr)))
        rmse = float(np.sqrt(np.mean((y_true_arr - y_pred_arr) ** 2)))

        # Percentage error avoiding division by zero
        denom = np.maximum(y_true_arr, 1.0)
        mape = float(np.mean(np.abs((y_true_arr - y_pred_arr) / denom)) * 100)

        evaluations.append({
            'forecastGeneratedAt': gen_at.isoformat(),
            'modelVersion': doc.get('modelVersion', 'v1.0'),
            'daysEvaluated': days_elapsed,
            'medicinesEvaluated': len(predictions),
            'mae': round(mae, 3),
            'rmse': round(rmse, 3),
            'mapePercent': round(mape, 2),
            'accuracyPercent': round(max(0.0, 100.0 - mape), 2),
        })

    return {
        'status': 'ok',
        'forecastRunsEvaluated': len(evaluations),
        'evaluations': evaluations,
    }


def track_revenue_drift(db, max_docs=10):
    """
    Evaluates past revenue forecast documents in MongoDB against actual revenue realized.
    """
    cursor = db.revenue_forecasts.find().sort('generatedAt', -1).limit(max_docs)
    docs = list(cursor)

    if not docs:
        return {'status': 'no_forecasts', 'message': 'No past revenue forecasts found in MongoDB.'}

    now = datetime.now(timezone.utc)
    evaluations = []

    for doc in docs:
        gen_at = doc.get('generatedAt')
        if isinstance(gen_at, str):
            gen_at = datetime.fromisoformat(gen_at)
        if gen_at.tzinfo is None:
            gen_at = gen_at.replace(tzinfo=timezone.utc)

        target_start = gen_at + timedelta(days=1)
        target_end = min(now, gen_at + timedelta(days=30))

        if target_start >= now:
            continue

        days_elapsed = max(1, (target_end - target_start).days + 1)
        actual_rev = load_actual_revenue_period(db, target_start, target_end)

        preds = doc.get('predictions', [])
        pred_rev_sum = 0.0
        for p in preds:
            p_date_str = p.get('date')
            if p_date_str:
                p_date = datetime.strptime(p_date_str, '%Y-%m-%d').replace(tzinfo=timezone.utc)
                if target_start <= p_date <= target_end:
                    pred_rev_sum += float(p.get('predictedRevenue', 0.0))

        abs_error = abs(actual_rev - pred_rev_sum)
        denom = max(actual_rev, 1.0)
        pct_error = (abs_error / denom) * 100.0

        evaluations.append({
            'forecastGeneratedAt': gen_at.isoformat(),
            'modelType': doc.get('modelType', 'Linear Regression'),
            'modelVersion': doc.get('modelVersion', 'v1.0'),
            'daysEvaluated': days_elapsed,
            'predictedRevenueForPeriod': round(pred_rev_sum, 2),
            'actualRevenueRealized': round(actual_rev, 2),
            'absoluteError': round(abs_error, 2),
            'mapePercent': round(pct_error, 2),
            'accuracyPercent': round(max(0.0, 100.0 - pct_error), 2),
        })

    return {
        'status': 'ok',
        'forecastRunsEvaluated': len(evaluations),
        'evaluations': evaluations,
    }


def run_drift_analysis(db=None):
    if db is None:
        db = get_db()

    now = datetime.now(timezone.utc)
    demand_drift = track_demand_drift(db)
    revenue_drift = track_revenue_drift(db)

    report = {
        'generatedAt': now.isoformat(),
        'demandForecastingDrift': demand_drift,
        'revenueForecastingDrift': revenue_drift,
    }

    out_path = os.path.join(os.path.dirname(__file__), '..', 'drift_report.json')
    with open(out_path, 'w') as f:
        json.dump(report, f, indent=2, default=str)

    return report


if __name__ == '__main__':
    print("\n" + "=" * 70)
    print("PharmaSync — Production Model Drift & Accuracy Report")
    print("=" * 70)

    db_conn = get_db()
    report_data = run_drift_analysis(db_conn)

    d_drift = report_data['demandForecastingDrift']
    r_drift = report_data['revenueForecastingDrift']

    print("\n--- Demand Forecasting Drift ---")
    if d_drift.get('status') == 'ok' and d_drift.get('evaluations'):
        for e in d_drift['evaluations']:
            print(f"  [Forecast {e['forecastGeneratedAt'][:10]} | Version {e['modelVersion']}] "
                  f"Evaluated {e['daysEvaluated']} days ({e['medicinesEvaluated']} items) -> "
                  f"MAE: {e['mae']}, MAPE: {e['mapePercent']}%, Accuracy: {e['accuracyPercent']}%")
    else:
        print(f"  {d_drift.get('message', 'No completed historical forecast evaluation windows yet.')}")

    print("\n--- Revenue Forecasting Drift ---")
    if r_drift.get('status') == 'ok' and r_drift.get('evaluations'):
        for e in r_drift['evaluations']:
            print(f"  [Forecast {e['forecastGeneratedAt'][:10]} | Version {e['modelVersion']}] "
                  f"Predicted: Rs. {e['predictedRevenueForPeriod']}, Actual: Rs. {e['actualRevenueRealized']} -> "
                  f"Error: {e['mapePercent']}%, Accuracy: {e['accuracyPercent']}%")
    else:
        print(f"  {r_drift.get('message', 'No completed historical forecast evaluation windows yet.')}")

    print("\n" + "=" * 70)
    print(f"Report saved to python-service/drift_report.json\n")
