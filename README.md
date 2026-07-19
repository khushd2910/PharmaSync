# PharmaSync — Comprehensive Pharmacy Management System

PharmaSync is a production-grade pharmacy management application designed to handle authentication, online storefront browsing, database-persisted shopping carts, order tracking, in-store Point of Sale (POS) billing, and nightly inventory analytics. 

It is divided into a Node.js/Express API backend, a Vite + React SPA frontend, and a standalone Python service powered by Pandas for daily statistical summaries.

---

## 📁 Project Structure

```
Pharmasync/
├── client/            # React frontend (Vite + React Router + Axios)
├── server/            # Node.js + Express API (JWT, MongoDB, Mongoose)
├── python-service/    # Python service (Pandas-based analytics)
│   ├── analytics/     # Core inventory analysis modules
│   └── requirements.txt
├── database/          # Database notes & seeding scripts
├── uploads/           # Prescription uploads (for future verification modules)
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
    *   **Session Revocation**: Session token hashes are stored in MongoDB. Logging out immediately revokes and invalidates session tokens.
*   **Security Middleware**: Centralized error translation (`AppError` + `catchAsync`), endpoint rate-limiting to prevent brute force, and input validation using `express-validator`.
*   **Self-Service flows**: Email verification and password resets using time-limited, single-use, cryptographically secure hashed tokens.

### 🛒 Module 2: Online Storefront, Cart, and Order Flow
*   **Medicine Catalog**: Powered by a subset of ~1,150 common medicines curated from the **[Indian Medicine Dataset](https://github.com/junioralive/Indian-Medicine-Dataset)**.
*   **User Cart**: Fully database-persisted shopping cart requiring active authentication.
*   **Geolocation & Maps**: Integrates browser-based geolocation coordinates and free OpenStreetMap previews for user address entries at checkout.
*   **Order Execution & Integrity**:
    *   **Atomic Stock Decrement**: Checks and decrements medicine stock atomically during checkout. If stock runs out mid-transaction, it rolls back gracefully.
    *   **Invoice Generator**: Generates a standard GST-compliant PDF invoice (12% flat rate breakup) immediately available for download.
    *   **Order Tracking State Machine**: Simulates progression through standard order lifecycle states (`Pending` ➔ `Confirmed` ➔ `Packed` ➔ `Out for Delivery` ➔ `Delivered`).
    *   **Self-Service Cancellation**: Users can cancel pending or confirmed orders to trigger immediate stock restocking.

### 🛠️ Module 3: Admin & Inventory Management
*   **Dashboard Stats Overview**:
    *   Aggregates live pharmacy metrics: **Total Medicines**, combined **Total Orders**, **Gross Revenue** (excluding cancelled/refunded transactions), **Low Stock Count**, and **Expiring Soon Count**.
    *   Supports distinct tracking of online orders vs. in-store POS sales.
*   **Catalog CRUD**:
    *   Interactive data table displaying stock status badges (Discontinued, Out of Stock, Low, or Good).
    *   Fast-access navigation via search query parameters for "Low Stock" and "Expiring Soon" filters.
    *   Case-insensitive, multi-word token substring search across `name`, `manufacturer`, and `composition` fields.
    *   **Quick Restock**: Instant restock action by target amount (`PATCH /api/admin/medicines/:id/restock`).
    *   **Safe Deletion**: Deleting a medicine automatically pulls it from all active user carts to prevent orphaned document references.

### 🏪 Module 4: In-Store POS (Point of Sale) Billing Counter
*   **Cashier Billing Terminal**: Staff-only terminal (`/admin/pos`) supporting barcode scanner input (exact match) and multi-token manual text fallback lookup.
*   **Fast Checkout Flow**:
    *   Client-side basket management until completion.
    *   Option to associate customer names and telephone numbers.
    *   Multiple payment methods supported (Cash, UPI, Card).
    *   Atomic stock validation and decrement with complete rollbacks on stock conflicts.
*   **Till Reconciliation & Refunds**:
    *   Live sidebar tracking today's POS revenue and total completed sales.
    *   Printable PDF receipt generation.
    *   Transaction refunds that restore item stock and mark the sale as `Refunded`.

### 📊 Module 5: Nightly Inventory Analytics (Python + Pandas)
*   **Standalone Analytics Engine**: A Pandas data pipeline ([inventory_analysis.py](file:///d:/Pharmasync/python-service/analytics/inventory_analysis.py)) that connects directly to the MongoDB instance.
*   **Key Statistical Indicators**:
    *   Loads medicine inventory and recent order transactions into DataFrames.
    *   Computes **Total Stock**, **Low Stock Count**, **Fast-Selling medicines**, and **Slow-Selling medicines** based on rolling lookbacks.
    *   Persists daily snapshot documents to MongoDB.
*   **Execution Channels**:
    *   Runs automatically via `cron` (daily at 2:00 AM) or Windows Task Scheduler.
    *   Triggerable on-demand via the Admin Dashboard's "Run Analysis Now" button (spawns Python subprocess).
    *   The Admin Dashboard queries the database to display the latest snapshot.

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
cp .env.example .env     # Edit MONGO_URI, JWT_SECRET, REFRESH_TOKEN_SECRET
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
*Note: If SMTP credentials (`SMTP_HOST`/`SMTP_USER`/`SMTP_PASS`) are left blank in `.env`, outgoing emails (e.g. registration, password reset) will be printed directly to the console instead.*

### 3. Running the React Frontend Client
Navigate to the `client/` folder:
```bash
cd ../client
cp .env.example .env     # Verify configuration points to backend
npm install
npm run dev              # Frontend SPA runs on http://localhost:5173
```

### 4. Running the Python Analytics Service
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
*   **Run manually**:
    ```bash
    python analytics/inventory_analysis.py
    ```
*   **Automate via Cron (Linux/macOS)**:
    Add to your crontab (`crontab -e`):
    ```cron
    0 2 * * * cd /absolute/path/to/python-service && venv/bin/python analytics/inventory_analysis.py >> ../logs/inventory_analysis.log 2>&1
    ```

---

## 🔌 API Endpoint Reference

### Authentication & Profiles
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| **POST** | `/api/auth/register` | Public | Register a new user account & send verification email |
| **POST** | `/api/auth/login` | Public | Log in as a customer or admin |
| **POST** | `/api/auth/admin/login` | Public | Privileged admin-only login route |
| **POST** | `/api/auth/refresh` | Public* | Exchange refresh token cookie for a new access token |
| **GET** | `/api/auth/verify-email/:token` | Public | Verify account email address |
| **POST** | `/api/auth/forgot-password` | Public | Request a password reset link |
| **POST** | `/api/auth/reset-password/:token` | Public | Submit new password using reset token |
| **GET** | `/api/auth/me` | Private | Get logged-in profile data |
| **POST** | `/api/auth/logout` | Private | Revoke active token session |
| **PATCH**| `/api/user/profile` | Private | Update user name, phone, or address |

*\* Requires a valid `refreshToken` cookie.*

### Storefront & Shopping Cart
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| **GET** | `/api/medicines` | Public | Browse catalog (supports `?search=`, `?sort=`, `?page=`) |
| **GET** | `/api/medicines/:id` | Public | Fetch detailed information for a single medicine |
| **GET** | `/api/cart` | Private | Fetch user's shopping cart |
| **POST** | `/api/cart/items` | Private | Add an item or increment quantity in cart |
| **PATCH**| `/api/cart/items/:id` | Private | Edit item quantity in cart |
| **DELETE**| `/api/cart/items/:id` | Private | Remove a medicine from the cart |
| **DELETE**| `/api/cart` | Private | Clear shopping cart |

### Orders & Checkout
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| **POST** | `/api/orders` | Private | Create a storefront order (checks & decrements stock) |
| **GET** | `/api/orders` | Private | List order history for the logged-in user |
| **GET** | `/api/orders/:id` | Private | Fetch order details |
| **PATCH**| `/api/orders/:id/cancel` | Private | Cancel order (Pending/Confirmed only; restocks items) |
| **GET** | `/api/orders/:id/invoice`| Private | Download invoice PDF for a storefront order |

### Admin Dashboard & Catalog Management
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| **GET** | `/api/admin/dashboard/stats` | Admin | Aggregate inventory stats, order counts, and channel revenue |
| **GET** | `/api/admin/medicines` | Admin | List all medicines in database (including discontinued) |
| **POST** | `/api/admin/medicines` | Admin | Add new medicine |
| **PATCH**| `/api/admin/medicines/:id` | Admin | Edit medicine details |
| **PATCH**| `/api/admin/medicines/:id/restock`| Admin | Restock a medicine by custom count |
| **DELETE**| `/api/admin/medicines/:id` | Admin | Delete medicine (pulls it from active user carts) |

### Admin Order Management
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| **GET** | `/api/admin/orders` | Admin | List all client orders (supports `?status=` filter) |
| **PATCH**| `/api/admin/orders/:id/status`| Admin | Manually update order stage or cancel order |

### In-Store POS (Point of Sale) Billing
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| **GET** | `/api/admin/pos/search` | Admin | Search counter items by exact barcode or token match |
| **POST** | `/api/admin/pos/sales` | Admin | Complete a POS checkout transaction and decrement stock |
| **GET** | `/api/admin/pos/sales` | Admin | Fetch sales history (supports `?from=`, `?to=` date filters) |
| **GET** | `/api/admin/pos/sales/:id` | Admin | Fetch detailed transaction details for a POS sale |
| **PATCH**| `/api/admin/pos/sales/:id/refund`| Admin | Refund a sale and restore medicine stock levels |
| **GET** | `/api/admin/pos/sales/:id/receipt`| Admin | Download printable receipt PDF for a counter sale |

### Analytics
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| **GET** | `/api/admin/inventory-analysis` | Admin | Fetch the latest nightly stats snapshot |
| **POST** | `/api/admin/inventory-analysis/run` | Admin | Trigger python analysis pipeline on-demand |
