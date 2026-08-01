import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  withCredentials: true, // send/receive the httpOnly auth cookies
});

let isRefreshing = false;
let pendingQueue = [];
let csrfToken = null;

const getCsrfToken = async () => {
  if (csrfToken) return csrfToken;

  try {
    const response = await api.get('/auth/csrf-token');
    csrfToken = response.data?.csrfToken || null;
    return csrfToken;
  } catch {
    return null;
  }
};

const processQueue = (error) => {
  pendingQueue.forEach(({ resolve, reject }) => (error ? reject(error) : resolve()));
  pendingQueue = [];
};

// Public auth endpoints where a 401 is an *expected*, meaningful response
// (wrong password, invalid/expired MFA code, no session yet, etc.) — not a
// sign that an access token needs silently refreshing. These must be
// excluded from the auto-refresh-and-retry logic below, otherwise a plain
// "Invalid email or password" (or "Invalid admin verification code") gets
// replaced by the unrelated "No refresh token provided, please log in"
// error, because there's naturally no refresh-token cookie yet at login time.
const PUBLIC_AUTH_ENDPOINTS = [
  '/auth/login',
  '/auth/admin/login',
  '/auth/register',
  '/auth/refresh',
  '/auth/csrf-token',
  '/auth/admin/csrf-token',
  '/auth/logout',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/verify-email',
];

const isPublicAuthEndpoint = (url = '') => PUBLIC_AUTH_ENDPOINTS.some((endpoint) => url.includes(endpoint));

// If a request fails with 401 (expired access token), try silently
// refreshing it once via the refresh-token cookie, then retry the original
// request. If refresh also fails, give up and let the caller handle it
// (ProtectedRoute/AuthContext will redirect to login).
api.interceptors.request.use(async (config) => {
  const method = (config.method || 'get').toLowerCase();
  const isSafeMethod = ['get', 'head', 'options'].includes(method);

  if (!isSafeMethod) {
    const token = await getCsrfToken();
    if (token) {
      config.headers = {
        ...(config.headers || {}),
        'X-CSRF-Token': token,
      };
    }
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { config, response } = error;

    if (!response || response.status !== 401 || config._retry || isPublicAuthEndpoint(config.url)) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        pendingQueue.push({ resolve, reject });
      }).then(() => api(config));
    }

    config._retry = true;
    isRefreshing = true;

    try {
      await api.post('/auth/refresh');
      processQueue(null);
      return api(config);
    } catch (refreshError) {
      processQueue(refreshError);
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export default api;
