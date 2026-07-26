# Analytics (Python + Pandas)

Three scripts, same shape: read the same MongoDB the Node API uses, crunch
it with pandas, write one summary document to their own collection.

- `inventory_analysis.py` and `expiry_analysis.py` are still standalone —
  they only ever run on a schedule (cron/Task Scheduler) or via Node
  spawning them as a subprocess for "Run Analysis Now" (see
  `server/controllers/inventoryAnalysisController.js` /
  `expiryAnalysisController.js` + `server/utils/runPythonScript.js`).
- `sales_analysis.py` works both ways now: the script itself is unchanged
  and still runs standalone on a schedule, but it's *also* wrapped by a
  proper Django app (`analytics/views.py`, registered in
  `config/settings.py` / `config/urls.py`) that serves
  `GET /api/sales-analysis` and `POST /api/sales-analysis/run` over HTTP —
  the same way Module 8 (`medicine_api`) and Module 9 (`chatbot`) already
  replaced their Node/Flask equivalents. Node's
  `salesAnalysisController.js` is now a thin authenticated proxy to that
  service instead of reading MongoDB or spawning a subprocess itself — see
  that file's header comment. `inventory_analysis.py` and
  `expiry_analysis.py` haven't been converted yet; that's next.

| Script | Module | Collection | What it computes | Django-served? |
|---|---|---|---|---|
| `inventory_analysis.py` | 4 | `inventory_analysis` | Total Stock, Low Stock, Fast Selling, Slow Selling | No — cron/subprocess only |
| `sales_analysis.py` | 5 | `sales_analysis` | Daily/Weekly/Monthly Sales, Revenue, Best/Worst Sellers | **Yes** — `GET/POST /api/sales-analysis[/run]` |
| `expiry_analysis.py` | 6 | `expiry_analysis` | Already Expired, Expiring in 30/60/90 Days, alert count | No — cron/subprocess only |

## Setup (shared by both scripts)

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

For inventory and expiry, the admin dashboard's "Run Analysis Now" button
does exactly this under the hood, spawning the script as a subprocess (see
`server/controllers/inventoryAnalysisController.js` and
`expiryAnalysisController.js`).

For sales, "Run Analysis Now" instead calls the Django service in-process
(no subprocess spawn) — start it with:

```bash
python3 manage.py runserver 8000
```

...and Node will reach it at `ANALYTICS_API_URL` (`server/.env`, defaults
to `http://localhost:8000`, same port `MEDICINE_API_URL`/`CHATBOT_API_URL`
already use for Modules 8/9). All three Django-served features currently
live in one `manage.py runserver` process on port 8000.

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
