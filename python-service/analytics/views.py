"""
Analytics — Modules 4, 5, 6 (Django).

Node previously exposed all three of these by spawning
`python3 <name>_analysis.py` as a subprocess per request and reading each
snapshot straight out of MongoDB itself (see the git history of
inventoryAnalysisController.js / salesAnalysisController.js /
expiryAnalysisController.js). All three now live here instead, served over
HTTP the same way Module 8 (medicine_api) and Module 9 (chatbot) already
replaced their Node/Flask equivalents:

    GET  /api/sales-analysis          POST /api/sales-analysis/run
    GET  /api/inventory-analysis      POST /api/inventory-analysis/run
    GET  /api/expiry-analysis         POST /api/expiry-analysis/run

Deliberately thin: every line of actual pandas logic stays in
sales_analysis.py / inventory_analysis.py / expiry_analysis.py exactly as
it was. Those three are imported here as whole *modules* — not individual
names — because all three scripts independently define their own
get_db(), build_analysis(), and RESULT_COLLECTION; importing those
unqualified into one file would silently make the last import win and
shadow the other two. The nightly cron job still runs each script
directly (see analytics/README.md) — that path and this one call the
exact same functions, so there is exactly one implementation of each
analysis, not two that could quietly drift apart.

Node's role is now just an authenticated proxy for all three — see
server/controllers/salesAnalysisController.js,
inventoryAnalysisController.js, and expiryAnalysisController.js — since
this Django service has no auth/session system of its own and was never
meant to be reachable directly from a browser.
"""

from datetime import datetime, timedelta, timezone

from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

from . import expiry_analysis as expiry_engine
from . import inventory_analysis as inventory_engine
from . import inventory_deep_analysis as inventory_deep_engine
from . import sales_analysis as sales_engine
from . import demand_forecasting as forecast_engine
from . import revenue_forecasting as revenue_forecast_engine
from . import market_basket_analysis as basket_engine


def _json_safe(value):

    """Recursively converts Mongo/pandas-native types into whatever
    JsonResponse can encode on its own. Every read from Mongo comes back
    with an `_id` (ObjectId) that the old Mongoose models never exposed to
    the frontend either, so it's dropped rather than stringified; every
    datetime (generatedAt, and — in expiry_analysis's case — each item's
    own expiryDate) becomes an ISO string, matching what Node's Mongoose
    models always serialized Date fields as."""
    if isinstance(value, dict):
        return {k: _json_safe(v) for k, v in value.items() if k != '_id'}
    if isinstance(value, list):
        return [_json_safe(v) for v in value]
    if isinstance(value, datetime):
        return value.isoformat()
    return value


def _latest(db, collection_name):
    doc = db[collection_name].find_one(sort=[('generatedAt', -1)])
    return _json_safe(doc) if doc is not None else None


def health(request):
    """GET /health - Liveness check"""
    return JsonResponse({'status': 'ok', 'module': 'Modules 4/5/6 - Analytics'})


# ---------------------------------------------------------------------------
# Module 5 — Sales Analysis
# ---------------------------------------------------------------------------

@require_http_methods(['GET'])
def sales_analysis(request):
    """GET /api/sales-analysis

    Returns { analysis: {...} | null } — whatever the most recent run
    (nightly cron or a manual "Run Analysis Now") last produced.
    """
    db = sales_engine.get_db()
    return JsonResponse({'analysis': _latest(db, sales_engine.RESULT_COLLECTION)})


@require_http_methods(['POST'])
def run_sales_analysis(request):
    """POST /api/sales-analysis/run

    Computes a fresh snapshot right now and persists it, same as running
    the script by hand.
    """
    db = sales_engine.get_db()
    since = datetime.now(timezone.utc) - timedelta(days=sales_engine.LOOKBACK_DAYS)

    sales_df = sales_engine.load_sales_df(db, since)
    result = sales_engine.build_analysis(sales_df)
    db[sales_engine.RESULT_COLLECTION].insert_one(result)

    return JsonResponse({'message': 'Analysis complete', 'analysis': _json_safe(result)})


# ---------------------------------------------------------------------------
# Module 4 — Inventory Analysis
# ---------------------------------------------------------------------------

@require_http_methods(['GET'])
def inventory_analysis(request):
    """GET /api/inventory-analysis — latest snapshot, same contract as
    sales_analysis() above."""
    db = inventory_engine.get_db()
    return JsonResponse({'analysis': _latest(db, inventory_engine.RESULT_COLLECTION)})


@require_http_methods(['POST'])
def run_inventory_analysis(request):
    """POST /api/inventory-analysis/run — computes a fresh snapshot now."""
    db = inventory_engine.get_db()
    since = datetime.now(timezone.utc) - timedelta(days=inventory_engine.SALES_LOOKBACK_DAYS)

    medicines_df = inventory_engine.load_medicines_df(db)
    sales_df = inventory_engine.load_units_sold_df(db, since)
    result = inventory_engine.build_analysis(medicines_df, sales_df)
    db[inventory_engine.RESULT_COLLECTION].insert_one(result)

    return JsonResponse({'message': 'Analysis complete', 'analysis': _json_safe(result)})


# ---------------------------------------------------------------------------
# Deep Inventory Analysis — ABC/Pareto classification, reorder point /
# safety stock / EOQ, KMeans behavioural segmentation, Isolation Forest
# anomaly detection. See inventory_deep_analysis.py for the full pipeline.
# ---------------------------------------------------------------------------

@require_http_methods(['GET'])
def inventory_deep_analysis(request):
    """GET /api/inventory-analysis/deep — latest deep-analysis snapshot,
    same contract as inventory_analysis() above."""
    db = inventory_deep_engine.get_db()
    return JsonResponse({'analysis': _latest(db, inventory_deep_engine.RESULT_COLLECTION)})


@require_http_methods(['POST'])
def run_inventory_deep_analysis(request):
    """POST /api/inventory-analysis/deep/run — trains fresh KMeans/Isolation
    Forest models over the current catalog + sales history and computes a
    fresh ABC/reorder/segmentation snapshot now."""
    try:
        result = inventory_deep_engine.generate_deep_analysis()
        return JsonResponse({'message': 'Deep analysis complete', 'analysis': _json_safe(result)})
    except Exception as e:
        return JsonResponse({'error': f'Failed to run deep inventory analysis: {str(e)}'}, status=500)


# ---------------------------------------------------------------------------
# Module 6 — Expiry Analysis
# ---------------------------------------------------------------------------

@require_http_methods(['GET'])
def expiry_analysis(request):
    """GET /api/expiry-analysis — latest snapshot, same contract as
    sales_analysis() above."""
    db = expiry_engine.get_db()
    return JsonResponse({'analysis': _latest(db, expiry_engine.RESULT_COLLECTION)})


@require_http_methods(['POST'])
def run_expiry_analysis(request):
    """POST /api/expiry-analysis/run — computes a fresh snapshot now."""
    db = expiry_engine.get_db()
    now = datetime.now(timezone.utc)

    medicines_df = expiry_engine.load_medicines_df(db)
    result = expiry_engine.build_analysis(medicines_df, now)
    db[expiry_engine.RESULT_COLLECTION].insert_one(result)

    return JsonResponse({'message': 'Analysis complete', 'analysis': _json_safe(result)})


# ---------------------------------------------------------------------------
# ML Demand Forecasting
# ---------------------------------------------------------------------------

@require_http_methods(['GET'])
def demand_forecast(request):
    """GET /api/demand-forecast — returns the latest ML demand forecast"""
    db = forecast_engine.get_db()
    return JsonResponse({'analysis': _latest(db, forecast_engine.RESULT_COLLECTION)})


@require_http_methods(['POST'])
def run_demand_forecast(request):
    """POST /api/demand-forecast/run — triggers generating a new ML forecast"""
    try:
        result = forecast_engine.generate_forecast()
        return JsonResponse({'message': 'Forecast generated successfully', 'analysis': _json_safe(result)})
    except Exception as e:
        return JsonResponse({'error': f'Failed to generate forecast: {str(e)}'}, status=500)


# ---------------------------------------------------------------------------
# ML Revenue Forecasting
# ---------------------------------------------------------------------------

@require_http_methods(['GET'])
def revenue_forecast(request):
    """GET /api/revenue-forecast — returns the latest ML revenue forecast"""
    db = revenue_forecast_engine.get_db()
    return JsonResponse({'analysis': _latest(db, revenue_forecast_engine.RESULT_COLLECTION)})


@require_http_methods(['POST'])
def run_revenue_forecast(request):
    """POST /api/revenue-forecast/run — triggers generating a new ML revenue forecast"""
    try:
        result = revenue_forecast_engine.generate_forecast()
        return JsonResponse({'message': 'Revenue forecast generated successfully', 'analysis': _json_safe(result)})
    except Exception as e:
        return JsonResponse({'error': f'Failed to generate revenue forecast: {str(e)}'}, status=500)


# ---------------------------------------------------------------------------
# Market Basket Analysis — Apriori / association rules over order + POS
# line-item baskets. See market_basket_analysis.py for the full pipeline.
# ---------------------------------------------------------------------------

@require_http_methods(['GET'])
def market_basket_analysis(request):
    """GET /api/market-basket-analysis — latest snapshot, same contract as
    sales_analysis() above."""
    db = basket_engine.get_db()
    return JsonResponse({'analysis': _latest(db, basket_engine.RESULT_COLLECTION)})


@require_http_methods(['POST'])
def run_market_basket_analysis(request):
    """POST /api/market-basket-analysis/run — mines a fresh snapshot now."""
    try:
        db = basket_engine.get_db()
        since = datetime.now(timezone.utc) - timedelta(days=basket_engine.LOOKBACK_DAYS)

        baskets, id_to_name = basket_engine.load_baskets(db, since)
        result = basket_engine.build_analysis(baskets, id_to_name)
        db[basket_engine.RESULT_COLLECTION].insert_one(result)

        return JsonResponse({'message': 'Analysis complete', 'analysis': _json_safe(result)})
    except Exception as e:
        return JsonResponse({'error': f'Failed to run market basket analysis: {str(e)}'}, status=500)


