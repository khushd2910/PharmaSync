"""
Market Basket Analysis — Association Rules (Python + Pandas + mlxtend)

Same shape as sales_analysis.py: read the same MongoDB the Node/Express API
uses -> flatten order/sale line items from BOTH channels (online Orders, POS
Sales) into one basket per order -> mine "customers who buy X also buy Y"
patterns with the Apriori algorithm (mlxtend) -> write one result document
back to Mongo. The Node admin dashboard reads that document; this script
never talks to Express directly, so it runs on its own schedule (cron, Task
Scheduler, etc.) independent of the API — same pattern as inventory/sales/
expiry analysis.

This is deliberately a different signal from the co-purchase counting
already used for MedicineDetails' "People Also Bought" row
(server/controllers/medicineController.js:getRelatedMedicines), which just
counts how many orders contain both items. Apriori/association_rules go a
step further: `support` (how common the pair is overall), `confidence`
(P(buy Y | bought X)), and `lift` (how much more likely Y is when X is
bought, versus Y's baseline popularity — lift > 1 means a genuine pairing,
not just two popular items that happen to co-occur by chance). The rules
this produces are read by getRelatedMedicines as a *ranking signal* on top
of the existing counting-based fallback — see that function's comments.

Run manually:
    python3 market_basket_analysis.py

Schedule nightly (cron, e.g. 2:45 AM — after inventory/sales/expiry):
    45 2 * * * cd /path/to/python-service && /path/to/venv/bin/python analytics/market_basket_analysis.py >> ../logs/market_basket_analysis.log 2>&1

Environment (.env in python-service/, or the repo root — see .env.example):
    MARKET_BASKET_LOOKBACK_DAYS   default 365 — how far back baskets are read
    MARKET_BASKET_MIN_SUPPORT     default 0.01 — min fraction of baskets an
                                   itemset must appear in to be "frequent"
    MARKET_BASKET_MIN_CONFIDENCE  default 0.2  — min P(consequent | antecedent)
    MARKET_BASKET_TOP_N_RULES     default 50   — rules kept in the snapshot,
                                   ranked by lift then confidence
    MARKET_BASKET_TOP_N_PAIRS     default 30   — frequent 2-item pairs kept,
                                   ranked by support (a simpler "popular
                                   combos" view alongside the full rules)
"""

import os
import sys
from datetime import datetime, timedelta, timezone
from itertools import combinations

import pandas as pd
from dotenv import load_dotenv
from pymongo import MongoClient

from snapshot_retention import ensure_snapshot_index, prune_old_snapshots

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '..', '.env'))

LOOKBACK_DAYS = int(os.getenv('MARKET_BASKET_LOOKBACK_DAYS', '365'))
MIN_SUPPORT = float(os.getenv('MARKET_BASKET_MIN_SUPPORT', '0.01'))
MIN_CONFIDENCE = float(os.getenv('MARKET_BASKET_MIN_CONFIDENCE', '0.2'))
TOP_N_RULES = int(os.getenv('MARKET_BASKET_TOP_N_RULES', '50'))
TOP_N_PAIRS = int(os.getenv('MARKET_BASKET_TOP_N_PAIRS', '30'))
RESULT_COLLECTION = 'market_basket_analysis'  # must match server/models/MarketBasketAnalysis.js


def get_db():
    mongo_uri = os.getenv('MONGO_URI')
    if not mongo_uri:
        sys.exit('MONGO_URI is not set — copy python-service/.env.example to .env and fill it in.')
    client = MongoClient(mongo_uri)
    return client.get_default_database()


def load_baskets(db, since):
    """
    One basket per order/sale — a de-duplicated list of (medicineId, name)
    pairs actually bought together, pooled from both channels the same way
    sales_analysis.load_sales_df() does. Quantity doesn't matter for market
    basket analysis (it only cares whether an item is IN the basket), so
    this collapses straight to presence/absence per item, unlike the
    revenue-flattening in sales_analysis.py.
    """
    online = db.orders.aggregate([
        {'$match': {'orderStatus': {'$ne': 'Cancelled'}, 'createdAt': {'$gte': since}}},
        {'$project': {'_id': 0, 'basketId': {'$toString': '$_id'}, 'items': 1}},
    ])
    pos = db.possales.aggregate([
        {'$match': {'status': {'$ne': 'Refunded'}, 'createdAt': {'$gte': since}}},
        {'$project': {'_id': 0, 'basketId': {'$toString': '$_id'}, 'items': 1}},
    ])

    baskets = []
    id_to_name = {}
    for doc in list(online) + list(pos):
        seen = {}
        for item in doc.get('items') or []:
            medicine_id = item.get('medicine')
            name = item.get('name')
            if medicine_id is None or not name:
                continue
            medicine_id = str(medicine_id)
            seen[medicine_id] = name
            id_to_name.setdefault(medicine_id, name)
        if len(seen) >= 2:  # single-item baskets carry no pairing signal
            baskets.append({'basketId': doc['basketId'], 'items': list(seen.keys())})

    return baskets, id_to_name


def _label(medicine_id, id_to_name):
    return {'medicineId': medicine_id, 'name': id_to_name.get(medicine_id, medicine_id)}


def build_top_pairs(baskets, id_to_name, total_baskets):
    """
    Every 2-item combination actually present in a basket, ranked by
    support (fraction of baskets containing both) — a simpler "popular
    combos" list to sit alongside the full antecedent -> consequent rules
    below, useful for a quick "what pairs get bought together most often"
    glance without needing to reason about confidence/lift.
    """
    if total_baskets == 0:
        return []

    pair_counts = {}
    for basket in baskets:
        for a, b in combinations(sorted(basket['items']), 2):
            pair_counts[(a, b)] = pair_counts.get((a, b), 0) + 1

    pairs = [
        {
            'itemA': _label(a, id_to_name),
            'itemB': _label(b, id_to_name),
            'count': count,
            'support': round(count / total_baskets, 4),
        }
        for (a, b), count in pair_counts.items()
    ]
    pairs.sort(key=lambda p: p['support'], reverse=True)
    return pairs[:TOP_N_PAIRS]


def build_association_rules(baskets, id_to_name):
    """
    Runs mlxtend's Apriori over the one-hot-encoded basket matrix, then
    mines association rules from the frequent itemsets it finds. Returns
    an empty list rather than raising whenever there isn't enough data to
    mine anything meaningful (mlxtend's apriori() just returns an empty
    DataFrame in that case, and association_rules() errors on an empty
    frequent-itemsets input) — a fresh/lightly-used catalog shouldn't crash
    the admin page, it should just say "not enough data yet".
    """
    if not baskets:
        return []

    from mlxtend.frequent_patterns import apriori, association_rules
    from mlxtend.preprocessing import TransactionEncoder

    transactions = [basket['items'] for basket in baskets]
    encoder = TransactionEncoder()
    encoded = encoder.fit(transactions).transform(transactions)
    one_hot = pd.DataFrame(encoded, columns=encoder.columns_)

    frequent_itemsets = apriori(one_hot, min_support=MIN_SUPPORT, use_colnames=True)
    if frequent_itemsets.empty:
        return []

    try:
        rules = association_rules(frequent_itemsets, metric='lift', min_threshold=1.0, num_itemsets=len(one_hot))
    except TypeError:
        # num_itemsets was only added in newer mlxtend; older pinned
        # versions don't accept it.
        rules = association_rules(frequent_itemsets, metric='lift', min_threshold=1.0)

    if rules.empty:
        return []

    rules = rules[rules['confidence'] >= MIN_CONFIDENCE]
    # Only single-item -> single-item rules are surfaced to the admin UI /
    # "People Also Bought" — "if X and Y then Z" is real information but
    # multi-item antecedents don't map onto a single "you bought this,
    # here's what to add" card, so they're left out of this snapshot.
    rules = rules[(rules['antecedents'].apply(len) == 1) & (rules['consequents'].apply(len) == 1)]
    rules = rules.sort_values(['lift', 'confidence'], ascending=False)

    records = []
    for _, row in rules.head(TOP_N_RULES).iterrows():
        antecedent_id = next(iter(row['antecedents']))
        consequent_id = next(iter(row['consequents']))
        records.append({
            'antecedents': [_label(antecedent_id, id_to_name)],
            'consequents': [_label(consequent_id, id_to_name)],
            'support': round(float(row['support']), 4),
            'confidence': round(float(row['confidence']), 4),
            'lift': round(float(row['lift']), 4),
        })
    return records


def build_analysis(baskets, id_to_name):
    total_baskets = len(baskets)
    avg_basket_size = (
        round(sum(len(b['items']) for b in baskets) / total_baskets, 2) if total_baskets else 0.0
    )

    return {
        'generatedAt': datetime.now(timezone.utc),
        'lookbackDays': LOOKBACK_DAYS,
        'minSupport': MIN_SUPPORT,
        'minConfidence': MIN_CONFIDENCE,
        'totalBaskets': total_baskets,
        'avgBasketSize': avg_basket_size,
        'topPairs': build_top_pairs(baskets, id_to_name, total_baskets),
        'rules': build_association_rules(baskets, id_to_name),
    }


def main():
    db = get_db()
    since = datetime.now(timezone.utc) - timedelta(days=LOOKBACK_DAYS)

    baskets, id_to_name = load_baskets(db, since)
    result = build_analysis(baskets, id_to_name)

    collection = db[RESULT_COLLECTION]
    ensure_snapshot_index(collection)
    collection.insert_one(result)
    pruned = prune_old_snapshots(collection)

    print(f"[market_basket_analysis] {result['generatedAt'].isoformat()} — "
          f"{result['totalBaskets']} multi-item baskets, "
          f"{len(result['rules'])} rules, {len(result['topPairs'])} top pairs."
          + (f" Pruned {pruned} old snapshot(s)." if pruned else ""))


if __name__ == '__main__':
    main()
