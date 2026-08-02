# PharmaSync — Comprehensive Pharmacy Management System

PharmaSync is a production-grade pharmacy management application handling authentication, online storefront browsing, database-persisted shopping carts, order tracking with prescription verification, in-store Point of Sale (POS) billing, coupons, reviews, and nightly/on-demand inventory & sales analytics (including ML-based forecasting).

It is split into a Node.js/Express API backend, a Vite + React SPA frontend, and a Django + Pandas/scikit-learn Python service that handles analytics, medicine information lookups, and the AI chatbot.

---

## 📁 Project Structure

```
PharmaSync/
├── client/            # React frontend (Vite + React Router + Axios)
├── server/            # Node.js + Express API (JWT, MongoDB, Mongoose)
├── python-service/    # Django service (Pandas/scikit-learn analytics, medicine info, chatbot, reviews)
│   ├── analytics/     # Inventory/sales/expiry analysis + ML demand & revenue forecasting
│   ├── medicine_api/  # Live medicine info lookups (openFDA)
│   ├── chatbot/       # AI support chatbot
│   ├── reviews/       # Medicine reviews CRUD
│   ├── reports/       # On-demand CSV report generation
│   └── requirements.txt
├── database/          # Database notes & seeding scripts
├── uploads/           # Prescription uploads & medicine images
├── reports/exports/   # Generated CSV reports (Sales/Inventory/Expiry/Orders)
├── docs/              # Project documentation & briefs
└── README.md          # Project readme with setup instructions
```

---

## 🔑 Completed Modules & Features

### 📦 Module 1: Production-Grade Authentication
*   **Role-Based Access Control**: Distinguishes between guest visitors (read-only catalog browsing), registered `user` roles, and staff/`admin` roles.
*   **Token Security**:
    *   **httpOnly Cookies**: Access tokens and refresh tokens are stored server-side to protect them from XSS token theft.
    *   **Silent Token Rotation**: Short-lived access tokens (15 mins) and long-lived refresh tokens (30 days) rotate automatically on the client side.
    *   **Session Revocation**: Session token hashes are stored in MongoDB. Logging out (or "log out of all devices" from the profile page) immediately revokes the stored refresh token.
*   **Admin MFA**: Admin login is a separate, dedicated flow (`/admin/login`) that requires an emailed one-time verification code in addition to a password — a regular `/login` attempt on an admin account is rejected outright rather than silently succeeding.
*   **Account Protection**: Repeated failed login attempts are rate-limited and temporarily locked out per email+IP; new passwords are checked against a breach-exposure list and a minimum-strength policy at registration, password change, and reset time.
*   **Security Middleware**: Centralized error translation (`AppError` + `catchAsync`), CSRF protection, endpoint rate-limiting to prevent brute force, and input validation using `express-validator`.
*   **Self-Service flows**: Email verification and password resets using time-limited, single-use, cryptographically secure hashed tokens.
*   **Account & Privacy**: Users can export all of their own data (profile, addresses, wishlist, orders, prescriptions) as a downloadable JSON file, or permanently delete their account (password-confirmed).

### 🛒 Module 2: Online Storefront, Cart, and Order Flow
*   **Medicine Catalog**: Powered by a subset of ~1,150 common medicines curated from the **[Indian Medicine Dataset](https://github.com/junioralive/Indian-Medicine-Dataset)**, with generic-alternative suggestions, related/also-bought medicine rows, and per-medicine star ratings from reviews.
*   **User Cart**: Fully database-persisted shopping cart requiring active authentication, with "save for later" support for items moved out of the cart.
*   **Wishlist**: Bookmark any medicine from the storefront to a saved wishlist independent of the cart.
*   **Coupons**: Percent/flat discount codes with minimum-order thresholds, first-order-only eligibility, and per-user usage caps, validated server-side at checkout (cancelled orders never count against a user's eligibility or usage cap).
*   **Geolocation & Maps**: Integrates browser-based geolocation coordinates and free OpenStreetMap previews for user address entries at checkout.
*   **Prescription Medicine Alert**: An order containing a prescription-only (Rx) medicine requires an uploaded prescription that a pharmacist reviews and approves before the order can progress; a rejected prescription auto-cancels and restocks its order.
*   **Order Execution & Integrity**:
    *   **Atomic Stock Reservation**: Every checkout — regardless of payment method — atomically decrements medicine stock only if enough is still available at that instant, preventing overselling under concurrent checkouts; if any item fails, every earlier decrement in the same attempt is rolled back.
    *   **Invoice Generator**: Generates a standard GST-compliant PDF invoice (12% flat rate breakup) once an order is delivered.
    *   **Order Tracking State Machine**: Simulates progression through standard order lifecycle states (`Pending` ➔ `Confirmed` ➔ `Packed` ➔ `Out for Delivery` ➔ `Delivered`).
    *   **Self-Service Cancellation**: Users can cancel pending or confirmed orders to trigger immediate stock restocking and refund status.
    *   **Ratings**: Users can rate a delivered order 1–5 stars.

### 🛠️ Module 3: Admin & Inventory Management
*   **Dashboard Stats Overview**:
    *   Aggregates live pharmacy metrics: **Total Medicines**, combined **Total Orders**, **Gross Revenue** (excluding cancelled/refunded transactions), **Low Stock Count**, and **Expiring Soon Count**.
    *   Supports distinct tracking of online orders vs. in-store POS sales.
*   **Catalog CRUD**:
    *   Interactive data table displaying stock status badges (Discontinued, Out of Stock, Low, or Good).
    *   Fast-access navigation via search query parameters for "Low Stock" and "Expiring Soon" filters.
    *   Case-insensitive, multi-word token substring search across `name`, `manufacturer`, and `composition` fields.
    *   **Quick Restock**: Instant restock action by target amount (`PATCH /api/admin/medicines/:id/restock`).
    *   **CSV Bulk Import/Export**: Add or update up to 500 medicines at once from a pasted/uploaded CSV, or export the full catalog as CSV (formula-injection-safe — any cell starting with `= + - @` is neutralized before export).
    *   **Safe Deletion**: Deleting a medicine automatically pulls it from all active user carts to prevent orphaned document references.
*   **Prescription Review Queue**: Admins review each uploaded prescription (viewable inline) and approve or reject it, which unblocks or cancels its linked order accordingly.

### 🏪 Module 4: In-Store POS (Point of Sale) Billing Counter
*   **Cashier Billing Terminal**: Staff-only terminal (`/admin/pos`) supporting barcode scanner input (exact match) and multi-token manual text fallback lookup.
*   **Fast Checkout Flow**:
    *   Client-side basket management until completion.
    *   Option to associate customer names and telephone numbers.
    *   Multiple payment methods supported (Cash, UPI, Card).
    *   Same atomic stock validation/decrement (with full rollback on conflicts) and prescription acknowledgment as the online storefront.
*   **Till Reconciliation & Refunds**:
    *   Live sidebar tracking today's POS revenue and total completed sales.
    *   Printable PDF receipt generation.
    *   Transaction refunds that restore item stock and mark the sale as `Refunded`.

### 📊 Module 5: Nightly & On-Demand Analytics (Python + Pandas)
*   **Standalone Analytics Engine**: Independent Pandas pipelines under `python-service/analytics/` that connect directly to the shared MongoDB instance — each still runs as a plain script (`python3 analytics/<name>.py`) for the nightly cron job, and is also served over HTTP by the same Django process for the admin dashboard's "Run Analysis Now" buttons.
*   **Inventory Analysis**: **Total Stock**, **Low Stock**, **Fast-Selling**, and **Slow-Selling** medicines over a rolling lookback window.
*   **Sales Analysis**: Daily/weekly/monthly revenue & order trends (gap-free — a day/week/month with no sales shows as an explicit zero), best/worst sellers, and an online-vs-POS revenue breakdown.
*   **Expiry Analysis**: Buckets active medicines into `Expired`, `Expiring in 30/60/90 Days`, with a configurable "urgent" alert window.
*   **Deep Inventory Analysis**: ABC/Pareto classification, reorder point / safety stock / EOQ calculations, KMeans behavioural segmentation, and Isolation Forest anomaly detection.
*   **ML Demand & Revenue Forecasting**: A RandomForest model (per medicine, 7-day autoregressive forecast) and a Holt-Winters/Linear Regression revenue model (30-day forecast), trained on a schedule and served from persisted, versioned model artifacts — see `python-service/MODEL_CARDS.md`.
*   **Snapshot Retention**: Every analysis run inserts a new timestamped snapshot rather than overwriting the last one, giving a queryable history; each collection is capped to the most recent `SNAPSHOT_RETENTION_COUNT` snapshots (default 30, configurable) so it never grows unbounded, and every snapshot collection is indexed on `generatedAt` for a fast "get latest" read.
*   **Execution Channels**:
    *   Runs automatically via `cron` (staggered nightly) or Windows Task Scheduler.
    *   Triggerable on-demand via each Admin Analysis page's "Run Analysis Now" button — proxied through Node to the Django analytics service, which runs the same pipeline in-process.
    *   The Admin Dashboard reads each collection's latest snapshot straight from MongoDB, so viewing it doesn't depend on the Django service being up — only *computing a fresh one* does.

### 🧾 Module 6: CSV Reports
*   **On-Demand Export Job**: An admin-triggered script (no nightly schedule — it's a live snapshot) writes four flat CSVs straight from MongoDB: `Sales.csv` (combined online + POS revenue), `Inventory.csv` (full catalog snapshot), `Expiry.csv` (nearest-expiry-first), and `Orders.csv` (online orders with customer + delivery detail).
*   **Node integration**: Served back through a filename-whitelisted download endpoint; the admin Reports page shows each file's size and last-generated time.

### 💊 Module 7: Medicine Information & AI Chatbot (Python + Django)
*   **Medicine Information API**: A medicine's detail page pulls live **Uses, Side Effects, Warnings, Storage, and Dosage** from the openFDA API (cached in-memory for 24h on both the Python and Node side); a lookup miss or the service being offline never breaks the page, it just shows no live data.
*   **AI Chatbot**: A chat widget available to guests and logged-in users alike. Messages are keyword-classified and routed: order questions query MongoDB directly (logged-in users only), medicine questions query the catalog, recommendation requests pull featured in-stock items, prescription/delivery FAQs and symptom questions get canned, disclaimer-backed answers, and anything else falls through to the Gemini API (or a static message if no key is configured).

### 🩺 Module 8: Reviews & Ratings
*   Registered users can leave one rating (1–5 stars) + comment per medicine, and edit or delete their own review; admins can moderate (delete) any review.
*   A bulk rating-summary endpoint powers the star ratings shown on every medicine card across the storefront without a request per card.

### 📄 Module 9: Prescription Medicine Alert
*   Users upload a prescription file (image or PDF) before checking out with any Rx-only medicine; the order is held at `Pending Review` until an admin approves or rejects it from the Prescriptions queue, with rejection auto-cancelling and restocking the order.

---

## 🛠️ Prerequisites

*   **Node.js**: Version 18 or newer
*   **Python**: Version 3.13 or newer
*   **MongoDB**: A running local server instance or an Atlas URI connection string

---

## ⚙️ Setup & Installation

### 1. Database Seeding & Setup
Make sure MongoDB is running. Navigate to the `server/` directory:
```bash
cd server
cp .env.example .env     # Edit MONGO_URI, JWT_SECRET, REFRESH_TOKEN_SECRET, and (for admin login) SMTP settings
npm install
```

*   **Create the first Admin Account**:
    ```bash
    node seed/createAdmin.js "Admin Name" admin@pharma.com "StrongPass123"
    ```
*   **Seed the Medicine Catalog**:
    ```bash
    node scripts/importCommonMedicines.js
    ```

### 2. Running the Backend Server
From the `server/` folder:
```bash
npm run dev              # Backend runs on http://localhost:5000
```
*Note: If SMTP credentials (`SMTP_HOST`/`SMTP_USER`/`SMTP_PASS`) are left blank in `.env`, outgoing emails (e.g. registration, password reset) are sent through a free Ethereal test inbox and printed to the console instead — except the admin login OTP email, which has no fallback and requires SMTP to be configured.*

### 3. Running the React Frontend Client
Navigate to the `client/` folder:
```bash
cd ../client
cp .env.example .env     # Verify configuration points to backend
npm install
npm run dev              # Frontend SPA runs on http://localhost:5173
```

### 4. Running the Python Analytics/Django Service
Navigate to the `python-service/` folder:
```bash
cd ../python-service
python -m venv venv
# Activate on Windows:
venv\Scripts\activate
# Activate on macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
cp .env.example .env     # Set MONGO_URI to match your server connection
```
*   **Run an analysis script manually**:
    ```bash
    python analytics/inventory_analysis.py
    python analytics/sales_analysis.py
    python analytics/expiry_analysis.py
    ```
    Each run keeps only the most recent `SNAPSHOT_RETENTION_COUNT` snapshots (default 30) for its collection — override it via that env var if you want a longer or shorter history.
*   **Run the Django service** (required for every Admin Analysis page's "Run Analysis Now" button, plus the Medicine Information API, AI Chatbot, and Reviews — all served from this one process):
    ```bash
    python manage.py runserver 8000
    ```
    With this running, Node proxies each analysis page's on-demand run and the medicine info/chatbot/review requests to `http://localhost:8000` (`ANALYTICS_API_URL` / `MEDICINE_API_URL` / `CHATBOT_API_URL` / `REVIEWS_API_URL` in `server/.env`). The nightly cron/Task Scheduler jobs below don't need this running; those still call the plain standalone scripts directly.
*   **Automate via Cron (Linux/macOS)** — stagger jobs a few minutes apart so they don't contend for the same Mongo connection pool at the same second:
    ```cron
    0 2 * * *  cd /absolute/path/to/python-service && venv/bin/python analytics/inventory_analysis.py >> ../logs/inventory_analysis.log 2>&1
    15 2 * * * cd /absolute/path/to/python-service && venv/bin/python analytics/sales_analysis.py >> ../logs/sales_analysis.log 2>&1
    30 2 * * * cd /absolute/path/to/python-service && venv/bin/python analytics/expiry_analysis.py >> ../logs/expiry_analysis.log 2>&1
    ```

---

## 🔌 API Endpoint Reference

### Authentication & Profiles
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| **POST** | `/api/auth/register` | Public | Register a new user account & send verification email |
| **POST** | `/api/auth/login` | Public | Log in as a customer (admin accounts are rejected here) |
| **POST** | `/api/auth/admin/login` | Public | Admin-only login, requires an emailed MFA code |
| **POST** | `/api/auth/refresh` | Public* | Exchange refresh token cookie for a new access token |
| **GET** | `/api/auth/csrf-token` / `/api/auth/admin/csrf-token` | Public | Fetch a CSRF token for cookie-based requests |
| **GET** | `/api/auth/verify-email/:token` | Public | Verify account email address |
| **POST** | `/api/auth/forgot-password` | Public | Request a password reset link |
| **POST** | `/api/auth/reset-password/:token` | Public | Submit new password using reset token |
| **GET** | `/api/auth/me` | Private | Get logged-in profile data |
| **POST** | `/api/auth/logout` | Private | Revoke active token session |
| **PATCH**| `/api/user/profile` | Private | Update name/phone |
| **PATCH**| `/api/user/change-password` | Private | Change password (requires current password) |
| **POST/PATCH/DELETE** | `/api/user/addresses[/:addressId][/default]` | Private | Add, edit, remove, or set a default saved address |
| **GET** | `/api/user/wishlist` | Private | List wishlisted medicines |
| **POST** | `/api/user/wishlist/:medicineId/toggle` | Private | Add/remove a medicine from the wishlist |
| **GET** | `/api/user/export` | Private | Download all of the user's own data as JSON |
| **DELETE**| `/api/user/account` | Private | Permanently delete the account (password-confirmed) |
| **GET** | `/api/user/stats` | Private | Lifetime order count/spend and prescription counts |
| **POST** | `/api/user/logout-all-devices` | Private | Revoke the stored refresh token everywhere |

*\* Requires a valid `refreshToken` cookie.*

### Storefront, Reviews & Shopping Cart
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| **GET** | `/api/medicines` | Public | Browse catalog (supports `?search=`, `?category=`, `?brand=`, `?sort=`, `?page=`) |
| **GET** | `/api/medicines/categories` / `/brands` | Public | Distinct filter dropdown values |
| **GET** | `/api/medicines/by-ids` | Public | Re-validate a client-cached list of medicine ids |
| **GET** | `/api/medicines/generics` | Public | Generic alternatives for a set of medicine ids |
| **GET** | `/api/medicines/reviews/summary` | Public | Bulk rating summaries for many medicines at once |
| **GET** | `/api/medicines/:id` | Public | Fetch detailed information for a single medicine (incl. live drug info) |
| **GET** | `/api/medicines/:id/related` | Public | Similar / top-in-category / also-bought medicine rows |
| **GET** | `/api/medicines/:id/reviews` | Public | List a medicine's reviews + rating summary |
| **POST** | `/api/medicines/:id/reviews` | Private | Create a review for a medicine |
| **PUT/DELETE**| `/api/reviews/:reviewId` | Private | Edit or delete your own review (or any review, if admin) |
| **GET** | `/api/coupons` | Public | List active coupons |
| **POST** | `/api/coupons/validate` | Private | Validate a coupon code against the current cart total |
| **GET** | `/api/cart` | Private | Fetch user's shopping cart |
| **POST** | `/api/cart/items` | Private | Add an item or increment quantity in cart |
| **PATCH**| `/api/cart/items/:medicineId` | Private | Edit item quantity in cart |
| **DELETE**| `/api/cart/items/:medicineId` | Private | Remove a medicine from the cart |
| **POST** | `/api/cart/items/:medicineId/save` | Private | Move a cart item to "saved for later" |
| **POST** | `/api/cart/saved/:medicineId/move-back` | Private | Move a saved item back into the cart |
| **DELETE**| `/api/cart/saved/:medicineId` | Private | Remove a saved item |
| **DELETE**| `/api/cart` | Private | Clear shopping cart |

### Prescriptions, Orders & Checkout
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| **POST** | `/api/prescriptions` | Private | Upload a prescription file |
| **GET** | `/api/prescriptions` | Private | List the user's own prescription uploads |
| **GET** | `/api/prescriptions/:id/file` | Private | View a prescription file (owner or admin) |
| **POST** | `/api/orders` | Private | Create a storefront order (checks & reserves stock) |
| **GET** | `/api/orders` | Private | List order history for the logged-in user |
| **GET** | `/api/orders/:id` | Private | Fetch order details |
| **PATCH**| `/api/orders/:id/cancel` | Private | Cancel order (Pending/Confirmed only; restocks items) |
| **PATCH**| `/api/orders/:id/rating` | Private | Rate a delivered order |
| **GET** | `/api/orders/:id/invoice`| Private | Download invoice PDF once an order is delivered |

### Admin Dashboard & Catalog Management
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| **GET** | `/api/admin/dashboard/stats` | Admin | Aggregate inventory stats, order counts, and channel revenue |
| **GET** | `/api/admin/medicines` | Admin | List all medicines in database (including discontinued) |
| **GET** | `/api/admin/medicines/export` | Admin | Download the full catalog as CSV |
| **POST** | `/api/admin/medicines` | Admin | Add new medicine |
| **POST** | `/api/admin/medicines/bulk-import` | Admin | Bulk add/update medicines from pasted CSV text (max 500 rows) |
| **PATCH**| `/api/admin/medicines/:id` | Admin | Edit medicine details |
| **PATCH**| `/api/admin/medicines/:id/restock`| Admin | Restock a medicine by custom count |
| **DELETE**| `/api/admin/medicines/:id` | Admin | Delete medicine (pulls it from active user carts) |
| **GET** | `/api/admin/prescriptions` | Admin | List uploaded prescriptions, optionally by `?status=` |
| **PATCH**| `/api/admin/prescriptions/:id/review` | Admin | Approve or reject a prescription |

### Admin Order Management
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| **GET** | `/api/admin/orders` | Admin | List all orders (supports `?status=&page=&limit=`) |
| **GET** | `/api/admin/orders/:id` | Admin | Fetch one order for review/detail |
| **PATCH**| `/api/admin/orders/:id/status`| Admin | Manually advance/cancel an order and/or set its ETA |

### In-Store POS (Point of Sale) Billing
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| **GET** | `/api/admin/pos/search` | Admin | Search counter items by exact barcode or token match |
| **POST** | `/api/admin/pos/sales` | Admin | Complete a POS checkout transaction and decrement stock |
| **GET** | `/api/admin/pos/sales` | Admin | Fetch sales history (supports `?from=`, `?to=` date filters) |
| **GET** | `/api/admin/pos/sales/:id` | Admin | Fetch detailed transaction details for a POS sale |
| **PATCH**| `/api/admin/pos/sales/:id/refund`| Admin | Refund a sale and restore medicine stock levels |
| **GET** | `/api/admin/pos/sales/:id/receipt`| Admin | Download printable receipt PDF for a counter sale |

### Analytics & Reports
Every endpoint below is proxied by Node to the Django service (`python-service/analytics` / `reports`), which runs the actual pandas/scikit-learn pipeline. `GET` reads the latest snapshot straight from MongoDB (works even if Django is down); `POST .../run` computes a fresh one and requires Django to be running.

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| **GET / POST** | `/api/admin/inventory-analysis[/run]` | Admin | Total Stock, Low Stock, Fast/Slow Selling |
| **GET / POST** | `/api/admin/inventory-analysis/deep[/run]` | Admin | ABC/Pareto, reorder point/EOQ, KMeans segments, anomaly detection |
| **GET / POST** | `/api/admin/sales-analysis[/run]` | Admin | Daily/weekly/monthly revenue, best/worst sellers |
| **GET / POST** | `/api/admin/expiry-analysis[/run]` | Admin | Expired / expiring-in-30/60/90-day buckets |
| **GET / POST** | `/api/admin/demand-forecast[/run]` | Admin | ML 7-day per-medicine demand forecast |
| **GET / POST** | `/api/admin/revenue-forecast[/run]` | Admin | ML 30-day revenue forecast |
| **GET** | `/api/admin/reports` | Admin | Status (size/last-generated) of the four CSV exports |
| **POST** | `/api/admin/reports/generate` | Admin | Regenerate all four CSVs now |
| **GET** | `/api/admin/reports/download/:filename` | Admin | Download one generated CSV |

### AI Chatbot
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| **POST** | `/api/chat` | Public/Private | Send a chat message (order lookups require login) |
| **POST** | `/api/chat/reset` | Public/Private | Reset the current chat session |
