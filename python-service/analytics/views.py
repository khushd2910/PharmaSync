"""
Sales Analysis — Module 5 (Django).

Previously Node exposed this by spawning `python3 sales_analysis.py` as a
subprocess on every "Run Analysis Now" click (see runPythonScript.js) and
otherwise just read the last snapshot straight out of MongoDB itself. Both
of those jobs now live here instead, served over HTTP the same way Module 8
(medicine_api) and Module 9 (chatbot) already replaced their Node/Flask
equivalents:

    GET  /api/sales-analysis      -> latest snapshot from Mongo (read-only)
    POST /api/sales-analysis/run  -> runs the analysis right now, in-process
                                      (no subprocess spawn), and returns the
                                      fresh result

Deliberately thin: every line of actual pandas logic (loading orders/POS
sales, building the daily/weekly/monthly buckets, best/worst sellers) stays
in sales_analysis.py exactly as it was, and is imported here rather than
duplicated. The nightly cron job still runs `python3 analytics/sales_analysis.py`
directly (see analytics/README.md) — that path and this one call the exact
same functions, so there is exactly one implementation of "how sales
analysis is computed", not two that could quietly drift apart.

Node's role is now just an authenticated proxy — see
server/controllers/salesAnalysisController.js — since this Django service
has no auth/session system of its own and was never meant to be reachable
directly from a browser.
"""

from datetime import datetime, timedelta, timezone

from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

from .sales_analysis import LOOKBACK_DAYS, RESULT_COLLECTION, build_analysis, get_db, load_sales_df


def _serialize(doc):
    """Mongo's driver hands back an ObjectId (_id) and native datetime
    objects, neither of which JsonResponse can encode on its own. The
    frontend never used `_id` (the Node/Mongoose model didn't expose it
    either), so it's dropped rather than stringified; `generatedAt`
    becomes an ISO string, matching what Node's Mongoose model always
    serialized it as."""
    if doc is None:
        return None
    doc = dict(doc)
    doc.pop('_id', None)
    generated_at = doc.get('generatedAt')
    if isinstance(generated_at, datetime):
        doc['generatedAt'] = generated_at.isoformat()
    return doc


def health(request):
    """GET /health - Liveness check"""
    return JsonResponse({'status': 'ok', 'module': 'Module 5 - Sales Analysis'})


@require_http_methods(['GET'])
def sales_analysis(request):
    """GET /api/sales-analysis

    Returns { analysis: {...} | null } — whatever the most recent run
    (nightly cron or a manual "Run Analysis Now") last produced. Never
    computes anything itself; that's what /run is for.
    """
    db = get_db()
    latest = db[RESULT_COLLECTION].find_one(sort=[('generatedAt', -1)])
    return JsonResponse({'analysis': _serialize(latest)})


@require_http_methods(['POST'])
def run_sales_analysis(request):
    """POST /api/sales-analysis/run

    Computes a fresh snapshot right now and persists it, same as running
    the script by hand — for demoing without waiting on the nightly
    schedule.
    """
    db = get_db()
    since = datetime.now(timezone.utc) - timedelta(days=LOOKBACK_DAYS)

    sales_df = load_sales_df(db, since)
    result = build_analysis(sales_df)
    db[RESULT_COLLECTION].insert_one(result)

    return JsonResponse({'message': 'Analysis complete', 'analysis': _serialize(result)})
