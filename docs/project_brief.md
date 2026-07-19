# PharmaSync Project Brief

PharmaSync is a production-grade pharmacy management application designed to handle authentication, storefront browsing, carts, order tracking, and inventory management across both online storefronts and a future in-store POS (Point of Sale) billing system.

---

## 📁 Project Structure

```
pharma-management/ (PharmaSync)
├── client/            # React frontend (Vite + React Router + Axios)
├── server/            # Node.js + Express API (JWT, MongoDB, Mongoose)
├── python-service/    # Django + Pandas + AI (for analytics/reporting in later modules)
├── database/          # Database notes & seeding scripts
├── uploads/           # Prescription uploads (for prescription validation in future modules)
├── docs/              # Project documentation
└── README.md          # Project readme with setup instructions
```

---

## 🔑 Module 1: Production-Grade Authentication (Completed)

- **Role-Based Access**: Distinguishes between guest browsing, registered `user` roles, and privileged `admin` roles.
- **Security Features**:
  - **httpOnly Cookies**: JWTs (`accessToken`, `refreshToken`) stored on the server side to minimize XSS token-stealing risk.
  - **Refresh Token Rotation**: Short-lived access token (15 mins) and long-lived refresh token (30 days) with client-side silent refresh rotation.
  - **Server-Side Revocation**: Session token hashes are stored on user documents, allowing immediate server-side validation/invalidation upon logout.
  - **Security Middleware**: Centralized error handling, rate limiting on auth endpoints, and input sanitization/validation using `express-validator`.
  - **Self-Service**: Email verification and password resets (using Ethereal for dev mailboxes / console logging, and Gmail/custom SMTP options for production).

---

## 🛒 Module 2: Storefront, Cart, and Order Flow (Completed)

- **Catalog Seeding**: Built on a curated ~1,150 common medicines subset derived from the *Indian Medicine Dataset*.
- **Shopping Cart**: Fully database-persisted cart requiring a user login.
- **Address & Geolocation**: Integrates browser-based geolocation and free OpenStreetMap previews for user address input.
- **Transactions & Orders**:
  - Atomic stock validation decrement at checkout with rollback capabilities.
  - GST breakup back-calculated from MRP at a flat 12% rate.
  - GST-compliant invoice generator in PDF format.
  - Order state machine (`Pending` ➔ `Confirmed` ➔ `Packed` ➔ `Out for Delivery` ➔ `Delivered`) that automatically simulates progression on a timer unless overridden by an admin.

---

## 📦 Module 3: Admin & Inventory Management (Completed)

We have successfully implemented the core dashboard overview and CRUD management views for pharmacy stock and catalog metadata.

### 1. Dashboard Overview Stats
- **Implementation File**: `server/controllers/adminController.js` (via `getDashboardStats`)
- **Endpoint**: `GET /api/admin/dashboard/stats`
- **Features**:
  - Real-time metrics counting: **Total Medicines**, **Total Orders**, **Gross Revenue** (summing non-cancelled orders).
  - **Low Stock Count** and **Expiring Soon Count** based on shared threshold values defined in `server/utils/inventoryConstants.js` (`LOW_STOCK_THRESHOLD = 10` and `EXPIRY_WINDOW_DAYS = 30`).
  - Linked dashboard widgets in `client/src/pages/AdminDashboard.jsx` that navigate directly to filtered views of the medicine list.

### 2. Catalog & Medicine CRUD
- **Controller**: `server/controllers/medicineController.js`
- **Routes**: `server/routes/adminRoutes.js` (guarded by `protect` and `adminOnly` middlewares)
- **Frontend Component**: `client/src/pages/AdminMedicines.jsx`
- **Key Capabilities**:
  - **Interactive Table**: Shows details, stock status badge (Discontinued, Out of Stock, Low, or Good), and actions.
  - **Query-Based Filters**: Allows admins to view *Low Stock* or *Expiring Soon* products directly via search URL parameters.
  - **Case-Insensitive Substring Token Search**: Word tokens are split and searched across `name`, `manufacturer`, and `composition` fields (e.g. searching "amox clav" works regardless of token ordering).
  - **Quick Restock**: Admins can use a restock action to increase stock counts instantly (`PATCH /api/admin/medicines/:id/restock`).
  - **Delete Medicine**: Deletes a record from the database and uses `$pull` in MongoDB to remove it from all user carts dynamically so users aren't left with dangling/orphaned cart items (`DELETE /api/admin/medicines/:id`).

### 3. Add & Edit Medicines
- **Input Validation**: Strict validation rules configured in `server/middleware/validators.js` (`addMedicineRules`, `updateMedicineRules`) covering prices, whole-number quantities, dates, and names.
- **Add Medicine** (`client/src/pages/AdminAddMedicine.jsx`): Allows full entry of brand, category, price, quantity, expiry date, manufacturer, description, and prescription requirement.
- **Edit Medicine** (`client/src/pages/AdminEditMedicine.jsx`): Pre-populates the form with existing database records and allows partial changes. Since there is a single shared MongoDB collection, any updates here instantly sync on the online storefront.

---

## 🚀 Next Steps (Future Roadmap)

- Offline POS billing panel for counter sales.
- Sales, inventory, and expiry analytics (Django service using Pandas to compile CSV/PDF reports).
- AI chatbot & alerts based on prescription uploads.
- Real Google Maps API integration for checkout.
