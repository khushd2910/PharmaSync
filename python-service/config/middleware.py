"""
This Django project (medicine_api, chatbot, analytics, reviews) has no
session/auth system of its own — every view here previously trusted
whatever request reached it, on the assumption that only the Node server
would ever call in (see the module docstrings in
server/controllers/*AnalysisController.js, reviewController.js,
chatController.js, and utils/fetchDrugInfo.js — all of them explicitly
note "this Django service ... was never meant to be reachable directly
from a browser"). Nothing actually enforced that assumption: if this
service's port were reachable by anything other than the Node server
(no firewall, shared hosting, misconfigured deployment), a request could
skip Node's admin-only login check entirely and hit these endpoints
directly — including creating/editing/deleting a review as any user,
since reviews/views.py takes userId/userName straight from the request
body with nothing to verify it.

InternalApiKeyMiddleware closes that gap: every Node -> Django call now
carries an `X-Internal-Api-Key` header (see
server/utils/djangoAuthHeaders.js), and this middleware rejects any
request that doesn't present the matching key — once one is configured.

Set INTERNAL_API_KEY (same value in both server/.env and
python-service/.env) to turn this on. Left unset, this middleware allows
every request through unchanged, matching how the rest of this app treats
optional configuration (e.g. SMTP creds left blank -> emails print to the
console instead of failing) — but at that point the network boundary is
the only thing protecting these services, so setting this key in any
deployment where this port might be reachable by anything other than the
Node server is strongly recommended.
"""

import hmac

from django.conf import settings
from django.http import JsonResponse

# Paths that stay open regardless — a plain liveness check shouldn't
# require a shared secret (it's used by e.g. `curl localhost:8000/health`
# during local setup, before anyone's wired the key up on both sides).
EXEMPT_PATHS = {'/', '/health'}


class InternalApiKeyMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        expected_key = getattr(settings, 'INTERNAL_API_KEY', '')

        if not expected_key or request.path in EXEMPT_PATHS:
            return self.get_response(request)

        provided_key = request.headers.get('X-Internal-Api-Key', '')

        # Constant-time comparison — this is a shared secret, so a
        # timing side-channel on string equality is worth avoiding even
        # for an internal service.
        if not provided_key or not hmac.compare_digest(provided_key, expected_key):
            return JsonResponse(
                {'error': 'Missing or invalid internal API key'},
                status=401,
            )

        return self.get_response(request)
