# Backend Modules Guidance

Express API under `server/`. Entry: `server/server.js`.

---

## 1. Layer overview

```text
routes/  →  controllers/  →  models/ + utils/ + services/
              ↑
         middleware/ (auth, roles, upload, errors)
```

Config: `server/config/db.js`, `server/config/stripe.js`.

---

## 2. Controllers

| File | Module | Guidance |
|------|--------|----------|
| `authController.js` | Auth | Register, login, get current user. Issues JWT. |
| `propertyController.js` | Listings | CRUD, image upload merge, view tracking, owner lists. |
| `bookingController.js` | Bookings | Create, list (guest/owner), cancel, demo payment confirm. |
| `stripePaymentController.js` | Payments | Checkout session, verify session; webhook marks paid. |
| `reviewController.js` | Reviews | Create (triggers sentiment), list by property, eligible bookings. |
| `sentimentController.js` | Sentiment summary | Property-level aggregated sentiment for UI. |
| `searchController.js` | Search + Recs | Filter search; full recommendation orchestration. |
| `offlineRequestController.js` | Offline booking | Create request; guest/owner lists; owner respond. |
| `imageAuditController.js` | Image audit | Admin list/update image verification. |
| `listingModerationController.js` | Moderation | Pending listings; approve/reject with verified-image gate. |
| `userManagementController.js` | Admin users | List users; verify flag; change role. |

---

## 3. Routes → mounts

| Route file | Mounted at | Notes |
|------------|------------|-------|
| `authRoutes.js` | `/api/auth` | Public register/login; protected `/me` |
| `propertyRoutes.js` | `/api/properties` | Mix of public + owner + admin helpers |
| `searchRoutes.js` | `/api` | `/search`, `/recommendations` |
| `bookingRoutes.js` | `/api/bookings` | Guest/owner booking ops |
| `stripePaymentRoutes.js` | `/api/payments/stripe` | Checkout + verify |
| `reviewRoutes.js` | `/api/reviews` | Reviews |
| `sentimentRoutes.js` | `/api/sentiment` | Property sentiment |
| `offlineRequestRoutes.js` | `/api/offline-requests` | Offline forms |
| `adminRoutes.js` | `/api/admin` | Users, listings, image-audit |

Also in `server.js`: Stripe webhook (raw body), `/api/health`, static `/uploads`.

---

## 4. Models

| Model | Purpose |
|-------|---------|
| `User.js` | Roles: guest / owner / admin; profile fields |
| `Property.js` | Listing, images+verification, sentimentSnapshot, status |
| `Booking.js` | Dates, amount, payment/status |
| `Review.js` | Stars, text, sentiment payload |
| `OfflineRequest.js` | Form-based offline booking |
| `PropertyView.js` | View events for personalization |
| `SearchHistory.js` | Search events for personalization |

---

## 5. Middleware

| File | Purpose |
|------|---------|
| `authMiddleware.js` | `protect`, `optionalProtect` (JWT) |
| `roleMiddleware.js` | `authorize(...roles)` |
| `uploadMiddleware.js` | Multer property images |
| `errorMiddleware.js` | `notFound` + central error handler |

---

## 6. Services

| File | Purpose |
|------|---------|
| `sentimentService.js` | Call FastAPI `/predict`; timeout/fallback |

---

## 7. Utils by domain

### Auth / money / bookings

| File | Purpose |
|------|---------|
| `generateToken.js` | Sign JWT |
| `bookingAmount.js` | Nights × price; Stripe amount helpers |
| `bookingReviewStatus.js` | Attach `hasReview` to bookings |

### Images

| File | Purpose |
|------|---------|
| `imageVerification.js` | Hash, duplicates, statuses, guest filter |
| `imageAiScore.js` | Heuristic AI score |

### Sentiment aggregation

| File | Purpose |
|------|---------|
| `propertySentimentStore.js` | Sync property snapshot |
| `sentimentAggregation.js` | Counts, aspects, insights |
| `reviewSentimentRecommendation.js` | ReviewAnalysisScore feature |

### Recommendations

| File | Purpose |
|------|---------|
| `personalizedRecommendationEngine.js` | Hybrid ranking engine |
| `recommendationWeights.js` | Tunable config |
| `bayesianRanking.js` | Bayesian rating/quality + market caches |
| `buildUserProfile.js` | Guest preference profile |
| `collaborativeFiltering.js` | Co-occurrence |
| `recommendationEnrichment.js` | Enrichment / reasons helpers |
| `recommendationTransparency.js` | Explainability metadata |
| `propertySignals.js` | Availability / amenity / aspect signals |
| `propertySimilarity.js` | Similarity helpers |

Deep dive: [recommendations.md](./recommendations.md), [sentiment-model.md](./sentiment-model.md), [image-audit.md](./image-audit.md).

---

## 8. Scripts (`server/scripts/`)

| Script | When to use |
|--------|-------------|
| `seed.js` / `seedAdmin.js` / `seedProperties.js` / `seedDemoReviews.js` | Local demo data |
| `clearListings.js` | Wipe listings carefully |
| `reanalyzeReviews.js` | After sentiment model change |
| `syncPropertySentiment.js` | Rebuild snapshots |

---

## 9. Env vars (typical)

Check `server/.env` (do not commit secrets):

- `MONGO_URI`
- `JWT_SECRET`
- `CLIENT_URL` / CORS origins
- `SENTIMENT_API_URL`
- Stripe keys (`STRIPE_SECRET_KEY`, webhook secret, …)

---

## 10. Adding a backend change (safe pattern)

1. Confirm feature is **in FYP scope**  
2. Prefer extending existing controller/util over new product features  
3. Keep recommendation weights in `recommendationWeights.js`  
4. Keep sentiment calls behind `sentimentService.js`  
5. Protect admin/owner routes with `protect` + `authorize`  
6. Return consistent JSON error shapes via error middleware  
