# All Workflows Guidance (Index)

Every major product workflow in IARS. Each section links to a detailed guide.

| # | Workflow | Actors | Detail file |
|---|----------|--------|-------------|
| 1 | Authentication | Guest / Owner / Admin | [workflow-auth.md](./workflow-auth.md) |
| 2 | Listing create → image verify → approve | Owner → Admin → Public | [workflow-listing.md](./workflow-listing.md) |
| 3 | Search & view | Public / Guest | [workflow-search-recommend.md](./workflow-search-recommend.md) |
| 4 | Recommendations | Guest / Public | [recommendation-system-complete.md](./recommendation-system-complete.md) · [workflow-search-recommend.md](./workflow-search-recommend.md) · [recommendations.md](./recommendations.md) |
| 5 | Booking & payment | Guest | [workflow-booking-payment.md](./workflow-booking-payment.md) |
| 6 | Review & sentiment | Guest + ML service | [workflow-review-sentiment.md](./workflow-review-sentiment.md) |
| 7 | Offline booking (form) | Guest ↔ Owner | [workflow-offline.md](./workflow-offline.md) |
| 8 | Admin moderation & users | Admin | [workflow-admin.md](./workflow-admin.md) |
| 9 | End-to-end FYP chain | All | [main-workflow.md](./main-workflow.md) |

Role walkthroughs: [roles.md](./roles.md)

---

## Quick swimlane (happy path)

```text
OWNER                         ADMIN                         GUEST
  |                             |                             |
  |-- register/login ---------->|                             |
  |-- create listing + images ->|                             |
  |                             |-- audit images              |
  |                             |-- approve listing --------->|
  |                             |                             |-- search / recommendations
  |                             |                             |-- view property
  |                             |                             |-- book + pay
  |                             |                             |-- leave review
  |                             |                             |     |
  |                             |                             |     v
  |                             |                      sentiment-service /predict
  |                             |                             |-- see sentiment on listing
  |<-- offline request respond -|<---- (optional offline) ----|
```

---

## Status vocabulary (common)

### Property.status
Typically: `pending` → `approved` | `rejected`

### Image.verificationStatus
Typically: `pending` / `verified` / `rejected` / `suspicious` (exact enum in `imageVerification.js` / Property schema)

### Booking.status / payment
Pending → confirmed/paid (via Stripe webhook or demo confirm) → cancellable when rules allow

### OfflineRequest.status
Pending → owner responded (accepted/declined/etc. as implemented)

---

## Cross-cutting rules for every workflow

1. Stay inside FYP scope  
2. Use i18n for UI text  
3. Do not translate user-generated content  
4. Sentiment analyzes; recommendation ranks  
5. Personalization cannot bypass quality floor  
6. Listing approval needs ≥ 1 verified image  
