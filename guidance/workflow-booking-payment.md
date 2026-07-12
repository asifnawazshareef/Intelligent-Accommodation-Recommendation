# Workflow: Booking & Payment

Actors: **Guest** (payer), system (Stripe webhook / demo confirm)

---

## Goal

Reserve a property for date range, confirm payment, update booking status so review eligibility can unlock later.

---

## Steps

1. Guest opens property → Book  
2. `/bookings/new/:propertyId` — select dates / guests  
3. `POST /api/bookings` creates booking (amount via `bookingAmount.js`)  
4. Navigate to `/bookings/payment/:bookingId`  
5. Choose payment path:

### Path A — Stripe

1. `POST /api/payments/stripe/create-checkout-session`  
2. Redirect to Stripe Checkout  
3. Return to `/bookings/payment-success`  
4. `GET /api/payments/stripe/verify-session`  
5. Webhook `POST /api/payments/stripe/webhook` (raw body) also marks paid  

### Path B — Demo confirm (dev / FYP demo)

1. `PUT /api/bookings/:id/confirm-demo-payment`  
2. Booking marked paid/confirmed without real charge  

6. Guest sees booking on `/guest/bookings`  
7. Optional cancel: `PUT /api/bookings/:id/cancel` when allowed  

Owner may list related bookings via `GET /api/bookings/owner-bookings`.

---

## Files

| Layer | Files |
|-------|-------|
| Pages | `BookingNewPage`, `BookingPaymentPage`, `BookingPaymentSuccessPage`, `GuestBookingsPage` |
| Components | `components/bookings/*` |
| Services | `bookingService.js`, `paymentService.js` |
| Backend | `bookingController.js`, `stripePaymentController.js`, `bookingRoutes.js`, `stripePaymentRoutes.js`, `config/stripe.js` |
| Utils | `bookingAmount.js`, `bookingReviewStatus.js` |
| Model | `Booking.js` |
| Webhook | `server.js` (Stripe raw body route) |

---

## Status notes

Exact enum values live in `Booking` model / controller. Conceptually:

```text
created/pending → paid/confirmed → (optional) cancelled
```

Only eligible confirmed bookings should allow reviews.

---

## Test

- [ ] Create booking with valid dates  
- [ ] Demo payment confirms status  
- [ ] Stripe path works when keys configured  
- [ ] Cancel updates status  
- [ ] Owner can see booking on their property  
- [ ] Invalid date ranges rejected  
