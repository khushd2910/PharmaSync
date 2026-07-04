# Pharma Management System — Module 1: Authentication

This is the first module of the Pharmacy Management System, covering:

**User**: Register → Login (JWT) → Dashboard → (medicine shopping enabled in Module 2) → Logout
**Admin**: Admin Login → Admin Dashboard → (pharmacy management enabled in later modules) → Logout

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

## Prerequisites

- Node.js 18+
- MongoDB running locally (or an Atlas connection string)

## 1. Backend Setup (server/)

```bash
cd server
cp .env.example .env      # then edit MONGO_URI / JWT_SECRET as needed
npm install
npm run dev                # starts on http://localhost:5000
```

### Create the first Admin account

Public registration always creates a `user` role account. To create an admin:

```bash
cd server
node seed/createAdmin.js "Admin Name" admin@pharma.com "StrongPass123"
```

### API Endpoints (Module 1)

| Method | Endpoint                | Access        | Description                     |
|--------|--------------------------|---------------|----------------------------------|
| POST   | /api/auth/register       | Public        | Register a new user             |
| POST   | /api/auth/login          | Public        | Login as user or admin          |
| POST   | /api/auth/admin/login    | Public        | Login restricted to admins      |
| GET    | /api/auth/me             | Private       | Get current logged-in profile   |
| POST   | /api/auth/logout         | Private       | Logout (client discards token)  |
| GET    | /api/user/dashboard      | Private(user) | User dashboard placeholder      |
| GET    | /api/admin/dashboard     | Private(admin)| Admin dashboard placeholder     |

Auth uses stateless JWTs. After login/register, the client stores the token
in `localStorage` and sends it as `Authorization: Bearer <token>` on every
request (see `client/src/api/axios.js`).

## 2. Frontend Setup (client/)

```bash
cd client
cp .env.example .env       # points to the backend API
npm install
npm run dev                 # starts on http://localhost:5173
```

### Pages

- `/register` — user registration
- `/login` — user login
- `/admin/login` — admin login
- `/dashboard` — user dashboard (protected, user role)
- `/admin/dashboard` — admin dashboard (protected, admin role)

## What's Next (Module 2+)

- Medicine CRUD, search/filters/sorting, medicine details
- Cart, checkout, order history, profile
- Stock & order management, offline POS billing, GST invoice PDFs
- Sales/inventory/expiry analytics (Django + Pandas), CSV reports
- AI chatbot & prescription-based medicine alerts
