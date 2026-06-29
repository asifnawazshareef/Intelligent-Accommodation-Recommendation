import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "./context/ThemeContext.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import PublicLayout from "./components/layout/PublicLayout.jsx";
import RoleBasedRoute from "./components/auth/RoleBasedRoute.jsx";
import HomePage from "./pages/HomePage.jsx";
import SearchPage from "./pages/SearchPage.jsx";
import PropertyDetailPage from "./pages/PropertyDetailPage.jsx";
import LoginPage from "./pages/auth/LoginPage.jsx";
import RegisterPage from "./pages/auth/RegisterPage.jsx";
import GuestDashboard from "./pages/guest/GuestDashboard.jsx";
import GuestBookingsPage from "./pages/guest/GuestBookingsPage.jsx";
import GuestOfflineRequestsPage from "./pages/guest/GuestOfflineRequestsPage.jsx";
import BookingNewPage from "./pages/guest/BookingNewPage.jsx";
import BookingPaymentPage from "./pages/guest/BookingPaymentPage.jsx";
import BookingPaymentSuccessPage from "./pages/guest/BookingPaymentSuccessPage.jsx";
import OwnerDashboard from "./pages/owner/OwnerDashboard.jsx";
import OwnerPropertiesPage from "./pages/owner/OwnerPropertiesPage.jsx";
import OwnerPropertyNewPage from "./pages/owner/OwnerPropertyNewPage.jsx";
import OwnerPropertyEditPage from "./pages/owner/OwnerPropertyEditPage.jsx";
import AdminDashboard from "./pages/admin/AdminDashboard.jsx";
import AdminImageAuditPage from "./pages/admin/AdminImageAuditPage.jsx";
import AdminListingsPage from "./pages/admin/AdminListingsPage.jsx";
import AdminUsersPage from "./pages/admin/AdminUsersPage.jsx";
import OfflineBookingPage from "./pages/OfflineBookingPage.jsx";
import OwnerOfflineRequestsPage from "./pages/owner/OwnerOfflineRequestsPage.jsx";
import ReviewSentimentTestPage from "./pages/ReviewSentimentTestPage.jsx";
import Toaster from "./components/ui/toaster.jsx";
import "./i18n";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <Toaster />
          <Routes>
            <Route element={<PublicLayout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/properties/:id" element={<PropertyDetailPage />} />
              <Route path="/offline-booking" element={<OfflineBookingPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
            </Route>

            <Route
              path="/review-sentiment-test"
              element={<ReviewSentimentTestPage />}
            />

            <Route
              path="/guest/dashboard"
              element={
                <RoleBasedRoute allowedRoles={["guest"]}>
                  <GuestDashboard />
                </RoleBasedRoute>
              }
            />
            <Route
              path="/guest/bookings"
              element={
                <RoleBasedRoute allowedRoles={["guest"]}>
                  <GuestBookingsPage />
                </RoleBasedRoute>
              }
            />
            <Route
              path="/guest/offline-requests"
              element={
                <RoleBasedRoute allowedRoles={["guest"]}>
                  <GuestOfflineRequestsPage />
                </RoleBasedRoute>
              }
            />
            <Route
              path="/bookings/new/:propertyId"
              element={
                <RoleBasedRoute allowedRoles={["guest"]}>
                  <BookingNewPage />
                </RoleBasedRoute>
              }
            />
            <Route
              path="/bookings/payment/:bookingId"
              element={
                <RoleBasedRoute allowedRoles={["guest"]}>
                  <BookingPaymentPage />
                </RoleBasedRoute>
              }
            />
            <Route
              path="/bookings/payment-success"
              element={
                <RoleBasedRoute allowedRoles={["guest"]}>
                  <BookingPaymentSuccessPage />
                </RoleBasedRoute>
              }
            />
            <Route
              path="/owner/dashboard"
              element={
                <RoleBasedRoute allowedRoles={["owner"]}>
                  <OwnerDashboard />
                </RoleBasedRoute>
              }
            />
            <Route
              path="/owner/properties"
              element={
                <RoleBasedRoute allowedRoles={["owner"]}>
                  <OwnerPropertiesPage />
                </RoleBasedRoute>
              }
            />
            <Route
              path="/owner/properties/new"
              element={
                <RoleBasedRoute allowedRoles={["owner"]}>
                  <OwnerPropertyNewPage />
                </RoleBasedRoute>
              }
            />
            <Route
              path="/owner/properties/:id/edit"
              element={
                <RoleBasedRoute allowedRoles={["owner"]}>
                  <OwnerPropertyEditPage />
                </RoleBasedRoute>
              }
            />
            <Route
              path="/owner/offline-requests"
              element={
                <RoleBasedRoute allowedRoles={["owner"]}>
                  <OwnerOfflineRequestsPage />
                </RoleBasedRoute>
              }
            />
            <Route
              path="/admin/dashboard"
              element={
                <RoleBasedRoute allowedRoles={["admin"]}>
                  <AdminDashboard />
                </RoleBasedRoute>
              }
            />
            <Route
              path="/admin/image-audit"
              element={
                <RoleBasedRoute allowedRoles={["admin"]}>
                  <AdminImageAuditPage />
                </RoleBasedRoute>
              }
            />
            <Route
              path="/admin/listings"
              element={
                <RoleBasedRoute allowedRoles={["admin"]}>
                  <AdminListingsPage />
                </RoleBasedRoute>
              }
            />
            <Route
              path="/admin/users"
              element={
                <RoleBasedRoute allowedRoles={["admin"]}>
                  <AdminUsersPage />
                </RoleBasedRoute>
              }
            />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>,
);
