"""
Inventory Analysis — Module 4 (Python + Pandas)

Every night: read the same MongoDB the Node/Express API uses -> load
medicines + recent sales into pandas DataFrames -> calculate Total Stock,
Low Stock, Fast Selling, and Slow Selling -> write one result document back
to Mongo. The Node admin dashboard reads that document; this script never
talks to Express directly, so it can run completely on its own schedule
(cron, Task Scheduler, etc.) without the API needing to be involved.

Run manually:
    python3 inventory_analysis.py

Schedule nightly (cron, e.g. 2:00 AM):
    0 2 * * * cd /path/to/python-service && /path/to/venv/bin/python analytics/inventory_analysis.py >> ../logs/inventory_analysis.log 2>&1

Environment (.env in python-service/, or the repo root — see .env.example):
    MONGO_URI            same connection string the Node server uses
    LOW_STOCK_THRESHOLD  default 10  (kept in sync with server/utils/inventoryConstants.js — see note below)
    SALES_LOOKBACK_DAYS  default 30
    FAST_SLOW_TOP_N       default 10
"""

import os
import sys
from datetime import datetime, timedelta, timezone

import pandas as pd
from dotenv import load_dotenv
from pymongo import MongoClient

# Load .env from this folder first, then fall back to the repo root, so this
# script works whether it's run standalone or alongside the Node server.
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '..', '.env'))

# NOTE on LOW_STOCK_THRESHOLD: the Node side defines this in
# server/utils/inventoryConstants.js. There's no code sharing across the
# Node/Python boundary, so this value can drift from that one if either
# side changes without the other — keep them in sync by hand, or override
# both from the same environment variable in your deployment.
LOW_STOCK_THRESHOLD = int(os.getenv('LOW_STOCK_THRESHOLD', '10'))
SALES_LOOKBACK_DAYS = int(os.getenv('SALES_LOOKBACK_DAYS', '30'))
FAST_SLOW_TOP_N = int(os.getenv('FAST_SLOW_TOP_N', '10'))
RESULT_COLLECTION = 'inventory_analysis'  # must match server/models/InventoryAnalysis.js


def get_db():
    mongo_uri = os.getenv('MONGO_URI')
    if not mongo_uri:
        sys.exit('MONGO_URI is not set — copy python-service/.env.example to .env and fill it in.')
    client = MongoClient(mongo_uri)
    return client.get_default_database()


def load_medicines_df(db):
    cursor = db.medicines.find(
        {},
        {'name': 1, 'stock': 1, 'isDiscontinued': 1, 'category': 1, 'manufacturer': 1},
    )
    rows = list(cursor)
    if not rows:
        return pd.DataFrame(columns=['_id', 'name', 'stock', 'isDiscontinued', 'category', 'manufacturer'])

    df = pd.DataFrame(rows)
    df['isDiscontinued'] = df.get('isDiscontinued', False).fillna(False)
    df['stock'] = pd.to_numeric(df['stock'], errors='coerce').fillna(0)
    return df


def load_units_sold_df(db, since):
    """
    Flattens order/sale line items from BOTH channels (online Orders, minus
    Cancelled; POS Sales, minus Refunded) within the lookback window into a
    single (medicine, quantity) table, then groups it into unitsSold per
    medicine. This is what "Fast Selling" / "Slow Selling" are measured
    against — total *movement*, not revenue.
    """
    online_items = db.orders.aggregate([
        {'$match': {'orderStatus': {'$ne': 'Cancelled'}, 'createdAt': {'$gte': since}}},
        {'$unwind': '$items'},
        {'$project': {'medicine': '$items.medicine', 'quantity': '$items.quantity'}},
    ])
    pos_items = db.possales.aggregate([
        {'$match': {'status': {'$ne': 'Refunded'}, 'createdAt': {'$gte': since}}},
        {'$unwind': '$items'},
        {'$project': {'medicine': '$items.medicine', 'quantity': '$items.quantity'}},
    ])

    rows = list(online_items) + list(pos_items)
    if not rows:
        return pd.DataFrame(columns=['_id', 'unitsSold'])

    df = pd.DataFrame(rows)
    grouped = df.groupby('medicine', as_index=False)['quantity'].sum()
    grouped.rename(columns={'medicine': '_id', 'quantity': 'unitsSold'}, inplace=True)
    return grouped


def build_analysis(medicines_df, sales_df):
    merged = medicines_df.merge(sales_df, on='_id', how='left')
    merged['unitsSold'] = merged['unitsSold'].fillna(0)

    active = merged[merged['isDiscontinued'] == False]  # noqa: E712 (pandas boolean mask)

    total_stock_units = int(active['stock'].sum())
    total_medicines = int(len(merged))

    low_stock_df = (
        active[active['stock'] <= LOW_STOCK_THRESHOLD]
        .sort_values('stock', ascending=True)
        .head(20)
    )

    fast_selling_df = (
        active[active['unitsSold'] > 0]
        .sort_values('unitsSold', ascending=False)
        .head(FAST_SLOW_TOP_N)
    )

    # Slow selling = still in stock (so it's actually available to sell) but
    # moved little or nothing in the window. Out-of-stock items are excluded
    # here — zero movement because there's nothing to sell isn't the same
    # problem as zero movement while sitting on the shelf.
    slow_selling_df = (
        active[(active['stock'] > 0) & (active['unitsSold'] <= 1)]
        .sort_values(['unitsSold', 'stock'], ascending=[True, False])
        .head(FAST_SLOW_TOP_N)
    )

    def to_records(df):
        return [
            {
                'medicineId': str(row['_id']),
                'name': row['name'],
                'stock': int(row['stock']),
                'unitsSold': int(row['unitsSold']),
            }
            for _, row in df.iterrows()
        ]

    return {
        'generatedAt': datetime.now(timezone.utc),
        'lookbackDays': SALES_LOOKBACK_DAYS,
        'lowStockThreshold': LOW_STOCK_THRESHOLD,
        'totalMedicines': total_medicines,
        'totalStockUnits': total_stock_units,
        'lowStock': to_records(low_stock_df),
        'fastSelling': to_records(fast_selling_df),
        'slowSelling': to_records(slow_selling_df),
    }


def main():
    db = get_db()
    since = datetime.now(timezone.utc) - timedelta(days=SALES_LOOKBACK_DAYS)

    medicines_df = load_medicines_df(db)
    sales_df = load_units_sold_df(db, since)
    result = build_analysis(medicines_df, sales_df)

    db[RESULT_COLLECTION].insert_one(result)

    print(f"[inventory_analysis] {result['generatedAt'].isoformat()} — "
          f"{result['totalMedicines']} medicines, {result['totalStockUnits']} units in stock, "
          f"{len(result['lowStock'])} low-stock, {len(result['fastSelling'])} fast-selling, "
          f"{len(result['slowSelling'])} slow-selling.")


if __name__ == '__main__':
    main()
