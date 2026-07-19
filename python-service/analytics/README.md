# Inventory Analysis (Module 4 — Python + Pandas)

Reads the same MongoDB the Node API uses, loads medicines and recent
sales into pandas, and writes one summary document — Total Stock, Low
Stock, Fast Selling, Slow Selling — to the `inventory_analysis`
collection. The Node admin dashboard reads the latest document from
there; this script never calls the Express API directly.

## Setup

```bash
cd python-service
python3 -m venv venv
source venv/bin/activate        # venv\Scripts\activate on Windows
pip install -r requirements.txt
cp .env.example .env            # then fill in MONGO_URI
```

## Run it once (manual / on-demand)

```bash
python3 analytics/inventory_analysis.py
```

The admin dashboard's "Run Analysis Now" button does exactly this under
the hood (see `server/controllers/adminController.js`), for demoing
without waiting for the real nightly schedule.

## Schedule it nightly

**Linux/macOS (cron)** — run at 2:00 AM daily, logging output:

```bash
crontab -e
```

```cron
0 2 * * * cd /absolute/path/to/pharma-management/python-service && venv/bin/python analytics/inventory_analysis.py >> ../logs/inventory_analysis.log 2>&1
```

**Windows (Task Scheduler)** — create a daily trigger that runs:

```
C:\path\to\python-service\venv\Scripts\python.exe C:\path\to\python-service\analytics\inventory_analysis.py
```

with "Start in" set to the `python-service` folder.

## Notes

- `LOW_STOCK_THRESHOLD` here is a separate value from
  `server/utils/inventoryConstants.js` on the Node side — there's no
  code sharing across the language boundary, so if you change one,
  change the other (or point both at the same env var in your
  deployment).
- Every run **inserts** a new document rather than overwriting the
  last one, so you get a history of nightly snapshots for free. The
  Node endpoint always serves the most recent one.
