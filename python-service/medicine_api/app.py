"""
Medicine Information API — Module 8 (Python + Flask)

Flow this service implements:

    User opens medicine
        -> Node/Express calls THIS service
            -> This service calls the external Medicine API (openFDA)
                -> Returns Uses, Side Effects, Warnings, Storage, Dosage
        -> Node forwards that straight back to the medicine page

Unlike the analytics scripts in ../analytics (which talk to MongoDB
directly), this service never touches the database — it's a thin,
stateless lookup layer that sits between Node and the outside world.
Node's server/utils/fetchDrugInfo.js calls this over HTTP instead of
calling openFDA itself.

Run manually:
    python3 medicine_api/app.py

Then Node reaches it at MEDICINE_API_URL (default http://localhost:5001,
see server/.env.example).

Environment (.env in python-service/, or the repo root):
    MEDICINE_API_PORT   default 5001
    MEDICINE_INFO_CACHE_TTL_HOURS   default 24
"""

import os
import time

from dotenv import load_dotenv
from flask import Flask, jsonify, request

try:
    import requests
except ImportError:  # pragma: no cover
    requests = None

# Load .env from this folder first, then fall back to the repo root — same
# pattern as analytics/inventory_analysis.py, so this works whether it's
# run standalone or alongside the rest of the stack.
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '..', '.env'))

PORT = int(os.getenv('MEDICINE_API_PORT', '5001'))
CACHE_TTL_SECONDS = int(os.getenv('MEDICINE_INFO_CACHE_TTL_HOURS', '24')) * 60 * 60
FETCH_TIMEOUT_SECONDS = 4
OPENFDA_URL = 'https://api.fda.gov/drug/label.json'

app = Flask(__name__)

# Simple in-memory cache, mirroring the one fetchDrugInfo.js used to keep
# itself — repeated lookups of the same generic name don't re-hit openFDA
# every time. Resets on process restart; fine for this use case.
_cache = {}


def _first(field_list):
    """openFDA fields are arrays of strings (label sections can repeat
    across a drug's multiple package inserts) — take the first one."""
    if isinstance(field_list, list) and field_list:
        return field_list[0]
    return None


def _lookup_openfda(generic_name):
    """Calls the external Medicine API (openFDA) for one generic name and
    maps its label sections onto the five fields this module reports:
    Uses, Side Effects, Warnings, Storage, Dosage. Best-effort — returns
    None on any failure so a slow/unreachable upstream never breaks the
    caller."""
    if requests is None:
        return None

    try:
        params = {
            'search': f'openfda.generic_name:"{generic_name}"',
            'limit': 1,
        }
        res = requests.get(OPENFDA_URL, params=params, timeout=FETCH_TIMEOUT_SECONDS)
        if not res.ok:
            return None

        results = res.json().get('results') or []
        if not results:
            return None

        label = results[0]
        return {
            'source': 'openFDA',
            'uses': _first(label.get('indications_and_usage')),
            'sideEffects': _first(label.get('adverse_reactions')),
            'warnings': _first(label.get('warnings')) or _first(label.get('warnings_and_cautions')),
            'storage': _first(label.get('storage_and_handling')),
            'dosage': _first(label.get('dosage_and_administration')),
        }
    except Exception:
        # Network error, timeout, malformed JSON, ... — fail silently, the
        # medicine page always has its own curated fields to fall back on.
        return None


@app.get('/health')
def health():
    return jsonify({'status': 'ok', 'module': 'Module 8 - Medicine Information API'})


@app.get('/api/medicine-info')
def medicine_info():
    """GET /api/medicine-info?generic_name=ibuprofen

    Returns { found: true, uses, sideEffects, warnings, storage, dosage,
    source } on a hit, or { found: false } if nothing came back from
    openFDA for that name (never a 4xx/5xx for a plain "not found" —
    that's an expected outcome, not an error).
    """
    generic_name = (request.args.get('generic_name') or '').strip().lower()
    if not generic_name:
        return jsonify({'error': 'generic_name query parameter is required'}), 400

    cached = _cache.get(generic_name)
    if cached and time.time() - cached['fetchedAt'] < CACHE_TTL_SECONDS:
        data = cached['data']
    else:
        data = _lookup_openfda(generic_name)
        _cache[generic_name] = {'data': data, 'fetchedAt': time.time()}

    if data is None:
        return jsonify({'found': False})

    return jsonify({'found': True, **data})


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=PORT)
