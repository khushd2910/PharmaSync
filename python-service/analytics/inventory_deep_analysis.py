"""
Deep Inventory Analysis — AI/ML-powered follow-on to Module 4.

inventory_analysis.py answers "what's low, what's fast, what's slow right
now". This module goes several layers deeper on the same underlying data
(medicines + 90 days of order/POS line items) and answers the questions an
actual inventory manager needs for *decisions*, not just a snapshot:

  1. ABC (Pareto) classification  — which medicines actually drive revenue,
     so purchasing/attention effort is spent where it matters (classic
     80/15/5 inventory-control technique).
  2. Reorder point, safety stock, and EOQ — textbook inventory-management
     formulas (demand during lead time + a statistical safety buffer sized
     off demand variability; Wilson's Economic Order Quantity for how much
     to order), computed per medicine from its own sales history rather
     than one flat threshold for the whole catalog.
  3. Inventory turnover & days-of-supply — how efficiently stock is moving,
     and a plain-English "you'll run out in N days" figure.
  4. KMeans clustering (scikit-learn, unsupervised ML) — segments the whole
     catalog into behavioural groups (Star Performers / Steady Movers /
     Slow Movers / Dead-or-At-Risk Stock) from *multiple* standardized
     features at once, rather than one manually-picked threshold. This is
     genuinely different information from a "sort by units sold" list —
     it's grouping medicines that behave alike across demand level,
     demand volatility, and how efficiently their stock turns over.
  5. Isolation Forest (scikit-learn, unsupervised anomaly detection) — flags
     medicines whose stocking pattern looks statistically unusual against
     the rest of the catalog (e.g. carrying months of stock for something
     that barely sells, or wildly erratic day-to-day demand), the same
     algorithm used for fraud/outlier detection, applied here to inventory
     behaviour instead.

Deliberately a separate collection/script from inventory_analysis.py (not
a rewrite of it) — that one is cheap and safe to run nightly for everyone;
this one trains two ML models per run and is meant to be triggered
on-demand from the admin "Inventory Analysis" page.

Run manually:
    python3 inventory_deep_analysis.py

Environment (.env in python-service/, or the repo root):
    INVENTORY_DEEP_LOOKBACK_DAYS   default 90   — sales history window
    INVENTORY_LEAD_TIME_DAYS       default 5    — assumed supplier lead time
    INVENTORY_SERVICE_LEVEL_Z      default 1.65 — ~95% service level z-score
    INVENTORY_ORDERING_COST        default 50   — ₹ cost to place one order (EOQ)
    INVENTORY_HOLDING_COST_RATE    default 0.20 — annual holding cost as a
                                                   fraction of unit price (EOQ)

These lead-time/cost assumptions aren't observable from the data on hand
(no supplier/PO records exist yet in this project), so they're config
values rather than hidden magic numbers — override them via env if your
real numbers differ.
"""

import os
import sys
from datetime import datetime, timedelta, timezone

import numpy as np
import pandas as pd
from dotenv import load_dotenv
from pymongo import MongoClient

sys.path.insert(0, os.path.dirname(__file__))
from model_registry import save_model, load_model, is_stale
from ml_config import (
    KMEANS_N_CLUSTERS,
    KMEANS_RANDOM_STATE,
    KMEANS_N_INIT,
    KMEANS_MODEL_NAME,
    ISOLATION_FOREST_CONTAMINATION,
    ISOLATION_FOREST_N_ESTIMATORS,
    ISOLATION_FOREST_RANDOM_STATE,
    ISOLATION_FOREST_MODEL_NAME,
)
from snapshot_retention import ensure_snapshot_index, prune_old_snapshots

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '..', '.env'))

MAX_MODEL_AGE_HOURS = 24
LOOKBACK_DAYS = int(os.getenv('INVENTORY_DEEP_LOOKBACK_DAYS', '90'))

LEAD_TIME_DAYS = int(os.getenv('INVENTORY_LEAD_TIME_DAYS', '5'))
SERVICE_LEVEL_Z = float(os.getenv('INVENTORY_SERVICE_LEVEL_Z', '1.65'))
ORDERING_COST = float(os.getenv('INVENTORY_ORDERING_COST', '50'))
HOLDING_COST_RATE = float(os.getenv('INVENTORY_HOLDING_COST_RATE', '0.20'))
RESULT_COLLECTION = 'inventory_deep_analysis'

SEGMENT_LABELS = ['Star Performers', 'Steady Movers', 'Slow Movers', 'Dead / At-Risk Stock']


def get_db():
    mongo_uri = os.getenv('MONGO_URI')
    if not mongo_uri:
        sys.exit('MONGO_URI is not set — copy python-service/.env.example to .env and fill it in.')
    client = MongoClient(mongo_uri)
    return client.get_default_database()


def load_medicines_df(db):
    cursor = db.medicines.find(
        {},
        {
            'name': 1,
            'price': 1,
            'stock': 1,
            'category': 1,
            'isDiscontinued': 1,
            'expiryDate': 1,
            'discountPercent': 1,
        },
    )
    rows = list(cursor)
    if not rows:
        return pd.DataFrame(columns=['_id', 'name', 'price', 'stock', 'category', 'isDiscontinued', 'expiryDate', 'discountPercent'])

    df = pd.DataFrame(rows)
    df['isDiscontinued'] = df.get('isDiscontinued', False).fillna(False)
    df['price'] = pd.to_numeric(df.get('price'), errors='coerce').fillna(0.0)
    df['stock'] = pd.to_numeric(df['stock'], errors='coerce').fillna(0)
    df['discountPercent'] = pd.to_numeric(df.get('discountPercent'), errors='coerce').fillna(0.0)
    df['category'] = df.get('category').fillna('Uncategorized') if 'category' in df else 'Uncategorized'
    return df


def load_sales_line_items(db, since):
    """
    Same flattening pattern as sales_analysis.py / demand_forecasting.py:
    one row per line item across both channels, keeping each item's own
    price snapshot (not a live join) so revenue reflects what was actually
    charged at the time of sale.
    """
    online_rows = list(db.orders.aggregate([
        {'$match': {'orderStatus': {'$ne': 'Cancelled'}, 'createdAt': {'$gte': since}}},
        {'$unwind': '$items'},
        {'$project': {
            '_id': 0, 'date': '$createdAt', 'medicineId': '$items.medicine',
            'name': '$items.name', 'quantity': '$items.quantity', 'price': '$items.price',
        }},
    ]))
    pos_rows = list(db.possales.aggregate([
        {'$match': {'status': {'$ne': 'Refunded'}, 'createdAt': {'$gte': since}}},
        {'$unwind': '$items'},
        {'$project': {
            '_id': 0, 'date': '$createdAt', 'medicineId': '$items.medicine',
            'name': '$items.name', 'quantity': '$items.quantity', 'price': '$items.price',
        }},
    ]))

    rows = online_rows + pos_rows
    if not rows:
        return pd.DataFrame(columns=['date', 'medicineId', 'name', 'quantity', 'price'])

    df = pd.DataFrame(rows)
    df['medicineId'] = df['medicineId'].astype(str)
    df['name'] = df['name'].fillna('').astype(str).str.strip()
    df['date'] = pd.to_datetime(df['date'], utc=True).dt.tz_localize(None)
    df['quantity'] = pd.to_numeric(df['quantity'], errors='coerce').fillna(0)
    df['price'] = pd.to_numeric(df['price'], errors='coerce').fillna(0.0)
    df['revenue'] = df['quantity'] * df['price']
    return df


def _per_medicine_demand_stats(sales_df, medicine_ids, date_index):
    """
    Builds a complete (medicine x day) grid — reindexing missing days to
    zero — so mean/std reflect true daily demand including the zero-sale
    days, not just the days something happened to sell. That zero-filled
    std dev is what safety stock is sized off; skipping the zero days would
    understate real variability.

    Returns a DataFrame indexed by medicineId with unitsSold, revenue,
    avgDailyDemand, demandStdDev.
    """
    if sales_df.empty or not medicine_ids:
        empty = pd.DataFrame(
            {'medicineId': medicine_ids, 'unitsSold': 0.0, 'revenue': 0.0, 'avgDailyDemand': 0.0, 'demandStdDev': 0.0}
        )
        return empty.set_index('medicineId')

    sales_df = sales_df.copy()
    if 'medicineId' not in sales_df.columns and 'medicine' in sales_df.columns:
        sales_df['medicineId'] = sales_df['medicine']
    if 'quantity' not in sales_df.columns and 'unitsSold' in sales_df.columns:
        sales_df['quantity'] = sales_df['unitsSold']
    if 'price' not in sales_df.columns:
        sales_df['price'] = 0.0
    if 'revenue' not in sales_df.columns:
        sales_df['revenue'] = pd.to_numeric(sales_df['quantity'], errors='coerce').fillna(0.0) * pd.to_numeric(sales_df['price'], errors='coerce').fillna(0.0)
    if 'date' not in sales_df.columns:
        sales_df['date'] = pd.Timestamp.utcnow()

    grouped = sales_df.groupby('medicineId')
    stats = []
    for med_id in medicine_ids:
        if med_id not in grouped.groups:
            stats.append({'medicineId': med_id, 'unitsSold': 0.0, 'revenue': 0.0, 'avgDailyDemand': 0.0, 'demandStdDev': 0.0})
            continue
        med_df = grouped.get_group(med_id)
        daily = med_df.groupby(med_df['date'].dt.date)['quantity'].sum().reindex(date_index.date, fill_value=0.0)
        stats.append({
            'medicineId': med_id,
            'unitsSold': float(med_df['quantity'].sum()),
            'revenue': float(med_df['revenue'].sum()),
            'avgDailyDemand': float(daily.mean()),
            'demandStdDev': float(daily.std(ddof=0)),
        })
    return pd.DataFrame(stats).set_index('medicineId')


def _classify_abc(df):
    """
    Classic ABC / Pareto inventory classification: rank medicines by
    revenue contribution, then bucket by *cumulative* share of total
    revenue — A = the top slice that together drives 80% of revenue,
    B = the next slice up to 95%, C = the long tail. Medicines with zero
    revenue in the window (never sold, or brand new) fall out of the
    ranking entirely and are labeled 'N' (no movement) rather than forced
    into C, since "no data" and "confirmed low-value" aren't the same
    thing.
    """
    ranked = df[df['revenue'] > 0].sort_values('revenue', ascending=False).copy()
    total_revenue = ranked['revenue'].sum()

    if total_revenue <= 0 or ranked.empty:
        df['abcClass'] = 'N'
        return df

    ranked['cumShare'] = ranked['revenue'].cumsum() / total_revenue

    def bucket(share):
        if share <= 0.80:
            return 'A'
        if share <= 0.95:
            return 'B'
        return 'C'

    ranked['abcClass'] = ranked['cumShare'].apply(bucket)
    df = df.merge(ranked[['abcClass']], left_index=True, right_index=True, how='left')
    df['abcClass'] = df['abcClass'].fillna('N')
    return df


def _segment_with_kmeans(df):
    """
    Unsupervised ML segmentation. Features are standardized (zero mean,
    unit variance) so no single feature — e.g. raw units sold, which can
    be two orders of magnitude bigger than turnover ratio — dominates the
    distance metric KMeans clusters on. 4 clusters are requested to match
    the 4 SEGMENT_LABELS; clusters are then *ranked* by their centroid's
    average daily demand and turnover (not arbitrary cluster index 0-3,
    which KMeans assigns in no meaningful order) and mapped onto those
    labels from best to worst performing.

    Falls back to a simple rule-based segment (skipping the ML step) when
    the catalog is too small for 4 meaningful clusters or scikit-learn
    isn't importable — a tiny catalog doesn't have enough data for
    clustering to mean anything anyway.
    """
    try:
        from sklearn.cluster import KMeans
        from sklearn.preprocessing import StandardScaler
    except ImportError:
        df['segment'] = df.apply(_rule_based_segment, axis=1)
        return df, False

    n_samples = len(df)
    n_clusters = min(KMEANS_N_CLUSTERS, n_samples)
    if n_clusters < 2:
        df['segment'] = df.apply(_rule_based_segment, axis=1)
        return df, False

    features = df[['avgDailyDemand', 'demandVariability', 'turnoverRatio']].fillna(0.0)

    # Reuse the saved (scaler, model) pair if it's still fresh and was
    # fit for the same number of clusters this catalog size needs;
    # otherwise fit fresh on today's catalog and save the result.
    saved, meta = load_model(KMEANS_MODEL_NAME)
    reuse = (
        saved is not None
        and not is_stale(meta, MAX_MODEL_AGE_HOURS)
        and meta.get('n_clusters') == n_clusters
    )
    if reuse:
        scaler, model = saved
        scaled = scaler.transform(features)
        labels = model.predict(scaled)
    else:
        scaler = StandardScaler()
        scaled = scaler.fit_transform(features)
        model = KMeans(n_clusters=n_clusters, random_state=KMEANS_RANDOM_STATE, n_init=KMEANS_N_INIT)
        labels = model.fit_predict(scaled)

        save_model(KMEANS_MODEL_NAME, (scaler, model), {
            'n_clusters': n_clusters,
            'catalog_size': n_samples,
        })

    df = df.copy()
    df['_cluster'] = labels

    # Rank clusters best -> worst by a composite of demand level and
    # turnover, then map onto SEGMENT_LABELS in that order.
    cluster_rank = (
        df.groupby('_cluster')
        .apply(lambda g: g['avgDailyDemand'].mean() + g['turnoverRatio'].mean())
        .sort_values(ascending=False)
    )
    labels_for_rank = SEGMENT_LABELS[:n_clusters] if n_clusters <= len(SEGMENT_LABELS) else [
        f'Segment {i + 1}' for i in range(n_clusters)
    ]
    cluster_to_label = {cluster_id: labels_for_rank[i] for i, cluster_id in enumerate(cluster_rank.index)}
    df['segment'] = df['_cluster'].map(cluster_to_label)
    df.drop(columns=['_cluster'], inplace=True)
    return df, True


def _rule_based_segment(row):
    """Non-ML fallback used only when clustering can't run (tiny catalog,
    or scikit-learn unavailable) — same four labels, simple thresholds."""
    if row['stock'] > 0 and row['unitsSold'] == 0:
        return 'Dead / At-Risk Stock'
    if row['avgDailyDemand'] <= 0:
        return 'Slow Movers'
    if row['turnoverRatio'] >= 4 and row['avgDailyDemand'] > 0:
        return 'Star Performers'
    return 'Steady Movers'


def _estimate_discount_recommendation(df, sales_df):
    """Estimate markdown recommendations for dead-stock medicines.

    Uses a simple linear fit of units sold vs discount% at the category level.
    If a category has enough history for regression, it returns a recommendation
    for slow or dead stock items in that category. Otherwise it leaves the
    recommendation null.
    """
    df = df.copy()
    df['discountModelSlope'] = 0.0
    df['discountRecommendationPct'] = None
    df['discountRecommendationReason'] = ''

    if sales_df.empty:
        return df

    discount_lookup = df.set_index('_id')['discountPercent'].to_dict()
    category_lookup = df.set_index('_id')['category'].to_dict()

    sales_df = sales_df.copy()
    sales_df['discountPercent'] = sales_df['medicineId'].map(lambda mid: discount_lookup.get(mid, 0.0))
    sales_df['category'] = sales_df['medicineId'].map(lambda mid: category_lookup.get(mid, 'Uncategorized'))
    sales_df['discountPercent'] = pd.to_numeric(sales_df['discountPercent'], errors='coerce').fillna(0.0)
    sales_df['quantity'] = pd.to_numeric(sales_df['quantity'], errors='coerce').fillna(0.0)

    def fit_category(group):
        group = group.dropna(subset=['discountPercent', 'quantity'])
        x = pd.to_numeric(group['discountPercent'], errors='coerce')
        y = pd.to_numeric(group['quantity'], errors='coerce')
        if len(group) < 6 or x.nunique() < 2:
            return np.nan
        slope = np.polyfit(x, y, 1)[0]
        return float(slope)

    slopes = sales_df.groupby('category').apply(lambda g: fit_category(g)).dropna()
    if slopes.empty:
        return df

    for category, slope_value in slopes.items():
        slope = float(slope_value)
        threshold = -0.05
        if slope <= threshold:
            df.loc[df['category'] == category, 'discountModelSlope'] = slope
            df.loc[df['category'] == category, 'discountRecommendationReason'] = (
                'Category historically responds to price markdowns'
            )
        else:
            df.loc[df['category'] == category, 'discountModelSlope'] = slope
            df.loc[df['category'] == category, 'discountRecommendationReason'] = (
                'Category shows weak response to markdowns'
            )

    for idx, row in df.iterrows():
        slope = float(row['discountModelSlope']) if pd.notna(row['discountModelSlope']) else 0.0
        if slope < 0:
            rec = min(max(int(round(abs(slope) * 50)), 10), 40)
            df.at[idx, 'discountRecommendationPct'] = rec
            df.at[idx, 'discountRecommendationReason'] = (
                f'{row["category"]} is price-sensitive. A {rec}% markdown is the AI-tested starting point for clearing slow inventory.'
            )
        else:
            df.at[idx, 'discountRecommendationPct'] = 0
            df.at[idx, 'discountRecommendationReason'] = (
                f'{row["category"]} is not showing a strong markdown response. Keep the current price and focus on assortment, stock, or bundle tactics instead.'
            )

    return df


def _detect_anomalies(df):
    """
    Isolation Forest: an unsupervised ML model that isolates outliers by
    how few random splits it takes to separate them from the rest of the
    data — points that isolate quickly (few splits) are the anomalies.
    Applied here across demand level, demand volatility, days-of-supply,
    and inventory value together, so it catches combinations a single
    threshold would miss (e.g. a mid-volume item carrying a wildly
    disproportionate amount of stock relative to its own demand).

    contamination=0.05 means "expect roughly the most unusual 5% of the
    catalog to be flagged" — a starting assumption, not a hard limit.
    Falls back to skipping anomaly detection (empty list) for very small
    catalogs or if scikit-learn isn't importable, same reasoning as the
    clustering fallback above.
    """
    try:
        from sklearn.ensemble import IsolationForest
    except ImportError:
        return df.assign(isAnomaly=False), False

    if len(df) < 10:
        return df.assign(isAnomaly=False), False

    features = df[['avgDailyDemand', 'demandVariability', 'daysOfSupplyCapped', 'inventoryValue']].fillna(0.0)

    # Reuse the saved model if it's still fresh; otherwise fit fresh on
    # today's catalog and save it. Either way every item in the current
    # catalog gets scored — only the .fit() step is what's conditional.
    saved, meta = load_model(ISOLATION_FOREST_MODEL_NAME)
    if saved is not None and not is_stale(meta, MAX_MODEL_AGE_HOURS):
        model = saved
        predictions = model.predict(features)
    else:
        model = IsolationForest(
            contamination=ISOLATION_FOREST_CONTAMINATION,
            random_state=ISOLATION_FOREST_RANDOM_STATE,
            n_estimators=ISOLATION_FOREST_N_ESTIMATORS
        )
        predictions = model.fit_predict(features)  # -1 = anomaly, 1 = normal
        save_model(ISOLATION_FOREST_MODEL_NAME, model, {'catalog_size': len(df)})


    df = df.copy()
    df['isAnomaly'] = predictions == -1
    return df, True


def _anomaly_reason(row, medians):
    """Best-effort plain-English reason an item was flagged, by comparing
    its own feature values against the catalog medians the model saw."""
    reasons = []
    if row['daysOfSupplyCapped'] >= medians['daysOfSupplyCapped'] * 3 and row['avgDailyDemand'] < medians['avgDailyDemand']:
        reasons.append('carrying far more stock than its demand justifies')
    if row['demandVariability'] > medians['demandVariability'] * 2:
        reasons.append('unusually erratic day-to-day demand')
    if row['inventoryValue'] > medians['inventoryValue'] * 3:
        reasons.append('disproportionately high capital tied up in stock')
    if not reasons:
        reasons.append('statistically unusual combination of demand, volatility, and stock levels')
    return '; '.join(reasons)


def _prepare_medicines_df(medicines_df):
    if medicines_df is None:
        medicines_df = pd.DataFrame(columns=['_id', 'name', 'price', 'stock', 'category', 'isDiscontinued', 'discountPercent'])

    df = medicines_df.copy()

    if '_id' not in df.columns:
        if 'medicineId' in df.columns:
            df['_id'] = df['medicineId']
        else:
            df['_id'] = [str(i) for i in range(len(df))]

    for col, default in {
        'name': '',
        'price': 0.0,
        'stock': 0,
        'category': 'Uncategorized',
        'isDiscontinued': False,
        'discountPercent': 0.0,
    }.items():
        if col not in df.columns:
            df[col] = default

    df['price'] = pd.to_numeric(df.get('price'), errors='coerce').fillna(0.0)
    df['stock'] = pd.to_numeric(df.get('stock'), errors='coerce').fillna(0)
    df['discountPercent'] = pd.to_numeric(df.get('discountPercent'), errors='coerce').fillna(0.0)
    df['category'] = df.get('category').fillna('Uncategorized')
    df['isDiscontinued'] = df.get('isDiscontinued', False).fillna(False)
    df['_id'] = df['_id'].astype(str)
    return df


def build_analysis(medicines_df, sales_df):
    now = datetime.now(timezone.utc)
    since = now - timedelta(days=LOOKBACK_DAYS)
    date_index = pd.date_range(start=since.date(), end=now.date(), freq='D')

    medicines_df = _prepare_medicines_df(medicines_df)
    active = medicines_df[medicines_df['isDiscontinued'] == False].copy()  # noqa: E712
    active['_id'] = active['_id'].astype(str)

    demand_stats = _per_medicine_demand_stats(sales_df, active['_id'].tolist(), date_index)
    df = active.set_index('_id').join(demand_stats).reset_index().rename(columns={'index': '_id'})

    # --- Reorder point, safety stock, EOQ (per-medicine, from its own
    #     demand mean/variance — not one flat threshold for everything) ---
    df['safetyStock'] = np.ceil(SERVICE_LEVEL_Z * df['demandStdDev'] * np.sqrt(LEAD_TIME_DAYS))
    df['reorderPoint'] = np.ceil(df['avgDailyDemand'] * LEAD_TIME_DAYS + df['safetyStock'])
    annual_demand = df['avgDailyDemand'] * 365
    holding_cost_per_unit = (df['price'] * HOLDING_COST_RATE).clip(lower=0.01)  # avoid div-by-zero for free/0-price items
    df['economicOrderQty'] = np.ceil(
        np.sqrt((2 * annual_demand.clip(lower=0) * ORDERING_COST) / holding_cost_per_unit)
    ).replace([np.inf, -np.inf], 0).fillna(0)
    df['reorderNeeded'] = df['stock'] <= df['reorderPoint']

    # --- Turnover & days of supply ---
    # No historical stock-level snapshots exist to compute a true average
    # inventory, so current stock is used as the denominator — a standard,
    # documented simplification (see module docstring).
    df['turnoverRatio'] = np.where(df['stock'] > 0, (df['unitsSold'] / df['stock'].replace(0, np.nan)), 0.0)
    df['turnoverRatio'] = df['turnoverRatio'].fillna(0.0)
    df['daysOfSupply'] = np.where(df['avgDailyDemand'] > 0, df['stock'] / df['avgDailyDemand'], np.inf)
    df['daysOfSupplyCapped'] = df['daysOfSupply'].replace(np.inf, 365).clip(upper=365)
    df['demandVariability'] = np.where(df['avgDailyDemand'] > 0, df['demandStdDev'] / df['avgDailyDemand'], df['demandStdDev'])
    df['inventoryValue'] = df['stock'] * df['price']

    # --- Price sensitivity / discount elasticity ---
    df = _estimate_discount_recommendation(df, sales_df)

    # --- ABC / Pareto classification ---
    df = _classify_abc(df)

    # --- ML: KMeans behavioural segmentation ---
    df, clustering_used = _segment_with_kmeans(df)

    # --- ML: Isolation Forest anomaly detection ---
    df, anomaly_ml_used = _detect_anomalies(df)
    medians = df[['daysOfSupplyCapped', 'avgDailyDemand', 'demandVariability', 'inventoryValue']].median()
    df['anomalyReason'] = df.apply(lambda r: _anomaly_reason(r, medians) if r['isAnomaly'] else '', axis=1)

    # --- Dead stock: sitting on the shelf, zero movement in the window ---
    df['isDeadStock'] = (df['stock'] > 0) & (df['unitsSold'] == 0)

    def to_record(row):
        return {
            'medicineId': row['_id'],
            'name': row['name'],
            'category': row.get('category') or 'Uncategorized',
            'stock': int(row['stock']),
            'price': round(float(row['price']), 2),
            'discountPercent': round(float(row['discountPercent']), 1),
            'unitsSold': int(row['unitsSold']),
            'revenue': round(float(row['revenue']), 2),
            'avgDailyDemand': round(float(row['avgDailyDemand']), 2),
            'demandStdDev': round(float(row['demandStdDev']), 2),
            'safetyStock': int(row['safetyStock']),
            'reorderPoint': int(row['reorderPoint']),
            'economicOrderQty': int(row['economicOrderQty']),
            'reorderNeeded': bool(row['reorderNeeded']),
            'turnoverRatio': round(float(row['turnoverRatio']), 2),
            'daysOfSupply': None if np.isinf(row['daysOfSupply']) else round(float(row['daysOfSupply']), 1),
            'inventoryValue': round(float(row['inventoryValue']), 2),
            'abcClass': row['abcClass'],
            'segment': row['segment'],
            'isAnomaly': bool(row['isAnomaly']),
            'anomalyReason': row['anomalyReason'],
            'isDeadStock': bool(row['isDeadStock']),
            'discountRecommendationPct': None if pd.isna(row.get('discountRecommendationPct')) else int(row['discountRecommendationPct']),
            'discountRecommendationReason': row.get('discountRecommendationReason', ''),
        }

    records = [to_record(row) for _, row in df.iterrows()]
    records_df = pd.DataFrame(records)

    reorder_alerts = (
        sorted([r for r in records if r['reorderNeeded']], key=lambda r: (r['stock'] - r['reorderPoint']))[:30]
    )
    dead_stock = (
        sorted([r for r in records if r['isDeadStock']], key=lambda r: r['inventoryValue'], reverse=True)[:30]
    )
    anomalies = (
        sorted([r for r in records if r['isAnomaly']], key=lambda r: r['inventoryValue'], reverse=True)[:20]
    )

    segment_counts = records_df['segment'].value_counts().to_dict() if not records_df.empty else {}
    segment_breakdown = [
        {
            'segment': label,
            'count': int(segment_counts.get(label, 0)),
            'medicines': sorted(
                [r for r in records if r['segment'] == label],
                key=lambda r: r['avgDailyDemand'], reverse=True
            )[:10],
        }
        for label in (SEGMENT_LABELS if clustering_used else sorted(set(records_df['segment']))) if segment_counts.get(label, 0) > 0
    ] if not records_df.empty else []

    abc_counts = records_df['abcClass'].value_counts().to_dict() if not records_df.empty else {}
    abc_breakdown = [
        {
            'abcClass': cls,
            'count': int(abc_counts.get(cls, 0)),
            'revenueShare': round(
                float(records_df[records_df['abcClass'] == cls]['revenue'].sum() / max(records_df['revenue'].sum(), 1e-9) * 100), 1
            ) if not records_df.empty else 0.0,
            'medicines': sorted(
                [r for r in records if r['abcClass'] == cls], key=lambda r: r['revenue'], reverse=True
            )[:15],
        }
        for cls in ['A', 'B', 'C', 'N'] if abc_counts.get(cls, 0) > 0
    ]

    total_inventory_value = float(records_df['inventoryValue'].sum()) if not records_df.empty else 0.0
    avg_turnover = float(records_df['turnoverRatio'].mean()) if not records_df.empty else 0.0

    return {
        'generatedAt': now,
        'lookbackDays': LOOKBACK_DAYS,
        'assumptions': {
            'leadTimeDays': LEAD_TIME_DAYS,
            'serviceLevelZ': SERVICE_LEVEL_Z,
            'orderingCost': ORDERING_COST,
            'holdingCostRate': HOLDING_COST_RATE,
        },
        'summary': {
            'totalMedicines': int(len(records)),
            'totalInventoryValue': round(total_inventory_value, 2),
            'avgTurnoverRatio': round(avg_turnover, 2),
            'reorderAlertCount': len([r for r in records if r['reorderNeeded']]),
            'deadStockCount': len([r for r in records if r['isDeadStock']]),
            'anomalyCount': len([r for r in records if r['isAnomaly']]),
            'clusteringModelUsed': bool(clustering_used),
            'anomalyModelUsed': bool(anomaly_ml_used),
        },
        'abcBreakdown': abc_breakdown,
        'segments': segment_breakdown,
        'reorderAlerts': reorder_alerts,
        'deadStock': dead_stock,
        'priceSensitivityRecommendations': records,
        'anomalies': anomalies,
    }


def generate_deep_analysis():
    db = get_db()
    now = datetime.now(timezone.utc)
    since = now - timedelta(days=LOOKBACK_DAYS)

    medicines_df = load_medicines_df(db)
    sales_df = load_sales_line_items(db, since)

    medicines_df = medicines_df.copy()
    medicines_df['_id'] = medicines_df['_id'].astype(str)
    medicines_df['name_lower'] = medicines_df['name'].astype(str).str.strip().str.lower()

    if not sales_df.empty and 'name' in sales_df.columns:
        sales_df = sales_df.copy()
        sales_df['medicineId'] = sales_df['medicineId'].astype(str)
        sales_df['name'] = sales_df['name'].fillna('').astype(str).str.strip()
        sales_df['name_lower'] = sales_df['name'].str.lower()

        name_to_id = medicines_df.set_index('name_lower')['_id'].to_dict()
        sales_df['mappedId'] = sales_df['name_lower'].map(name_to_id)
        sales_df['medicineId'] = sales_df['mappedId'].fillna(sales_df['medicineId'])
        sales_df = sales_df.drop(columns=['name_lower', 'mappedId'])

    result = build_analysis(medicines_df, sales_df)

    collection = db[RESULT_COLLECTION]
    ensure_snapshot_index(collection)
    collection.insert_one(result)
    prune_old_snapshots(collection)
    return result


if __name__ == '__main__':
    res = generate_deep_analysis()
    s = res['summary']
    print(f"[inventory_deep_analysis] {res['generatedAt'].isoformat()} - "
          f"{s['totalMedicines']} medicines, Rs.{s['totalInventoryValue']:.2f} inventory value, "
          f"{s['reorderAlertCount']} reorder alerts, {s['deadStockCount']} dead-stock items, "
          f"{s['anomalyCount']} ML-flagged anomalies (clustering={s['clusteringModelUsed']}, "
          f"anomaly model={s['anomalyModelUsed']}).")

