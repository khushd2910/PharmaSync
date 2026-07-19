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

## Medicine data (guest browsing)

The home page lets guests browse medicines without logging in. It's seeded
from the **[Indian Medicine Dataset](https://github.com/junioralive/Indian-Medicine-Dataset)**
(253,973 real medicines — name, price, manufacturer, composition, pack
size), which is community-maintained and free to use. Check that repo for
attribution/licensing details if you plan to deploy this commercially.

The CSV is already included at `server/data/indian_medicine_data.csv`.
<<<<<<< HEAD
To load it into MongoDB:

```bash
cd server
node scripts/importMedicines.js
```

=======
**Use this script** to load the curated, common-medicine subset (~1,150
medicines with demo stock/category/featured/discount data — this is the one
the storefront is actually built around):

```bash
cd server
node scripts/importCommonMedicines.js
```

⚠️ There's also a `scripts/importMedicines.js` left over from an earlier
version of this project, which imports the *entire* 253k-row dataset with
none of the demo stock/category/offer data populated (medicines will show
as permanently out of stock, and the Offers/Popular rows will be empty).
**Don't use it** — it's kept only for reference and prints a warning if run.

>>>>>>> master
This streams the CSV (so it doesn't load 31MB into memory at once), inserts
in batches, skips malformed rows, and builds the text search index used by
the browse/search bar. Re-running it clears and re-imports the collection.

### Other data source options (for later modules)

- **[openFDA](https://open.fda.gov/apis/drug/)** — free, no key required for
  moderate use, updated daily. Good for supplementary drug label info
  (warnings, dosage, interactions) fetched live via the Django
  `python-service`, rather than bulk-imported.
- **[RxNorm (NLM)](https://www.nlm.nih.gov/research/umls/rxnorm/)** — free
  API for normalized drug names/ingredients, useful for matching brand
  names to generic equivalents.

### New public API endpoints

| Method | Endpoint              | Access | Description                                  |
|--------|------------------------|--------|-----------------------------------------------|
| GET    | /api/medicines          | Public | List/search medicines — `?search=&sort=&page=&limit=` |
| GET    | /api/medicines/:id      | Public | Get a single medicine's details               |

`sort` accepts `name`, `price-asc`, `price-desc` (defaults to relevance when
searching, name otherwise).

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

- `/` — public home page (opens by default), with a top navbar (Home, Login,
  Register, Admin — swaps to Dashboard/Logout once signed in)
- `/login`, `/register`, `/admin/login`
- `/forgot-password`, `/reset-password/:token`
- `/verify-email/:token`
- `/dashboard` (user, protected), `/admin/dashboard` (admin, protected)

### UI

Redesigned around a "prescription pad" visual system — dashed perforated
card edges, mono-styled field labels, `lucide-react` icons on every input
(mail, user, phone, lock, show/hide password), toast notifications, and a
soft email-verification nudge banner. Admin screens use a distinct warm
accent so the two roles are visually unmistakable.

### Getting real password-reset emails working

`forgot-password` always works, but where the email actually goes depends
on your `.env`:

- **Nothing configured** → sent to a free Ethereal test inbox; the server
  console prints a clickable preview link so you can see the email content,
  but it never reaches a real address.
- **Gmail (easiest for real delivery)** → set `SMTP_SERVICE=gmail`,
  `SMTP_USER=you@gmail.com`, `SMTP_PASS=<App Password>` (create one at
  https://myaccount.google.com/apppasswords — requires 2FA on the account).
  Restart the server after editing `.env`.
- **Any other provider** → set `SMTP_HOST`/`SMTP_PORT` instead of
  `SMTP_SERVICE`.

Email sending never crashes the request — if SMTP fails, the error is
logged to the server console and the API still responds normally.

<<<<<<< HEAD
## What's Next (Module 2+)

- Medicine CRUD, search/filters/sorting, medicine details
- Cart, checkout, order history, profile
- Stock & order management, offline POS billing, GST invoice PDFs
- Sales/inventory/expiry analytics (Django + Pandas), CSV reports
- AI chatbot & prescription-based medicine alerts
=======
## Module 2 — Shopping, Orders & Admin (complete)

**Catalog:** ~1,150 curated common medicines (see "Medicine data" above),
categories, brand/price/prescription/stock filters, Offers/Popular/Recently
Added rows, medicine detail page with a live openFDA lookup.

**Cart & Checkout:** server-persisted cart (login required), quantity
controls, address form with browser-geolocation + free OpenStreetMap
preview (swap in real Google Maps later once you have an API key — the
integration point is `client/src/pages/Checkout.jsx`'s `mapSrc`), COD / UPI
(Demo) payment, atomic stock decrement with rollback if stock runs out
mid-checkout.

**Order tracking:** Pending → Confirmed → Packed → Out for Delivery →
Delivered. Auto-progresses on a demo timer (~45s/stage) until an admin
manually sets a status — at that point `demoMode` flips off and the real
status is trusted everywhere (`GET/PATCH /api/admin/orders`).

**User self-service:** cancel an order while it's still Pending/Confirmed
(`PATCH /api/orders/:id/cancel`, auto-restocks); download a GST-style PDF
invoice at any time (`GET /api/orders/:id/invoice`) — the GST breakup is a
simplified flat-12%-back-calculated-from-MRP demo, clearly labelled as such
on the invoice itself, since the dataset has no real per-medicine HSN/GST
slab data.

**Admin:** `/admin/orders` — view every order, filter by status, change
status (or cancel or download an invoice) for any order.

**Profile:** edit name/phone/address, view order history link.

## What's Next (Module 3+)

- Medicine CRUD & stock/expiry management from the admin panel (currently
  stock only changes via checkout/cancellation, not direct admin editing)
- Offline POS billing
- Sales/inventory/expiry analytics (Django + Pandas), CSV reports
- AI chatbot & prescription-based medicine alerts
- Real Google Maps integration once an API key is available
>>>>>>> master
