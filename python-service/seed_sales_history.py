"""
seed_sales_history.py — Populates realistic historical POS sales and online orders
for all 1,150 medicines to power full analytics, ABC Pareto classification,
KMeans segmentation, Isolation Forest anomaly detection, price sensitivity,
discount optimization, demand forecasting, and revenue forecasting.
"""

import os
import random
from datetime import datetime, timedelta, timezone
from bson import ObjectId
import numpy as np
import pandas as pd
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

def get_db():
    mongo_uri = os.getenv('MONGO_URI')
    if not mongo_uri:
        raise RuntimeError("MONGO_URI is not set.")
    client = MongoClient(mongo_uri)
    return client.get_default_database()

def seed_sales():
    db = get_db()
    print("Fetching active medicines...")
    cursor = list(db.medicines.find({}, {'_id': 1, 'name': 1, 'price': 1, 'category': 1, 'discountPercent': 1}))
    if not cursor:
        print("No medicines found!")
        return

    print(f"Found {len(cursor)} medicines.")

    # Find a dummy user ID if available
    user_doc = db.users.find_one()
    dummy_user_id = user_doc['_id'] if user_doc else ObjectId()

    random.seed(42)
    np.random.seed(42)

    shuffled_meds = list(cursor)
    random.shuffle(shuffled_meds)

    n = len(shuffled_meds)
    n_star = int(n * 0.15)
    n_steady = int(n * 0.30)
    n_slow = int(n * 0.40)

    star_meds = shuffled_meds[:n_star]
    steady_meds = shuffled_meds[n_star:n_star + n_steady]
    slow_meds = shuffled_meds[n_star + n_steady:n_star + n_steady + n_slow]

    now = datetime.now(timezone.utc)
    
    orders_to_insert = []
    pos_sales_to_insert = []

    print("Generating 180-day sales history...")

    order_counter = 10001
    pos_counter = 10001

    for day_offset in range(180, -1, -1):
        day_date = now - timedelta(days=day_offset)

        is_weekend = day_date.weekday() in (5, 6)
        num_pos_tx = random.randint(15, 25) if is_weekend else random.randint(10, 18)
        num_online_orders = random.randint(10, 18) if is_weekend else random.randint(5, 12)

        # POS sales transactions
        for _ in range(num_pos_tx):
            items_count = random.randint(1, 4)
            tx_items = []
            total = 0.0

            for _ in range(items_count):
                r = random.random()
                if r < 0.60:
                    med = random.choice(star_meds)
                    qty = random.randint(2, 8)
                elif r < 0.90:
                    med = random.choice(steady_meds)
                    qty = random.randint(1, 4)
                else:
                    med = random.choice(slow_meds)
                    qty = random.randint(1, 2)

                price = float(med.get('price', 50.0))
                discount = float(med.get('discountPercent', 0.0))
                effective_price = max(1.0, round(price * (1.0 - discount / 100.0), 2))

                tx_items.append({
                    'medicine': med['_id'],
                    'name': med.get('name', 'Medicine'),
                    'quantity': qty,
                    'price': effective_price
                })
                total += qty * effective_price

            pos_sales_to_insert.append({
                'invoiceNumber': f"POS-{pos_counter}",
                'receiptNumber': f"POS-{pos_counter}",
                'items': tx_items,
                'totalAmount': round(total, 2),
                'status': 'Completed',
                'paymentMethod': random.choice(['Cash', 'UPI', 'Card']),
                'createdAt': day_date + timedelta(hours=random.randint(8, 20), minutes=random.randint(0, 59))
            })

            pos_counter += 1

        # Online orders
        for _ in range(num_online_orders):
            items_count = random.randint(1, 3)
            tx_items = []
            total = 0.0

            for _ in range(items_count):
                r = random.random()
                if r < 0.65:
                    med = random.choice(star_meds)
                    qty = random.randint(1, 5)
                elif r < 0.92:
                    med = random.choice(steady_meds)
                    qty = random.randint(1, 3)
                else:
                    med = random.choice(slow_meds)
                    qty = 1

                price = float(med.get('price', 50.0))
                discount = float(med.get('discountPercent', 0.0))
                effective_price = max(1.0, round(price * (1.0 - discount / 100.0), 2))

                tx_items.append({
                    'medicine': med['_id'],
                    'name': med.get('name', 'Medicine'),
                    'quantity': qty,
                    'price': effective_price
                })
                total += qty * effective_price

            orders_to_insert.append({
                'invoiceNumber': f"ORD-{order_counter}",
                'user': dummy_user_id,
                'items': tx_items,
                'totalAmount': round(total, 2),
                'orderStatus': 'Delivered',
                'paymentStatus': 'Paid',
                'shippingAddress': {
                    'street': '123 Healthcare Ave',
                    'city': 'Mumbai',
                    'state': 'Maharashtra',
                    'zipCode': '400001'
                },
                'createdAt': day_date + timedelta(hours=random.randint(0, 23), minutes=random.randint(0, 59))
            })
            order_counter += 1

    print("Clearing old orders and pos sales...")
    db.orders.delete_many({})
    db.possales.delete_many({})

    print(f"Inserting {len(orders_to_insert)} online orders...")
    if orders_to_insert:
        db.orders.insert_many(orders_to_insert)

    print(f"Inserting {len(pos_sales_to_insert)} POS transactions...")
    if pos_sales_to_insert:
        db.possales.insert_many(pos_sales_to_insert)

    print("Sales history seeding complete!")

if __name__ == '__main__':
    seed_sales()
