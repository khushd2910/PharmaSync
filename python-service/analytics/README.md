# Analytics (Python + Pandas)

Two independent scripts, same shape: read the same MongoDB the Node API
uses, crunch it with pandas, write one summary document to their own
collection. The Node admin dashboard only ever reads the latest document;
neither script calls the Express API directly, so both run on their own
schedule.

| Script | Module | Collection | What it computes |
|---|---|---|---|
| `inventory_analysis.py` | 4 | `inventory_analysis` | Total Stock, Low Stock, Fast Selling, Slow Selling |
| `sales_analysis.py` | 5 | `sales_analysis` | Daily/Weekly/Monthly Sales, Revenue, Best/Worst Sellers |

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
```

Each admin dashboard's "Run Analysis Now" button does exactly this under
the hood (see `server/controllers/inventoryAnalysisController.js` and
`server/controllers/salesAnalysisController.js`), for demoing without
waiting for the real nightly schedule.

## Schedule nightly

**Linux/macOS (cron)** — stagger them a few minutes apart so they don't
contend for the same Mongo connection pool at the exact same second:

```bash
crontab -e
```

```cron
0 2 * * * cd /absolute/path/to/pharma-management/python-service && venv/bin/python analytics/inventory_analysis.py >> ../logs/inventory_analysis.log 2>&1
15 2 * * * cd /absolute/path/to/pharma-management/python-service && venv/bin/python analytics/sales_analysis.py >> ../logs/sales_analysis.log 2>&1
```

**Windows (Task Scheduler)** — create two daily triggers:

```
C:\path\to\python-service\venv\Scripts\python.exe C:\path\to\python-service\analytics\inventory_analysis.py
C:\path\to\python-service\venv\Scripts\python.exe C:\path\to\python-service\analytics\sales_analysis.py
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
- Both scripts read from **both** sales channels — the online `orders`
  collection (excluding `Cancelled`) and the POS `possales` collection
  (excluding `Refunded`) — so figures reflect the whole pharmacy, not just
  the storefront.
