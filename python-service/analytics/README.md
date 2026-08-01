# Analytics (Python + Pandas)

Three scripts, same shape: read the same MongoDB the Node API uses, crunch
it with pandas, write one summary document to their own collection. Each
one is still a plain, independent script — `python3 <name>_analysis.py`
still works exactly as before, and the nightly cron job runs them that
way. On top of that, all three are now *also* wrapped by a proper Django
app (`analytics/views.py`, registered in `config/settings.py` /
`config/urls.py`) that serves each one over HTTP — the same way Module 8
(`medicine_api`) and Module 9 (`chatbot`) already replaced their
Node/Flask equivalents. Node's `inventoryAnalysisController.js`,
`salesAnalysisController.js`, and `expiryAnalysisController.js` are all
now thin authenticated proxies to that service instead of reading MongoDB
or spawning a subprocess themselves — see each file's header comment.

Every line of pandas logic still lives only in the three `*_analysis.py`
scripts — `analytics/views.py` imports `get_db()` / `build_analysis()` /
etc. from each one and calls them directly rather than reimplementing
anything, so the cron path and the HTTP path always compute the exact
same result.

| Script | Module | Collection | What it computes |
|---|---|---|---|
| `inventory_analysis.py` | 4 | `inventory_analysis` | Total Stock, Low Stock, Fast Selling, Slow Selling |
| `sales_analysis.py` | 5 | `sales_analysis` | Daily/Weekly/Monthly Sales, Revenue, Best/Worst Sellers |
| `expiry_analysis.py` | 6 | `expiry_analysis` | Already Expired, Expiring in 30/60/90 Days, alert count |

All three are served at `GET/POST /api/<name>-analysis[/run]` by the same
Django process (`python3 manage.py runserver 8000`) — see "Run once" below.

## Setup (shared by all three scripts)

```bash
cd python-service
python3 -m venv venv
source venv/bin/activate        # venv\Scripts\activate on Windows
pip install -r requirements.txt
cp .env.example .env            # then fill in MONGO_URI
```

## Run once (manual / on-demand)

```bash
python3 analytics/inventory_analysis.py
python3 analytics/sales_analysis.py
python3 analytics/expiry_analysis.py
```

That's the standalone path, same as always — mainly useful for the
nightly cron job or debugging a script in isolation.

For the admin dashboard's "Run Analysis Now" buttons, all three now call
the Django service in-process (no subprocess spawn) — start it with:

```bash
python3 manage.py runserver 8000
```

...and Node will reach it at `ANALYTICS_API_URL` (`server/.env`, defaults
to `http://localhost:8000`, same port `MEDICINE_API_URL`/`CHATBOT_API_URL`
already use for Modules 8/9). All Django-served features — inventory,
sales, and expiry analysis, plus the medicine info API and the chatbot —
live in this one `manage.py runserver` process.

## Schedule nightly

**Linux/macOS (cron)** — stagger them a few minutes apart so they don't
contend for the same Mongo connection pool at the exact same second:

```bash
crontab -e
```

```cron
0 2 * * * cd /absolute/path/to/pharma-management/python-service && venv/bin/python analytics/inventory_analysis.py >> ../logs/inventory_analysis.log 2>&1
15 2 * * * cd /absolute/path/to/pharma-management/python-service && venv/bin/python analytics/sales_analysis.py >> ../logs/sales_analysis.log 2>&1
30 2 * * * cd /absolute/path/to/pharma-management/python-service && venv/bin/python analytics/expiry_analysis.py >> ../logs/expiry_analysis.log 2>&1
```

**Windows (Task Scheduler)** — create three daily triggers:

```
C:\path\to\python-service\venv\Scripts\python.exe C:\path\to\python-service\analytics\inventory_analysis.py
C:\path\to\python-service\venv\Scripts\python.exe C:\path\to\python-service\analytics\sales_analysis.py
C:\path\to\python-service\venv\Scripts\python.exe C:\path\to\python-service\analytics\expiry_analysis.py
```

with "Start in" set to the `python-service` folder for each.

## Notes

- `LOW_STOCK_THRESHOLD` (inventory) and the sales-side settings
  (`SALES_ANALYSIS_LOOKBACK_DAYS`, `BEST_WORST_TOP_N`) live only on the
  Python side — there's no code sharing across the language boundary, so
  if `LOW_STOCK_THRESHOLD` needs to match `server/utils/inventoryConstants.js`,
  change both by hand (or point them at the same env var in your deployment).
- Every run of either script **inserts** a new document rather than
  overwriting the last one, so you get a full history of snapshots for
  free. The Node endpoints always serve the most recent one.
- `sales_analysis.py` reads a full year back by default
  (`SALES_ANALYSIS_LOOKBACK_DAYS=365`) so it has enough history for a
  12-month trend — deliberately a separate window from
  `inventory_analysis.py`'s 30-day `SALES_LOOKBACK_DAYS`, which only needs
  enough data to judge what's fast/slow moving *right now*.
- Both `inventory_analysis.py` and `sales_analysis.py` read from **both**
  sales channels — the online `orders` collection (excluding `Cancelled`)
  and the POS `possales` collection (excluding `Refunded`) — so figures
  reflect the whole pharmacy, not just the storefront.
- `expiry_analysis.py` doesn't touch sales at all — it only reads
  `medicines.expiryDate`, so it has nothing to do with either channel.
  Its 30/60/90-day bucket boundaries are fixed by design (not
  configurable), but the `EXPIRY_ALERT_DAYS` env var controls how far out
  counts as "urgent enough for a dashboard notification" (default 30 —
  already-expired items always count as urgent too).

## ML Training & Serving Split

ML models follow a strict production training vs. serving split:

- **Training Pipeline**:
  - `train_demand_model.py`: Fits `RandomForestRegressor` per medicine over 90 days of sales history and persists timestamped versioned model artifacts (`demand_forecast_rf_models_<timestamp>.pkl`) to `python-service/models/`.
  - `train_revenue_model.py`: Fits Holt-Winters or Linear Regression models over 180 days of transaction history and persists versioned models (`revenue_forecast_model_<timestamp>.pkl`).
  - Run training weekly/monthly or when data shifts:
    ```bash
    python analytics/train_demand_model.py
    python analytics/train_revenue_model.py
    ```

- **Serving Pipeline**:
  - `predict_demand.py`: Loads the active persisted model via `model_registry.load_model()` and performs multi-step 7-day demand forecasting.
  - `predict_revenue.py`: Loads the persisted revenue model and generates 30-day projected revenue forecasts.
  - Run prediction daily or on-demand via HTTP `/api/demand-forecast/run`:
    ```bash
    python analytics/predict_demand.py
    python analytics/predict_revenue.py
    ```

- **Model Registry (`model_registry.py`)**:
  - Centralized model management with versioning, timestamping, metadata logging, and staleness checks.

- **Model Cards Documentation (`MODEL_CARDS.md`)**:
  - Detailed model specs, training data, retraining cadences, fallbacks, and benchmarks for all 5 ML models: [MODEL_CARDS.md](../MODEL_CARDS.md).


