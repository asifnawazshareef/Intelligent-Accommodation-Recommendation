# Guest Role Guidance

Role value: `"guest"`.

Guests are the travellers who search, book, pay, leave reviews, and optionally submit offline booking requests.

---

## 1. Pages the guest uses

| Route | Page | Purpose |
|-------|------|---------|
| `/` | `HomePage.jsx` | Home + recommendations |
| `/search` | `SearchPage.jsx` | Search results |
| `/properties/:id` | `PropertyDetailPage.jsx` | Details, reviews, sentiment, book |
| `/offline-booking` | `OfflineBookingPage.jsx` | Form-based offline request |
| `/login`, `/register` | Auth pages | Account |
| `/guest/dashboard` | `GuestDashboard.jsx` | Guest hub |
| `/guest/bookings` | `GuestBookingsPage.jsx` | Bookings + review entry |
| `/guest/offline-requests` | `GuestOfflineRequestsPage.jsx` | Offline request status |
| `/bookings/new/:propertyId` | `BookingNewPage.jsx` | Create booking |
| `/bookings/payment/:bookingId` | `BookingPaymentPage.jsx` | Pay |
| `/bookings/payment-success` | `BookingPaymentSuccessPage.jsx` | Confirm payment |

Guarded routes use `RoleBasedRoute` with `allowedRoles={["guest"]}`.

---

## 2. Guest journeys (step by step)

### A. Browse & search (no login required)

1. Open `/` or `/search`
2. Enter city / price / filters
3. See approved properties only
4. Open `/properties/:id`
5. Read description, gallery (guest-filtered images), reviews, sentiment summary

**APIs:** `GET /api/search`, `GET /api/properties/:id`, `GET /api/reviews/property/:id`, `GET /api/sentiment/property/:id`  
**Files:** `searchController.js`, `propertyController.js`, review/sentiment controllers + UI components

---

### B. Personalized recommendations (logged in)

1. Login as guest
2. View properties (tracks views), search, book, review over time
3. Open `/` — recommendations switch from cold start → personalized sections when history is enough

**API:** `GET /api/recommendations` (optional JWT)  
**Files:** See [recommendations.md](./recommendations.md)

View tracking: `POST /api/properties/:id/view` (guest only).

---

### C. Book & pay

1. From property detail → Book  
2. `/bookings/new/:propertyId` — choose dates / guests  
3. Create booking → `POST /api/bookings`  
4. `/bookings/payment/:bookingId`  
5. Either:
   - Stripe checkout → `POST /api/payments/stripe/create-checkout-session` then verify  
   - Demo confirm → `PUT /api/bookings/:id/confirm-demo-payment`  
6. `/bookings/payment-success`  
7. Booking appears in `/guest/bookings`

**Files:** `bookingController.js`, `stripePaymentController.js`, `bookingAmount.js`, guest booking pages + `paymentService.js`

---

### D. Cancel booking

1. `/guest/bookings`  
2. Cancel eligible booking → `PUT /api/bookings/:id/cancel`

---

### E. Leave review → sentiment

1. Complete a paid/eligible booking  
2. From bookings or property page, open review form  
3. Check eligibility → `GET /api/reviews/eligible/:propertyId`  
4. Submit → `POST /api/reviews`  
5. Server calls sentiment-service `/predict`  
6. Sentiment saved on review + property snapshot updated  
7. Guest (and others) see polarity/aspects on property page  

**Files:** [sentiment-model.md](./sentiment-model.md), `reviewController.js`, review components

---

### F. Offline booking request

1. `/offline-booking` — fill form (property/contact/dates/message)  
2. `POST /api/offline-requests`  
3. Track status at `/guest/offline-requests`  
4. Owner responds; guest sees updated status  

No real SMS — form-based only.

---

## 3. Guest APIs cheat sheet

| Method | Path | Auth |
|--------|------|------|
| POST | `/api/auth/register` (role guest) | Public |
| POST | `/api/auth/login` | Public |
| GET | `/api/auth/me` | JWT |
| GET | `/api/search` | Optional |
| GET | `/api/recommendations` | Optional |
| GET | `/api/properties/:id` | Optional |
| POST | `/api/properties/:id/view` | Guest |
| POST | `/api/bookings` | Guest |
| GET | `/api/bookings/my-bookings` | Guest |
| PUT | `/api/bookings/:id/cancel` | Guest |
| PUT | `/api/bookings/:id/confirm-demo-payment` | Guest |
| POST | `/api/payments/stripe/create-checkout-session` | Guest |
| GET | `/api/payments/stripe/verify-session` | Guest |
| POST | `/api/reviews` | Guest |
| GET | `/api/reviews/eligible/:propertyId` | Guest |
| POST | `/api/offline-requests` | Optional |
| GET | `/api/offline-requests/guest` | Guest |

---

## 4. Services used

`authService`, `searchService`, `propertyService`, `bookingService`, `paymentService`, `reviewService`, `offlineRequestService`

---

## 5. Testing checklist (guest)

- [ ] Register/login as guest  
- [ ] Search approved property  
- [ ] See cold-start recommendations when logged out  
- [ ] View property → history builds  
- [ ] Create booking → pay (demo or Stripe)  
- [ ] Cancel a booking when allowed  
- [ ] Submit review → sentiment appears  
- [ ] Submit offline request → status visible  
- [ ] Switch language to Urdu/Arabic — layout OK  
