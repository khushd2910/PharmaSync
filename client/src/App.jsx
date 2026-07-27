import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { CartProvider } from './context/CartContext';
import { ThemeProvider } from './context/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import PublicLayout from './components/PublicLayout';

import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import AdminLogin from './pages/AdminLogin';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import VerifyEmail from './pages/VerifyEmail';
import MedicineDetails from './pages/MedicineDetails';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import Orders from './pages/Orders';
import OrderDetails from './pages/OrderDetails';
import Profile from './pages/Profile';

// Admin/POS pages are a meaningful chunk of code a regular customer
// never needs — split them into their own lazily-loaded bundles so the
// storefront's initial download stays small. React.lazy + Suspense
// fetches each one only the first time its route is actually visited.
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const AdminOrders = lazy(() => import('./pages/AdminOrders'));
const AdminAddMedicine = lazy(() => import('./pages/AdminAddMedicine'));
const AdminMedicines = lazy(() => import('./pages/AdminMedicines'));
const AdminEditMedicine = lazy(() => import('./pages/AdminEditMedicine'));
const AdminPOS = lazy(() => import('./pages/AdminPOS'));
const AdminSalesAnalysis = lazy(() => import('./pages/AdminSalesAnalysis'));
const AdminReports = lazy(() => import('./pages/AdminReports'));
const AdminPrescriptions = lazy(() => import('./pages/AdminPrescriptions'));

const AdminPageFallback = () => <p className="info-text center-text admin-theme">Loading…</p>;

function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <CartProvider>
            <Suspense fallback={<AdminPageFallback />}>
            <Routes>
              {/* Public pages share the Navbar via PublicLayout */}
              <Route element={<PublicLayout />}>
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/admin/login" element={<AdminLogin />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password/:token" element={<ResetPassword />} />
                <Route path="/verify-email/:token" element={<VerifyEmail />} />
                <Route path="/medicines/:id" element={<MedicineDetails />} />

                <Route
                  path="/cart"
                  element={
                    <ProtectedRoute role="user">
                      <Cart />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/checkout"
                  element={
                    <ProtectedRoute role="user">
                      <Checkout />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/orders"
                  element={
                    <ProtectedRoute role="user">
                      <Orders />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/orders/:id"
                  element={
                    <ProtectedRoute role="user">
                      <OrderDetails />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/profile"
                  element={
                    <ProtectedRoute role="user">
                      <Profile />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/admin/dashboard"
                  element={
                    <ProtectedRoute role="admin">
                      <AdminDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/orders"
                  element={
                    <ProtectedRoute role="admin">
                      <AdminOrders />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/medicines/new"
                  element={
                    <ProtectedRoute role="admin">
                      <AdminAddMedicine />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/medicines"
                  element={
                    <ProtectedRoute role="admin">
                      <AdminMedicines />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/medicines/:id/edit"
                  element={
                    <ProtectedRoute role="admin">
                      <AdminEditMedicine />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/pos"
                  element={
                    <ProtectedRoute role="admin">
                      <AdminPOS />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/sales-analysis"
                  element={
                    <ProtectedRoute role="admin">
                      <AdminSalesAnalysis />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/reports"
                  element={
                    <ProtectedRoute role="admin">
                      <AdminReports />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/prescriptions"
                  element={
                    <ProtectedRoute role="admin">
                      <AdminPrescriptions />
                    </ProtectedRoute>
                  }
                />
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            </Suspense>
          </CartProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
