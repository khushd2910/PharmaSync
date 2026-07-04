# Pharma Management System — Module 1: Authentication

Production-grade authentication for the Pharmacy Management System.

**User**: Register (email verification sent) → Login → Dashboard → Logout
**Admin**: Admin Login → Admin Dashboard → Logout
**Recovery**: Forgot password → Email link → Reset password

## Project Structure

```
pharma-management/
├── client/            # React frontend (Vite + React Router + Axios)
├── server/            # Node.js + Express API (Auth, JWT, MongoDB)
├── python-service/    # Django APIs + Pandas + AI (future modules)
├── database/          # DB notes/scripts
├── uploads/           # Prescription files (future modules)
└── docs/              # Project documentation
```

## Security features implemented

- **httpOnly cookies** for JWTs — tokens are inaccessible to JS, immune to
  token-stealing via XSS
- **Access + refresh token rotation** — short-lived (15 min) access token,
  long-lived (30 day) refresh token; the client silently refreshes on
  expiry (see `client/src/api/axios.js` interceptor)
- **Server-side session revocation** — refresh tokens are hashed and stored
  on the user document, so logout invalidates them immediately
- **express-validator** on every auth input (email format, password
  strength, phone format)
- **Rate limiting** — tighter limits on login/admin-login to slow
  brute-force attempts, generous limits elsewhere
- **Centralized error handling** — `AppError` + `catchAsync` + a single
  global error handler that translates Mongo/JWT errors into clean messages
  and hides internals in production
- **Email verification** — verification link sent on registration
  (`REQUIRE_EMAIL_VERIFICATION=true` in `.env` to enforce it before login)
- **Password reset** — time-limited, single-use, hashed reset tokens
- **Request logging** via morgan
- **Configurable CORS** for one or more client origins

## Prerequisites

- Node.js 18+
- MongoDB running locally (or an Atlas connection string)

## 1. Backend Setup (server/)

```bash
cd server
cp .env.example .env      # edit MONGO_URI, JWT_SECRET, REFRESH_TOKEN_SECRET
npm install
npm run dev                # starts on http://localhost:5000
```

Use two different long random strings for `JWT_SECRET` and
`REFRESH_TOKEN_SECRET` — never reuse one for both.

If `SMTP_HOST/USER/PASS` are left blank, verification/reset emails are
printed to the server console instead of actually sent — useful for local
testing without a real mail provider.

### Create the first Admin account

Public registration always creates a `user` role account. To create an admin:

```bash
cd server
node seed/createAdmin.js "Admin Name" admin@pharma.com "StrongPass123"
```

### API Endpoints (Module 1)

| Method | Endpoint                       | Access         | Description                          |
|--------|----------------------------------|----------------|----------------------------------------|
| POST   | /api/auth/register               | Public         | Register + send verification email    |
| POST   | /api/auth/login                  | Public         | Login as user or admin                |
| POST   | /api/auth/admin/login            | Public         | Login restricted to admins            |
| POST   | /api/auth/refresh                | Public*        | Exchange refresh cookie for new access token |
| GET    | /api/auth/verify-email/:token    | Public         | Verify email from emailed link        |
| POST   | /api/auth/forgot-password        | Public         | Request password reset email          |
| POST   | /api/auth/reset-password/:token  | Public         | Set a new password                    |
| GET    | /api/auth/me                     | Private        | Get current logged-in profile         |
| POST   | /api/auth/logout                 | Private        | Logout, revoke refresh token          |
| GET    | /api/user/dashboard              | Private (user) | User dashboard placeholder            |
| GET    | /api/admin/dashboard             | Private (admin)| Admin dashboard placeholder           |

\* requires a valid `refreshToken` cookie

Auth uses httpOnly cookies (`accessToken`, `refreshToken`) — the browser
sends them automatically; nothing to manage manually on the client.

## 2. Frontend Setup (client/)

```bash
cd client
cp .env.example .env       # points to the backend API
npm install
npm run dev                 # starts on http://localhost:5173
```

### Pages

- `/register`, `/login`, `/admin/login`
- `/forgot-password`, `/reset-password/:token`
- `/verify-email/:token`
- `/dashboard` (user, protected), `/admin/dashboard` (admin, protected)

### UI

Redesigned around a "prescription pad" visual system — dashed perforated
card edges, an Rx mark, mono-styled field labels, toast notifications,
show/hide password toggles, and a soft email-verification nudge banner.
Admin screens use a distinct warm accent so the two roles are visually
unmistakable.

## What's Next (Module 2+)

- Medicine CRUD, search/filters/sorting, medicine details
- Cart, checkout, order history, profile
- Stock & order management, offline POS billing, GST invoice PDFs
- Sales/inventory/expiry analytics (Django + Pandas), CSV reports
- AI chatbot & prescription-based medicine alerts
