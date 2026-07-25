"""
CSV Reports — Module 7 (Python + Pandas)

On demand only (no nightly schedule, unlike the analytics/ scripts): read
the same MongoDB the Node/Express API uses -> load medicines, online
orders, and POS sales into pandas DataFrames -> write four flat CSV
snapshots admins can download straight from the dashboard:

    Sales.csv       one row per completed sale, online + in-store combined
    Inventory.csv   full current medicine catalog (stock, price, status)
    Expiry.csv      active medicines with a known expiry date, nearest first
    Orders.csv      online orders only, with customer + delivery detail

Every run overwrites the previous CSVs in place — these are a live export
of "right now", not a history like the analytics collections, so there's
nothing to gain from keeping old copies around.

Run manually:
    python3 generate_reports.py

Triggered from the admin dashboard's "Generate Report" button, which spawns
this script as a Node subprocess (see server/controllers/reportController.js)
and waits for it to finish before offering the CSVs for download.

Environment (.env in python-service/, or the repo root — see .env.example):
    MONGO_URI  same connection string the Node server uses
"""

import os
import sys
from datetime import datetime, timezone

import pandas as pd
from dotenv import load_dotenv
from pymongo import MongoClient

# Load .env from this folder first, then fall back to the repo root, so this
# script works whether it's run standalone or alongside the Node server.
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '..', '.env'))

# Shared with server/controllers/reportController.js, which serves these
# same files back down for download — a plain project-root folder rather
# than a Mongo collection, since the whole point is a file admins can open
# outside the app (Excel, email attachment, etc.).
EXPORTS_DIR = os.path.join(os.path.dirname(__file__), '..', '..', 'reports', 'exports')

# Expiry bucket boundaries, same as analytics/expiry_analysis.py, just
# reported as a label column here instead of separate arrays.
EXPIRY_BUCKET_DAYS = (30, 60, 90)


def get_db():
    mongo_uri = os.getenv('MONGO_URI')
    if not mongo_uri:
        sys.exit('MONGO_URI is not set — copy python-service/.env.example to .env and fill it in.')
    client = MongoClient(mongo_uri)
    return client.get_default_database()


def _write_csv(df, filename):
    os.makedirs(EXPORTS_DIR, exist_ok=True)
    path = os.path.join(EXPORTS_DIR, filename)
    df.to_csv(path, index=False)
    return path


def build_sales_csv(db):
    """One row per completed sale, online orders and POS sales combined —
    cancelled orders and refunded POS sales are excluded since they never
    became real revenue."""
    online = list(db.orders.find(
        {'orderStatus': {'$ne': 'Cancelled'}},
        {'invoiceNumber': 1, 'createdAt': 1, 'items': 1, 'totalAmount': 1, 'paymentMethod': 1, 'orderStatus': 1},
    ))
    pos = list(db.possales.find(
        {'status': {'$ne': 'Refunded'}},
        {'invoiceNumber': 1, 'createdAt': 1, 'items': 1, 'totalAmount': 1, 'paymentMethod': 1, 'status': 1},
    ))

    rows = []
    for o in online:
        rows.append({
            'date': o['createdAt'],
            'channel': 'Online',
            'invoiceNumber': o['invoiceNumber'],
            'itemCount': len(o.get('items', [])),
            'totalAmount': o['totalAmount'],
            'paymentMethod': o.get('paymentMethod', ''),
            'status': o.get('orderStatus', ''),
        })
    for p in pos:
        rows.append({
            'date': p['createdAt'],
            'channel': 'POS',
            'invoiceNumber': p['invoiceNumber'],
            'itemCount': len(p.get('items', [])),
            'totalAmount': p['totalAmount'],
            'paymentMethod': p.get('paymentMethod', ''),
            'status': p.get('status', ''),
        })

    columns = ['date', 'channel', 'invoiceNumber', 'itemCount', 'totalAmount', 'paymentMethod', 'status']
    df = pd.DataFrame(rows, columns=columns)
    if not df.empty:
        df.sort_values('date', ascending=False, inplace=True)
    return df


def build_inventory_csv(db):
    """Full current catalog snapshot — every medicine, discontinued or not,
    so the export always matches what's on the shelf right now."""
    cursor = db.medicines.find(
        {},
        {
            'name': 1, 'manufacturer': 1, 'brand': 1, 'category': 1, 'stock': 1,
            'price': 1, 'isDiscontinued': 1, 'requiresPrescription': 1, 'expiryDate': 1,
        },
    )
    rows = []
    for m in cursor:
        rows.append({
            'medicineId': str(m['_id']),
            'name': m.get('name', ''),
            'manufacturer': m.get('manufacturer', ''),
            'brand': m.get('brand', ''),
            'category': m.get('category', ''),
            'stock': m.get('stock', 0),
            'price': m.get('price', ''),
            'isDiscontinued': m.get('isDiscontinued', False),
            'requiresPrescription': m.get('requiresPrescription', False),
            'expiryDate': m.get('expiryDate', ''),
        })

    columns = ['medicineId', 'name', 'manufacturer', 'brand', 'category', 'stock',
               'price', 'isDiscontinued', 'requiresPrescription', 'expiryDate']
    df = pd.DataFrame(rows, columns=columns)
    if not df.empty:
        df.sort_values('name', inplace=True)
    return df


def _expiry_bucket(days):
    if days < 0:
        return 'Expired'
    if days <= EXPIRY_BUCKET_DAYS[0]:
        return f'Within {EXPIRY_BUCKET_DAYS[0]} Days'
    if days <= EXPIRY_BUCKET_DAYS[1]:
        return f'Within {EXPIRY_BUCKET_DAYS[1]} Days'
    if days <= EXPIRY_BUCKET_DAYS[2]:
        return f'Within {EXPIRY_BUCKET_DAYS[2]} Days'
    return 'Beyond 90 Days'


def build_expiry_csv(db, now):
    """Active medicines with a known expiry date, nearest expiry first —
    same bucketing as analytics/expiry_analysis.py, flattened into one
    sortable table instead of four nested arrays."""
    cursor = db.medicines.find(
        {'isDiscontinued': {'$ne': True}, 'expiryDate': {'$ne': None}},
        {'name': 1, 'manufacturer': 1, 'stock': 1, 'expiryDate': 1},
    )
    rows = []
    for m in cursor:
        expiry = m.get('expiryDate')
        if expiry is None:
            continue
        if expiry.tzinfo is None:
            expiry = expiry.replace(tzinfo=timezone.utc)
        days = (expiry - now).days
        rows.append({
            'medicineId': str(m['_id']),
            'name': m.get('name', ''),
            'manufacturer': m.get('manufacturer', ''),
            'stock': m.get('stock', 0),
            'expiryDate': expiry,
            'daysUntilExpiry': days,
            'bucket': _expiry_bucket(days),
        })

    columns = ['medicineId', 'name', 'manufacturer', 'stock', 'expiryDate', 'daysUntilExpiry', 'bucket']
    df = pd.DataFrame(rows, columns=columns)
    if not df.empty:
        df.sort_values('daysUntilExpiry', ascending=True, inplace=True)
    return df


def build_orders_csv(db):
    """Online orders only, one row each, with the customer + delivery
    detail POS sales don't have — this is the audit-trail export for the
    storefront specifically, distinct from the cross-channel Sales.csv."""
    cursor = db.orders.aggregate([
        {'$lookup': {'from': 'users', 'localField': 'user', 'foreignField': '_id', 'as': 'customer'}},
        {'$unwind': {'path': '$customer', 'preserveNullAndEmptyArrays': True}},
        {'$project': {
            'invoiceNumber': 1, 'createdAt': 1, 'items': 1, 'totalAmount': 1,
            'paymentMethod': 1, 'paymentStatus': 1, 'orderStatus': 1,
            'customerName': '$customer.name', 'customerEmail': '$customer.email',
            'city': '$address.city', 'state': '$address.state', 'pincode': '$address.pincode',
        }},
    ])

    rows = []
    for o in cursor:
        rows.append({
            'invoiceNumber': o['invoiceNumber'],
            'orderDate': o['createdAt'],
            'customerName': o.get('customerName', ''),
            'customerEmail': o.get('customerEmail', ''),
            'itemCount': len(o.get('items', [])),
            'totalAmount': o['totalAmount'],
            'paymentMethod': o.get('paymentMethod', ''),
            'paymentStatus': o.get('paymentStatus', ''),
            'orderStatus': o.get('orderStatus', ''),
            'city': o.get('city', ''),
            'state': o.get('state', ''),
            'pincode': o.get('pincode', ''),
        })

    columns = ['invoiceNumber', 'orderDate', 'customerName', 'customerEmail', 'itemCount',
               'totalAmount', 'paymentMethod', 'paymentStatus', 'orderStatus', 'city', 'state', 'pincode']
    df = pd.DataFrame(rows, columns=columns)
    if not df.empty:
        df.sort_values('orderDate', ascending=False, inplace=True)
    return df


def main():
    db = get_db()
    now = datetime.now(timezone.utc)

    written = []
    written.append(_write_csv(build_sales_csv(db), 'Sales.csv'))
    written.append(_write_csv(build_inventory_csv(db), 'Inventory.csv'))
    written.append(_write_csv(build_expiry_csv(db, now), 'Expiry.csv'))
    written.append(_write_csv(build_orders_csv(db), 'Orders.csv'))

    print(f"[generate_reports] {now.isoformat()} — wrote {len(written)} CSVs to {EXPORTS_DIR}:")
    for path in written:
        print(f"  - {os.path.basename(path)}")


if __name__ == '__main__':
    main()
