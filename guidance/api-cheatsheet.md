# API Cheatsheet

Base path: `/api` on the Express server. Sentiment ML is a separate service on port `8000`.

Auth header: `Authorization: Bearer <JWT>`

---

## Auth — `/api/auth`

| Method | Path | Auth | Role |
|--------|------|------|------|
| POST | `/register` | Public | — |
| POST | `/login` | Public | — |
| GET | `/me` | JWT | any |

---

## Properties — `/api/properties`

| Method | Path | Auth | Role |
|--------|------|------|------|
| GET | `/` | Public | — |
| GET | `/:id` | Optional | — |
| GET | `/owner/my-properties` | JWT | owner |
| POST | `/` | JWT + multipart | owner |
| PUT | `/:id` | JWT + multipart | owner |
| POST | `/:id/view` | JWT | guest |
| PUT | `/:id/moderate` | JWT | admin |

---

## Search & recommendations — `/api`

| Method | Path | Auth |
|--------|------|------|
| GET | `/search` | Optional JWT |
| GET | `/recommendations` | Optional JWT |

Query examples: `?city=Lahore&minPrice=5000&maxPrice=20000&availabilityDate=YYYY-MM-DD`

---

## Bookings — `/api/bookings`

| Method | Path | Role |
|--------|------|------|
| POST | `/` | guest |
| GET | `/my-bookings` | guest |
| GET | `/owner-bookings` | owner |
| GET | `/:id` | (controller rules) |
| PUT | `/:id/confirm-demo-payment` | guest |
| PUT | `/:id/cancel` | guest |

---

## Stripe — `/api/payments/stripe`

| Method | Path | Role |
|--------|------|------|
| POST | `/create-checkout-session` | guest |
| GET | `/verify-session` | guest |
| POST | `/webhook` | Stripe signature (raw body in `server.js`) |

---

## Reviews — `/api/reviews`

| Method | Path | Role |
|--------|------|------|
| POST | `/` | guest |
| GET | `/property/:propertyId` | public |
| GET | `/eligible/:propertyId` | guest |

---

## Sentiment summary — `/api/sentiment`

| Method | Path | Auth |
|--------|------|------|
| GET | `/property/:propertyId` | public |

---

## Offline requests — `/api/offline-requests`

| Method | Path | Auth |
|--------|------|------|
| POST | `/` | optional |
| GET | `/guest` | guest |
| GET | `/owner` | owner |
| PUT | `/:id/respond` | owner |

---

## Admin — `/api/admin`

| Method | Path |
|--------|------|
| GET | `/users` |
| PUT | `/users/:id/verify` |
| PUT | `/users/:id/role` |
| GET | `/image-audit` |
| PUT | `/image-audit/:propertyId/:imageId` |
| GET | `/listings/pending` |
| PUT | `/listings/:id/approve` |
| PUT | `/listings/:id/reject` |

All admin routes require JWT + admin role.

---

## Sentiment ML service (not under `/api`)

| Method | Path | Body |
|--------|------|------|
| GET | `/health` | — |
| POST | `/predict` | `{ "review": "text..." }` |

Called by Node `sentimentService.js`, not directly from the browser in production flow.
