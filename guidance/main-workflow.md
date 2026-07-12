# Main Workflow Guidance

Maps each FYP step to the real files that implement it.

For **role-by-role** journeys see [roles.md](./roles.md).  
For **every named workflow** see [workflows.md](./workflows.md).

---

## 1. Owner registers / logs in

| Layer | Files |
|-------|-------|
| Page | `client/src/pages/auth/RegisterPage.jsx`, `LoginPage.jsx` |
| Service | `client/src/services/authService.js` |
| API | `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me` |
| Controller | `server/controllers/authController.js` |
| Model | `server/models/User.js` |
| Token | `server/utils/generateToken.js` |
| Client state | `client/src/context/AuthContext.jsx` |

Owner role is set at registration (or by admin later).

---

## 2. Owner creates property listing

| Layer | Files |
|-------|-------|
| Pages | `OwnerPropertyNewPage.jsx`, `OwnerPropertyEditPage.jsx`, `OwnerPropertiesPage.jsx` |
| Form UI | `client/src/components/properties/PropertyForm.jsx` (and related) |
| Service | `client/src/services/propertyService.js` |
| API | `POST/PUT /api/properties`, `GET /api/properties/owner` |
| Controller | `server/controllers/propertyController.js` |
| Model | `server/models/Property.js` |
| Auth | Owner role via `authorize("owner")` |

New listings start as **pending** until admin approval.

---

## 3–4. Owner uploads images → verification stored

| Layer | Files |
|-------|-------|
| Upload | `server/middleware/uploadMiddleware.js` → `uploads/properties` |
| Verification | `server/utils/imageVerification.js` |
| Heuristic score | `server/utils/imageAiScore.js` |
| Storage | `Property.images[]` fields: `url`, `hash`, `verificationStatus`, `aiScore`, … |

Statuses typically flow through pending / verified / rejected / suspicious (duplicates).

See [image-audit.md](./image-audit.md).

---

## 5. Admin reviews and approves property

| Layer | Files |
|-------|-------|
| Pages | `AdminListingsPage.jsx`, `AdminImageAuditPage.jsx` |
| Services | `listingModerationService.js`, `imageAuditService.js` |
| Controllers | `listingModerationController.js`, `imageAuditController.js` |
| Routes | `server/routes/adminRoutes.js` |
| Gate | Approval requires **≥ 1 verified image** |

Public search only shows `status: "approved"`.

---

## 6. Guest searches approved properties

| Layer | Files |
|-------|-------|
| Pages | `HomePage.jsx`, `SearchPage.jsx` |
| Hook | `client/src/hooks/usePropertySearch.js` |
| Components | `client/src/components/search/*` |
| Service | `client/src/services/searchService.js` |
| API | `GET /api/search` |
| Controller | `server/controllers/searchController.js` → `searchProperties` |
| History | `server/models/SearchHistory.js` (for recommendations later) |

---

## 7. Guest views property details

| Layer | Files |
|-------|-------|
| Page | `PropertyDetailPage.jsx` |
| API | `GET /api/properties/:id` (+ view tracking endpoint if used) |
| View model | `server/models/PropertyView.js` |
| Sentiment UI | Property sentiment snapshot / review list components |
| Images | Guest-facing filter via `filterGuestImages` |

---

## 8–9. Booking + payment

| Layer | Files |
|-------|-------|
| Pages | `BookingNewPage.jsx`, `BookingPaymentPage.jsx`, `BookingPaymentSuccessPage.jsx` |
| Services | `bookingService.js`, `paymentService.js` |
| Controllers | `bookingController.js`, `stripePaymentController.js` |
| Amount helper | `server/utils/bookingAmount.js` |
| Model | `server/models/Booking.js` |
| Webhook | Raw Stripe webhook in `server/server.js` |
| Demo path | `PUT /api/bookings/:id/confirm-demo-payment` |

Payment success updates booking status so the guest can later leave a review.

---

## 10–12. Review → sentiment → display

| Step | Files |
|------|-------|
| Write review UI | `client/src/components/reviews/*` on property / booking flow |
| Create review API | `server/controllers/reviewController.js` |
| Call ML | `server/services/sentimentService.js` → FastAPI `/predict` |
| Store on review | `server/models/Review.js` (`sentiment`, aspects, …) |
| Aggregate on property | `propertySentimentStore.js`, `sentimentAggregation.js` |
| Property summary API | `sentimentController.js` → `GET /api/sentiment/property/:id` |
| Display | Review badges, sentiment summary cards on detail page |

See [sentiment-model.md](./sentiment-model.md).

---

## 13. Admin manage users + audit decisions

| Layer | Files |
|-------|-------|
| Pages | `AdminUsersPage.jsx`, `AdminImageAuditPage.jsx`, `AdminDashboard.jsx` |
| Controllers | `userManagementController.js`, `imageAuditController.js` |
| Routes | `/api/admin/*` |

---

## Offline booking (form-based, in scope)

Not SMS. Guests submit a form; owners respond in-app.

| Layer | Files |
|-------|-------|
| Public form | `OfflineBookingPage.jsx` |
| Guest list | `GuestOfflineRequestsPage.jsx` |
| Owner inbox | `OwnerOfflineRequestsPage.jsx` |
| API | `offlineRequestController.js` / `OfflineRequest.js` |

---

## Recommendations (runs across search / home)

Triggered mainly by `GET /api/recommendations`.

Uses guest history (searches, views, bookings, reviews) when enough signal exists; otherwise cold start (ReviewAnalysis + Bayesian).

See [recommendations.md](./recommendations.md).
