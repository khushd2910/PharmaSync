# PharmaSync Project Brief

PharmaSync is a production-grade, end-to-end pharmacy management application designed to handle role-based authentication, storefront browsing, database-persisted shopping carts, order tracking, an in-store POS (Point of Sale) billing terminal, and nightly inventory/sales analytics.

The system is split into three main parts:
1. **Frontend**: React SPA (Vite + React Router + Axios)
2. **Backend API**: Node.js + Express + MongoDB (Mongoose)
3. **Analytics**: Standalone Python service (Pandas + PyMongo)

---

## 📁 Project Structure

```
PharmaSync/
├── client/            # React frontend (Vite + React Router + Axios)
├── server/            # Node.js + Express API (JWT, MongoDB, Mongoose)
├── python-service/    # Django + Pandas + AI (standalone analytics scripts & pipelines)
│   ├── analytics/     # Core Python analytics modules (inventory & sales analysis)
│   └── requirements.txt
├── database/          # Database notes & seeding scripts
├── uploads/           # Prescription uploads (for future verification modules)
├── docs/              # Project documentation & briefs
└── README.md          # Project readme with setup instructions
```

---

## 🔑 Module 1: Production-Grade Authentication

*   **Role-Based Access Control (RBAC)**: Distinguishes between guest browsing, registered `user` roles (customers), and privileged `admin`/staff roles (cashiers, inventory managers).
*   **Security Features**:
    *   **httpOnly Cookies**: JWTs (`accessToken`, `refreshToken`) are stored in secure, httpOnly cookies to mitigate XSS-based token theft.
    *   **Refresh Token Rotation (RTR)**: Long-lived refresh tokens (30 days) and short-lived access tokens (15 mins) rotate dynamically, executing silent refreshes.
    *   **Server-Side Revocation**: Session token hashes are stored directly in user records, allowing instant session validation or immediate invalidation upon logout.
    *   **Security Middleware**: Rate limiting on login/register endpoints, inputs validation/sanitization via `express-validator`, and centralized error handling (`AppError` + `catchAsync`).
    *   **Self-Service flows**: Secured verification of accounts and password reset flows using cryptographically safe, short-lived hashed tokens.

---

## 🛒 Module 2: Storefront, Cart, and Order Flow

*   **Medicine Catalog**: Powered by a curated subset of ~1,150 common medicines derived from the *Indian Medicine Dataset*, covering detailed metadata (brand, category, price, composition, manufacturer, and prescription requirements).
*   **Shopping Cart**: Fully database-persisted user carts synchronized in real-time.
*   **Geolocation & Addresses**: Integrates browser-based geolocation capture and interactive OpenStreetMap previews for delivery address validation.
*   **Transactions & Orders**:
    *   **Atomic Stock Operations**: Checks and decrements medicine stock atomically during checkout. If stock runs out mid-transaction, it rolls back gracefully.
    *   **GST-Inclusive Calculations**: India medicine MRPs are GST-inclusive; therefore, the system back-calculates tax breakups at a flat 12% rate (demonstration placeholder).
    *   **PDF Invoice Generator**: Generates standard GST-compliant invoice PDFs instantly available for download.
    *   **Fulfillment State Machine**: Simulates progression through order lifecycle stages (`Pending` ➔ `Confirmed` ➔ `Packed` ➔ `Out for Delivery` ➔ `Delivered`) on a background timer, unless overridden by an admin.
    *   **Failsafe Stock Restoration**: Users can cancel pending/confirmed orders, triggering immediate stock restoration.

---

## 🛠️ Module 3: Admin & Catalog Management

*   **Dashboard Stats Overview**: Aggregates real-time KPIs: **Total Medicines**, combined **Total Orders**, **Gross Revenue** (excluding cancelled/refunded sales), **Low Stock Count**, and **Expiring Soon Count**.
*   **Medicine Catalog CRUD**:
    *   Interactive data table displaying stock status badges (Discontinued, Out of Stock, Low, or Good).
    *   Quick-access filter parameters for inventory alerts (Low Stock threshold = 10 units, Expiry window = 30 days).
    *   Case-insensitive multi-word token substring search across `name`, `manufacturer`, and `composition`.
    *   **Quick Restock**: Admins can increase inventory counts directly from the list view.
    *   **Cascading Deletion**: Deleting a medicine triggers a `$pull` in MongoDB to remove it from all user carts dynamically, preventing orphaned item references.

---

## 🏪 Module 4: In-Store POS (Point of Sale) Billing Counter

*   **Cashier Billing Terminal**: Staff-only terminal (`/admin/pos`) designed for counter billing. Supports barcode scanner input (exact match) and multi-token manual text search fallback.
*   **Checkout & Basket Management**:
    *   Maintains a local basket until the sale is completed.
    *   Option to associate customer names and telephone numbers for billing history.
    *   Multiple payment methods supported: Cash, UPI, and Card.
    *   Atomic stock validation and decrement with complete rollbacks on stock conflicts.
    *   **Prescription Control**: Explicit cashier acknowledgment required to complete sales containing prescription-only (Rx) medicines.
*   **Till Reconciliation & Refunds**:
    *   Live sidebar tracking today's POS revenue and total completed sales.
    *   Printable PDF receipt generation (using a unified invoice layout labeled as "In-Store Sale").
    *   Transaction refunds that restore item stock and mark the status as `Refunded`.

---

## 📊 Module 5: Standalone Analytics & Reporting (Python + Pandas)

*   **Standalone Analytics Engine**: A Pandas data pipeline that connects directly to MongoDB, eliminating API dependencies during scheduled night runs.
*   **Dual Analytics Pipelines**:
    *   **Inventory Analysis** (`inventory_analysis.py`): Performs rolling 30-day lookbacks. Aggregates total stock units and identifies low stock, fast-selling medicines, and slow-selling medicines (items with stock > 0 but ≤ 1 units sold).
    *   **Sales Analysis** (`sales_analysis.py`): Performs a rolling 365-day lookback. Generates daily (last 30 days), weekly (last 12 weeks), and monthly (last 12 months) revenue and order count trends. Left-joins results onto a gap-free date index so missing data points appear as explicit zeros. Identifies top-performing best sellers and lowest-performing worst sellers.
*   **Execution & Integration**:
    *   Scheduled to run automatically every night via `cron` or Windows Task Scheduler.
    *   Admins can trigger analyses on-demand via the Admin Dashboard's "Run Analysis Now" button, which spawns the Python script as a Node subprocess.
    *   Results are written to distinct collections (`inventory_analysis` and `sales_analysis`).
    *   The frontend uses a custom bar chart component built using CSS div heights to visualize trends dynamically.
