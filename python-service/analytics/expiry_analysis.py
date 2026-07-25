"""
Expiry Analysis — Module 6 (Python + Pandas)

Every night: read the same MongoDB the Node/Express API uses -> load active
medicines that have a known expiryDate into a pandas DataFrame -> bucket
them into Expiring in 30 / 60 / 90 Days (plus Already Expired) -> write one
result document back to Mongo. The Node admin dashboard reads that document
and raises a notification when there's anything urgent; this script never
talks to Express directly, so it can run completely on its own schedule
(cron, Task Scheduler, etc.) without the API needing to be involved.

Run manually:
    python3 expiry_analysis.py

Schedule nightly (cron, e.g. 2:00 AM):
    0 2 * * * cd /path/to/python-service && /path/to/venv/bin/python analytics/expiry_analysis.py >> ../logs/expiry_analysis.log 2>&1

Environment (.env in python-service/, or the repo root — see .env.example):
    MONGO_URI          same connection string the Node server uses
    EXPIRY_ALERT_DAYS  default 30  (the "urgent" bucket that triggers a dashboard notification)

Note: this script's own 30/60/90-day buckets are independent of
server/utils/inventoryConstants.js's EXPIRY_WINDOW_DAYS, which only drives
the single "Expiring Soon" counter on the dashboard overview cards. This
module needs three separate windows, not one, so it defines its own here.
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

# The bucket boundaries the dashboard groups medicines into. Fixed at
# 30/60/90 by design (see docs/project_brief.md, Module 6) rather than a
# single configurable window like LOW_STOCK_THRESHOLD.
BUCKET_DAYS = (30, 60, 90)

# Items expiring within this many days (or already expired) are urgent
# enough to raise a dashboard notification, not just appear in a list.
EXPIRY_ALERT_DAYS = int(os.getenv('EXPIRY_ALERT_DAYS', '30'))

RESULT_COLLECTION = 'expiry_analysis'  # must match server/models/ExpiryAnalysis.js


def get_db():
    mongo_uri = os.getenv('MONGO_URI')
    if not mongo_uri:
        sys.exit('MONGO_URI is not set — copy python-service/.env.example to .env and fill it in.')
    client = MongoClient(mongo_uri)
    return client.get_default_database()


def load_medicines_df(db):
    """Active medicines that have a known expiry date set — items with no
    expiryDate on file can't be analyzed for expiry, so they're excluded
    rather than silently treated as "never expiring"."""
    cursor = db.medicines.find(
        {'isDiscontinued': {'$ne': True}, 'expiryDate': {'$ne': None}},
        {'name': 1, 'stock': 1, 'expiryDate': 1, 'manufacturer': 1},
    )
    rows = list(cursor)
    if not rows:
        return pd.DataFrame(columns=['_id', 'name', 'stock', 'expiryDate'])

    df = pd.DataFrame(rows)
    df['stock'] = pd.to_numeric(df['stock'], errors='coerce').fillna(0)
    df['expiryDate'] = pd.to_datetime(df['expiryDate'], utc=True, errors='coerce')
    df = df.dropna(subset=['expiryDate'])
    return df


def build_analysis(medicines_df, now):
    def days_until(expiry):
        return (expiry - now).days

    if medicines_df.empty:
        medicines_df = medicines_df.assign(daysUntilExpiry=[])
    else:
        medicines_df = medicines_df.copy()
        medicines_df['daysUntilExpiry'] = medicines_df['expiryDate'].apply(days_until)

    def to_records(df):
        return [
            {
                'medicineId': str(row['_id']),
                'name': row['name'],
                'stock': int(row['stock']),
                'expiryDate': row['expiryDate'].to_pydatetime(),
                'daysUntilExpiry': int(row['daysUntilExpiry']),
            }
            for _, row in df.sort_values('daysUntilExpiry', ascending=True).iterrows()
        ]

    expired_df = medicines_df[medicines_df['daysUntilExpiry'] < 0]
    within_30_df = medicines_df[(medicines_df['daysUntilExpiry'] >= 0) & (medicines_df['daysUntilExpiry'] <= BUCKET_DAYS[0])]
    within_60_df = medicines_df[(medicines_df['daysUntilExpiry'] > BUCKET_DAYS[0]) & (medicines_df['daysUntilExpiry'] <= BUCKET_DAYS[1])]
    within_90_df = medicines_df[(medicines_df['daysUntilExpiry'] > BUCKET_DAYS[1]) & (medicines_df['daysUntilExpiry'] <= BUCKET_DAYS[2])]

    # Urgent = already expired, or expiring inside the alert window — this
    # count is what drives the dashboard notification badge.
    alert_count = int(len(expired_df) + len(medicines_df[(medicines_df['daysUntilExpiry'] >= 0) & (medicines_df['daysUntilExpiry'] <= EXPIRY_ALERT_DAYS)]))

    return {
        'generatedAt': now,
        'expiryAlertDays': EXPIRY_ALERT_DAYS,
        'bucketDays': list(BUCKET_DAYS),
        'totalTracked': int(len(medicines_df)),
        'alertCount': alert_count,
        'expired': to_records(expired_df),
        'expiringIn30': to_records(within_30_df),
        'expiringIn60': to_records(within_60_df),
        'expiringIn90': to_records(within_90_df),
    }


def main():
    db = get_db()
    now = datetime.now(timezone.utc)

    medicines_df = load_medicines_df(db)
    result = build_analysis(medicines_df, now)

    db[RESULT_COLLECTION].insert_one(result)

    print(f"[expiry_analysis] {result['generatedAt'].isoformat()} — "
          f"{result['totalTracked']} medicines tracked, {len(result['expired'])} already expired, "
          f"{len(result['expiringIn30'])} expiring within 30 days, {len(result['expiringIn60'])} within 60, "
          f"{len(result['expiringIn90'])} within 90 — {result['alertCount']} urgent alert(s).")


if __name__ == '__main__':
    main()
