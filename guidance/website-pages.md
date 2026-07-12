# Website Pages Guidance

All routes are declared in `client/src/main.jsx`.

---

## 1. Public pages

| Route | Page file | Purpose | Key APIs / notes |
|-------|-----------|---------|------------------|
| `/` | `pages/HomePage.jsx` | Landing, search entry, recommendations surface | `/api/recommendations`, search navigation |
| `/search` | `pages/SearchPage.jsx` | Filtered property results | `GET /api/search` |
| `/properties/:id` | `pages/PropertyDetailPage.jsx` | Gallery, details, reviews, sentiment, book CTA | Property + reviews + sentiment |
| `/offline-booking` | `pages/OfflineBookingPage.jsx` | Public offline booking request form | `POST /api/offline-requests` |
| `/login` | `pages/auth/LoginPage.jsx` | Login | `POST /api/auth/login` |
| `/register` | `pages/auth/RegisterPage.jsx` | Register (guest/owner) | `POST /api/auth/register` |
| `/review-sentiment-test` | `pages/ReviewSentimentTestPage.jsx` | Dev/test sentiment UI (no main layout) | Sentiment predict path / reviews |

Layouts:

- Auth pages → `AuthShellLayout`
- Most public pages → `PublicLayout` (navbar/footer)

---

## 2. Guest pages (role: `guest`)

| Route | Page file | Purpose |
|-------|-----------|---------|
| `/guest/dashboard` | `guest/GuestDashboard.jsx` | Guest hub |
| `/guest/bookings` | `guest/GuestBookingsPage.jsx` | My bookings; review eligibility |
| `/guest/offline-requests` | `guest/GuestOfflineRequestsPage.jsx` | Guest offline request status |
| `/bookings/new/:propertyId` | `guest/BookingNewPage.jsx` | Create booking (dates/guests) |
| `/bookings/payment/:bookingId` | `guest/BookingPaymentPage.jsx` | Stripe or demo payment |
| `/bookings/payment-success` | `guest/BookingPaymentSuccessPage.jsx` | Verify payment success |

Guarded by `RoleBasedRoute` with `allowedRoles={["guest"]}`.

---

## 3. Owner pages (role: `owner`)

| Route | Page file | Purpose |
|-------|-----------|---------|
| `/owner/dashboard` | `owner/OwnerDashboard.jsx` | Owner hub / stats entry |
| `/owner/properties` | `owner/OwnerPropertiesPage.jsx` | Manage listings |
| `/owner/properties/new` | `owner/OwnerPropertyNewPage.jsx` | Create listing + images |
| `/owner/properties/:id/edit` | `owner/OwnerPropertyEditPage.jsx` | Edit listing + images |
| `/owner/offline-requests` | `owner/OwnerOfflineRequestsPage.jsx` | Respond to offline requests |

Image uploads on create/edit feed verification metadata (see [image-audit.md](./image-audit.md)).

---

## 4. Admin pages (role: `admin`)

| Route | Page file | Purpose |
|-------|-----------|---------|
| `/admin/dashboard` | `admin/AdminDashboard.jsx` | Admin hub |
| `/admin/image-audit` | `admin/AdminImageAuditPage.jsx` | Verify/reject images, review AI scores |
| `/admin/listings` | `admin/AdminListingsPage.jsx` | Approve/reject pending listings |
| `/admin/users` | `admin/AdminUsersPage.jsx` | Roles, verification flags |

Approval depends on verified images.

---

## 5. Page → feature map

| Feature | Primary pages |
|---------|----------------|
| Search | `/`, `/search` |
| Recommendations | `/`, `/search` (recommended components) |
| Sentiment display | `/properties/:id`, `/review-sentiment-test` |
| Reviews write/read | `/properties/:id`, `/guest/bookings` |
| Booking + payment | `/bookings/new/:propertyId`, `/bookings/payment/:bookingId`, success |
| Offline booking | `/offline-booking`, guest/owner offline pages |
| Image audit | `/admin/image-audit` |
| Listing moderation | `/admin/listings` |
| Listing create | `/owner/properties/new`, edit route |

---

## 6. UX expectations (all pages)

- Loading states while fetching  
- Empty states when no data  
- Clear error toasts/messages  
- Mobile-responsive layout  
- Works in English, Urdu (RTL), Arabic (RTL)  
- No hardcoded UI chrome text (use i18n)

---

## 7. When adding a new page

1. Confirm it is required by the main workflow (or an allowed improvement)  
2. Add route in `main.jsx` with correct layout + role guard  
3. Add service methods if new APIs are needed  
4. Add i18n keys in `en.json`, `ur.json`, `ar.json`  
5. Update this file (`website-pages.md`) so guidance stays accurate  
