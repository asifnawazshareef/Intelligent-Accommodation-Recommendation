# Image Audit & Verification Guidance

How property images are scored, verified, audited by admin, and gated for listing approval.

---

## 1. Purpose

Owners upload listing photos. The system:

1. Stores files under `uploads/properties`
2. Computes metadata (hash, size, dimensions-related signals)
3. Detects **duplicate** images (SHA-256) → can mark suspicious
4. Assigns a **heuristic AI score** (not a trained CNN)
5. Lets **admin** verify / reject / adjust in Image Audit
6. Blocks listing **approval** until ≥ 1 image is verified

Guests only see images that pass the guest-facing filter.

---

## 2. Important clarification

The “AI score” in this FYP is a **heuristic** from image signals (resolution, compression, aspect, file size), implemented in Node — **not** a deep-learning vision model.

Admin judgement remains the final verification step.

---

## 3. Backend files

| File | Role |
|------|------|
| `server/middleware/uploadMiddleware.js` | Multer upload to disk |
| `server/utils/imageVerification.js` | Hash, duplicate detection, status pipeline, `filterGuestImages` |
| `server/utils/imageAiScore.js` | `computeImageAiScore` / `scoreFromSignals` |
| `server/controllers/propertyController.js` | Create/update property with images → attach verification fields |
| `server/controllers/imageAuditController.js` | Admin list + update verification status / score |
| `server/controllers/listingModerationController.js` | Approve/reject listings; **verified-image gate** |
| `server/routes/adminRoutes.js` | `/api/admin/image-audit`, `/api/admin/listings/*` |
| `server/models/Property.js` | Embedded `images[]` schema fields |
| `server/controllers/searchController.js` | Applies guest image filter on public results |

### Typical image fields on `Property.images[]`

- `url`
- `hash` (SHA-256)
- `verificationStatus` (e.g. pending / verified / rejected / suspicious)
- `aiScore`
- Related metadata used by scoring / audit UI

---

## 4. Frontend files

| File | Role |
|------|------|
| `client/src/pages/admin/AdminImageAuditPage.jsx` | Admin audit workspace |
| `client/src/pages/admin/AdminListingsPage.jsx` | Moderation; depends on verified images |
| `client/src/services/imageAuditService.js` | Admin image-audit API calls |
| `client/src/services/listingModerationService.js` | Approve / reject listings |
| `client/src/components/imageAudit/*` | Stats bar, AI score meter, badges, property groups |
| `client/src/lib/imageVerification.js` | Client helpers for status display |
| `client/src/lib/imageUrl.js` | Resolve upload URLs for `<img>` |

Owner upload UX lives in property create/edit form components under `client/src/components/properties/`.

---

## 5. Admin flow

```text
Owner uploads images
  → verification metadata saved (pending + aiScore + hash)
  → Admin opens /admin/image-audit
  → Reviews scores / duplicates
  → Marks verified or rejected
  → Admin opens /admin/listings
  → Approves listing only if ≥ 1 verified image
  → Property appears in public search
```

---

## 6. API (admin)

Mounted under `/api/admin` (admin role required):

- Image audit list / update endpoints → `imageAuditController`
- Pending listings / approve / reject → `listingModerationController`

Exact path names: see `server/routes/adminRoutes.js`.

---

## 7. Guest safety

`filterGuestImages` (in `imageVerification.js`) ensures public cards/detail do not expose inappropriate unverified/rejected assets according to project rules.

When changing image status logic, re-test:

- Home / Search cards  
- Property detail gallery  
- Owner dashboard (owner may still need to see their uploads)  

---

## 8. Debugging checklist

1. File landed in `server/uploads/properties`?  
2. Image document has `hash` and `aiScore`?  
3. Duplicate of another listing image → suspicious?  
4. Admin can change status on Image Audit page?  
5. Approve listing blocked until one verified image?  
6. After approve, guest search shows the property with filtered images?  
