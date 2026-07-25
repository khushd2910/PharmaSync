# Medicine Information API (Module 8)

A small standalone Flask service. Unlike `../analytics`, it never touches
MongoDB — it's a stateless lookup layer between Node and openFDA.

```
User opens medicine
    -> Node/Express calls this service
        -> This service calls the Medicine API (openFDA)
            -> Returns Uses, Side Effects, Warnings, Storage, Dosage
    -> Node forwards the result to the medicine page
```

## Setup

```bash
cd python-service
python3 -m venv venv
source venv/bin/activate        # venv\Scripts\activate on Windows
pip install -r requirements.txt
cp .env.example .env            # defaults work out of the box
```

## Run

```bash
python3 medicine_api/app.py
```

Starts on `http://localhost:5001` by default (override with
`MEDICINE_API_PORT`). Keep it running alongside the Node server (`server/`)
and the client (`client/`) — Node calls it over HTTP via
`server/utils/fetchDrugInfo.js`, using the `MEDICINE_API_URL` env var
(`server/.env`, default `http://localhost:5001`).

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | Liveness check |
| `GET` | `/api/medicine-info?generic_name=ibuprofen` | Looks up one generic name, returns `{ found, uses, sideEffects, warnings, storage, dosage, source }` |

A miss (nothing found for that name) returns `{ "found": false }` with a
`200`, not an error — that's an expected outcome, not a failure. Actual
failures (upstream down, network error, timeout) also resolve to
`{ "found": false }` from the caller's point of view — this service never
lets a flaky openFDA lookup break the medicine detail page.

Results are cached in-memory for 24h (`MEDICINE_INFO_CACHE_TTL_HOURS`) so
repeat views of the same generic name don't re-hit openFDA every time.
