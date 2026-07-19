"""
Sales Analysis — Module 5 (Python + Pandas)

Same shape as Module 4's inventory_analysis.py: read the same MongoDB the
Node/Express API uses -> flatten order/sale line items from BOTH channels
(online Orders, POS Sales) into pandas -> calculate Daily / Weekly / Monthly
Sales, total Revenue, and Best/Worst Sellers -> write one result document
back to Mongo. The Node admin dashboard reads that document; this script
never talks to Express directly, so it runs on its own schedule (cron, Task
Scheduler, etc.) independent of the API.

Run manually:
    python3 sales_analysis.py

Schedule nightly (cron, e.g. 2:15 AM — a few minutes after inventory_analysis.py):
    15 2 * * * cd /path/to/python-service && /path/to/venv/bin/python analytics/sales_analysis.py >> ../logs/sales_analysis.log 2>&1

Environment (.env in python-service/, or the repo root — see .env.example):
    MONGO_URI                same connection string the Node server uses
    SALES_ANALYSIS_LOOKBACK_DAYS  default 365 — how far back raw sales are read.
                                   Deliberately a separate variable from
                                   inventory_analysis.py's SALES_LOOKBACK_DAYS
                                   (that one drives fast/slow-selling over 30
                                   days; this one needs a full year on hand to
                                   build a 12-month trend).
    BEST_WORST_TOP_N         default 5
"""

import os
import sys
from datetime import datetime, timedelta, timezone

import pandas as pd
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '..', '.env'))

LOOKBACK_DAYS = int(os.getenv('SALES_ANALYSIS_LOOKBACK_DAYS', '365'))
TOP_N = int(os.getenv('BEST_WORST_TOP_N', '5'))
RESULT_COLLECTION = 'sales_analysis'  # must match server/models/SalesAnalysis.js

DAILY_DAYS = 30
WEEKLY_WEEKS = 12
MONTHLY_MONTHS = 12


def get_db():
    mongo_uri = os.getenv('MONGO_URI')
    if not mongo_uri:
        sys.exit('MONGO_URI is not set — copy python-service/.env.example to .env and fill it in.')
    client = MongoClient(mongo_uri)
    return client.get_default_database()


def load_sales_df(db, since):
    """
    Flattens order/sale line items from both channels into one table:
    one row per (order, line item), with the fields needed to group by
    time bucket, by medicine, and — separately — by channel. Prices/names
    come from each item's own snapshot (the same fields the invoice/receipt
    PDFs use), not a live join against the medicines collection, so this
    stays historically accurate even for renamed or deleted medicines.
    """
    online_rows = list(db.orders.aggregate([
        {'$match': {'orderStatus': {'$ne': 'Cancelled'}, 'createdAt': {'$gte': since}}},
        {'$unwind': '$items'},
        {'$project': {
            '_id': 0,
            'orderId': '$_id',
            'date': '$createdAt',
            'medicineId': '$items.medicine',
            'name': '$items.name',
            'quantity': '$items.quantity',
            'price': '$items.price',
            'channel': {'$literal': 'online'},
        }},
    ]))
    pos_rows = list(db.possales.aggregate([
        {'$match': {'status': {'$ne': 'Refunded'}, 'createdAt': {'$gte': since}}},
        {'$unwind': '$items'},
        {'$project': {
            '_id': 0,
            'orderId': '$_id',
            'date': '$createdAt',
            'medicineId': '$items.medicine',
            'name': '$items.name',
            'quantity': '$items.quantity',
            'price': '$items.price',
            'channel': {'$literal': 'pos'},
        }},
    ]))

    rows = online_rows + pos_rows
    columns = ['orderId', 'date', 'medicineId', 'name', 'quantity', 'price', 'channel']
    if not rows:
        return pd.DataFrame(columns=columns + ['revenue'])

    df = pd.DataFrame(rows)
    df['orderId'] = df['orderId'].astype(str)
    df['medicineId'] = df['medicineId'].astype(str)
    # Converted to UTC then stripped of tz info — every timestamp below is
    # kept naive-but-UTC consistently, which sidesteps a real bug this had
    # in testing: mixing tz-aware and tz-naive buckets (e.g. after
    # `.dt.to_period('M').dt.to_timestamp()`, which silently drops tz)
    # makes the monthly reindex join match nothing and silently zero out
    # every month.
    df['date'] = pd.to_datetime(df['date'], utc=True).dt.tz_localize(None)
    df['quantity'] = pd.to_numeric(df['quantity'], errors='coerce').fillna(0)
    df['price'] = pd.to_numeric(df['price'], errors='coerce').fillna(0)
    df['revenue'] = df['quantity'] * df['price']
    return df


def _reindex_series(grouped, index, key_col, revenue_col='revenue', orders_col='orders'):
    """
    Left-joins a groupby result onto a complete, gap-free date index so the
    chart on the frontend never has to explain a missing bucket — a day/
    week/month with no sales shows as a real zero, not an absent point.
    """
    grouped = grouped.set_index(key_col).reindex(index, fill_value=0)
    grouped.index.name = key_col
    return grouped.reset_index()


def build_daily_sales(df):
    today = pd.Timestamp.now(tz='UTC').tz_localize(None).normalize()
    index = pd.date_range(end=today, periods=DAILY_DAYS, freq='D')

    if df.empty:
        grouped = pd.DataFrame(columns=['bucket', 'revenue', 'orders'])
    else:
        working = df.copy()
        working['bucket'] = working['date'].dt.normalize()
        grouped = working.groupby('bucket').agg(
            revenue=('revenue', 'sum'), orders=('orderId', 'nunique')
        ).reset_index()

    grouped = _reindex_series(grouped, index, 'bucket')
    return [
        {'date': row['bucket'].strftime('%Y-%m-%d'), 'revenue': round(float(row['revenue']), 2), 'orders': int(row['orders'])}
        for _, row in grouped.iterrows()
    ]


def build_weekly_sales(df):
    today = pd.Timestamp.now(tz='UTC').tz_localize(None).normalize()
    this_week_start = today - pd.Timedelta(days=int(today.weekday()))  # Monday
    index = pd.date_range(end=this_week_start, periods=WEEKLY_WEEKS, freq='7D')

    if df.empty:
        grouped = pd.DataFrame(columns=['bucket', 'revenue', 'orders'])
    else:
        working = df.copy()
        working['bucket'] = working['date'].dt.normalize() - pd.to_timedelta(working['date'].dt.weekday, unit='D')
        grouped = working.groupby('bucket').agg(
            revenue=('revenue', 'sum'), orders=('orderId', 'nunique')
        ).reset_index()

    grouped = _reindex_series(grouped, index, 'bucket')
    return [
        {
            'weekStart': row['bucket'].strftime('%Y-%m-%d'),
            'revenue': round(float(row['revenue']), 2),
            'orders': int(row['orders']),
        }
        for _, row in grouped.iterrows()
    ]


def build_monthly_sales(df):
    today = pd.Timestamp.now(tz='UTC').tz_localize(None).normalize()
    this_month_start = today.replace(day=1)
    index = pd.date_range(end=this_month_start, periods=MONTHLY_MONTHS, freq='MS')

    if df.empty:
        grouped = pd.DataFrame(columns=['bucket', 'revenue', 'orders'])
    else:
        working = df.copy()
        working['bucket'] = working['date'].values.astype('datetime64[M]').astype('datetime64[ns]')
        grouped = working.groupby('bucket').agg(
            revenue=('revenue', 'sum'), orders=('orderId', 'nunique')
        ).reset_index()

    grouped = _reindex_series(grouped, index, 'bucket')
    return [
        {'month': row['bucket'].strftime('%Y-%m'), 'revenue': round(float(row['revenue']), 2), 'orders': int(row['orders'])}
        for _, row in grouped.iterrows()
    ]


def build_best_worst_sellers(df):
    if df.empty:
        return [], []

    by_medicine = df.groupby(['medicineId', 'name'], as_index=False).agg(
        revenue=('revenue', 'sum'), unitsSold=('quantity', 'sum')
    )
    by_medicine = by_medicine.sort_values('revenue', ascending=False)

    def to_records(rows_df):
        return [
            {
                'medicineId': row['medicineId'],
                'name': row['name'],
                'revenue': round(float(row['revenue']), 2),
                'unitsSold': int(row['unitsSold']),
            }
            for _, row in rows_df.iterrows()
        ]

    best = to_records(by_medicine.head(TOP_N))
    # Worst sellers are still drawn only from medicines that actually sold
    # something in the window — this dataframe never contains a medicine
    # with zero sales in the first place, so "worst" always means "sold the
    # least", not "never sold" (that's a different, much longer list that
    # doesn't belong under a "sales analysis" heading).
    worst = to_records(by_medicine.tail(TOP_N).sort_values('revenue', ascending=True))
    return best, worst


def build_analysis(df):
    total_revenue = round(float(df['revenue'].sum()), 2) if not df.empty else 0.0
    online_revenue = round(float(df.loc[df['channel'] == 'online', 'revenue'].sum()), 2) if not df.empty else 0.0
    pos_revenue = round(float(df.loc[df['channel'] == 'pos', 'revenue'].sum()), 2) if not df.empty else 0.0
    total_orders = int(df['orderId'].nunique()) if not df.empty else 0

    best_sellers, worst_sellers = build_best_worst_sellers(df)

    return {
        'generatedAt': datetime.now(timezone.utc),
        'lookbackDays': LOOKBACK_DAYS,
        'totalRevenue': total_revenue,
        'onlineRevenue': online_revenue,
        'posRevenue': pos_revenue,
        'totalOrders': total_orders,
        'daily': build_daily_sales(df),
        'weekly': build_weekly_sales(df),
        'monthly': build_monthly_sales(df),
        'bestSellers': best_sellers,
        'worstSellers': worst_sellers,
    }


def main():
    db = get_db()
    since = datetime.now(timezone.utc) - timedelta(days=LOOKBACK_DAYS)

    sales_df = load_sales_df(db, since)
    result = build_analysis(sales_df)

    db[RESULT_COLLECTION].insert_one(result)

    print(f"[sales_analysis] {result['generatedAt'].isoformat()} — "
          f"Rs.{result['totalRevenue']} total revenue across {result['totalOrders']} orders/sales "
          f"({len(result['bestSellers'])} best sellers, {len(result['worstSellers'])} worst sellers tracked).")


if __name__ == '__main__':
    main()
