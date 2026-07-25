# Analytics (Python + Pandas)

Three independent scripts, same shape: read the same MongoDB the Node API
uses, crunch it with pandas, write one summary document to their own
collection. The Node admin dashboard only ever reads the latest document;
none of the scripts call the Express API directly, so all three run on
their own schedule.

| Script | Module | Collection | What it computes |
|---|---|---|---|
| `inventory_analysis.py` | 4 | `inventory_analysis` | Total Stock, Low Stock, Fast Selling, Slow Selling |
| `sales_analysis.py` | 5 | `sales_analysis` | Daily/Weekly/Monthly Sales, Revenue, Best/Worst Sellers |
| `expiry_analysis.py` | 6 | `expiry_analysis` | Already Expired, Expiring in 30/60/90 Days, alert count |

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

Each admin dashboard's "Run Analysis Now" button does exactly this under
the hood (see `server/controllers/inventoryAnalysisController.js`,
`server/controllers/salesAnalysisController.js`, and
`server/controllers/expiryAnalysisController.js`), for demoing without
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
