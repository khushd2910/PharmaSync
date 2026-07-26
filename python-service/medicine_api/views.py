import os
import time
from django.http import JsonResponse

try:
    import requests
except ImportError:  # pragma: no cover
    requests = None

# Cache TTL for in-memory openFDA lookups
CACHE_TTL_SECONDS = int(os.getenv('MEDICINE_INFO_CACHE_TTL_HOURS', '24')) * 60 * 60
FETCH_TIMEOUT_SECONDS = 4
OPENFDA_URL = 'https://api.fda.gov/drug/label.json'

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
        # Network error, timeout, malformed JSON, ... — fail silently
        return None


def health(request):
    """GET /health - Liveness check"""
    return JsonResponse({'status': 'ok', 'module': 'Module 8 - Medicine Information API'})


def medicine_info(request):
    """GET /api/medicine-info?generic_name=ibuprofen

    Returns { found: true, uses, sideEffects, warnings, storage, dosage,
    source } on a hit, or { found: false } if nothing came back from
    openFDA for that name.
    """
    if request.method != 'GET':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    generic_name = (request.GET.get('generic_name') or '').strip().lower()
    if not generic_name:
        return JsonResponse({'error': 'generic_name query parameter is required'}, status=400)

    cached = _cache.get(generic_name)
    if cached and time.time() - cached['fetchedAt'] < CACHE_TTL_SECONDS:
        data = cached['data']
    else:
        data = _lookup_openfda(generic_name)
        _cache[generic_name] = {'data': data, 'fetchedAt': time.time()}

    if data is None:
        return JsonResponse({'found': False})

    return JsonResponse({'found': True, **data})
