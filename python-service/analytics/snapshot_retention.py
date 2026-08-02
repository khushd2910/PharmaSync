"""
Shared helper for the nightly analytics snapshot collections
(inventory_analysis, sales_analysis, expiry_analysis, inventory_deep_analysis,
demand_forecasts, revenue_forecasts).

Every one of those collections gets a new document inserted every time its
script runs — the nightly cron job AND every "Run now" click from the admin
dashboard — and until now nothing ever removed the old ones. Two problems
follow from that:

1. The collection grows without bound. Every admin dashboard load reads
   only the single latest snapshot, so the older documents are pure dead
   weight from the moment they're superseded.
2. Reading "latest" (`find_one(sort=[('generatedAt', -1)])`, on both this
   side and server/utils/readLatestAnalysis.js on the Node side) was a full
   collection scan + in-memory sort with no index on generatedAt to back
   it — getting slower every day, and eventually hitting MongoDB's 32MB
   in-memory sort limit and failing outright.

ensure_snapshot_index() covers the second half: a descending index on
generatedAt, created once and safe to call on every run (createIndex is a
no-op if the index already exists) so that sort becomes a fast indexed
lookup instead of a scan. Three of these six collections already get this
same index from their Mongoose schema on the Node side (server/models/
*Analysis.js) — this covers those redundantly-but-harmlessly, and covers
the three (inventory_deep_analysis, demand_forecasts, revenue_forecasts)
that have no Mongoose model and were never indexed at all.

prune_old_snapshots() covers the first half: after every successful
insert, keep only the most recent SNAPSHOT_RETENTION_COUNT documents (by
generatedAt) and delete the rest, so the collection stays bounded no
matter how many times "Run now" gets clicked.
"""

import os

# How many snapshots to keep per collection. Configurable via env so a
# deployment that wants a longer trend history can raise it without a code
# change; 30 comfortably covers "one per night for a month" plus headroom
# for demo/testing runs, which is all any of these dashboards ever read
# (they only ever show the single latest snapshot).
SNAPSHOT_RETENTION_COUNT = int(os.getenv('SNAPSHOT_RETENTION_COUNT', '30'))


def ensure_snapshot_index(collection):
    """Descending index on generatedAt. Idempotent — cheap to call every run."""
    collection.create_index([('generatedAt', -1)])


def prune_old_snapshots(collection, keep=None):
    """
    Deletes every snapshot document older than the most recent `keep`
    (default SNAPSHOT_RETENTION_COUNT), ranked by generatedAt. Uses the
    generatedAt index from ensure_snapshot_index() to find the cutoff
    without scanning the whole collection. Returns how many documents were
    removed (purely informational, for the script's own log line).
    """
    keep = SNAPSHOT_RETENTION_COUNT if keep is None else keep

    cutoff_docs = list(
        collection.find({}, {'generatedAt': 1})
        .sort('generatedAt', -1)
        .skip(keep)
        .limit(1)
    )
    if not cutoff_docs:
        return 0  # fewer than `keep` documents exist — nothing to prune

    cutoff = cutoff_docs[0]['generatedAt']
    result = collection.delete_many({'generatedAt': {'$lte': cutoff}})
    return result.deleted_count
