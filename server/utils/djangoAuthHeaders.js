/**
 * The Django services under python-service/ (reviews, analytics,
 * medicine_api, chatbot) have no session/auth system of their own — they
 * trust whatever request reaches them. They were only ever meant to be
 * called from this Node server, never reachable directly from a browser,
 * but nothing previously enforced that boundary: if that service's port
 * was reachable on the network, anyone could hit admin-only analysis
 * endpoints, or create/edit/delete a review as any user, without ever
 * logging in.
 *
 * Setting INTERNAL_API_KEY (same value in both server/.env and
 * python-service/.env) closes that gap — Django's InternalApiKeyMiddleware
 * (see python-service/config/middleware.py) rejects any request missing
 * this header once the key is configured. Every Node call into a Django
 * service should attach it via this helper.
 *
 * If INTERNAL_API_KEY isn't set, this returns no extra header and Django's
 * middleware falls back to allowing all requests (matching this app's
 * existing pattern of features degrading gracefully rather than hard-
 * failing when optional config is left blank) — but the network boundary
 * is then the only thing protecting these services, so setting this key
 * in any deployment where python-service's port might be reachable by
 * anything other than this Node server is strongly recommended.
 */

const djangoAuthHeaders = () => {
  const key = process.env.INTERNAL_API_KEY;
  return key ? { 'X-Internal-Api-Key': key } : {};
};

module.exports = djangoAuthHeaders;
