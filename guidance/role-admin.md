# Admin Role Guidance

Role value: `"admin"`.

Admins protect platform quality: verify images, approve/reject listings, and manage users.

---

## 1. Pages the admin uses

| Route | Page | Purpose |
|-------|------|---------|
| `/admin/dashboard` | `AdminDashboard.jsx` | Hub / navigation |
| `/admin/image-audit` | `AdminImageAuditPage.jsx` | Review image hashes, AI scores, set verification status |
| `/admin/listings` | `AdminListingsPage.jsx` | Approve / reject pending listings |
| `/admin/users` | `AdminUsersPage.jsx` | List users, verify flag, change roles |

Public pages remain available for spot-checking guest UX.

Seed an admin with server seed scripts if needed (`seedAdmin.js` / seed npm scripts).

---

## 2. Admin journeys

### A. Image audit (required before approval)

1. Owner uploads images → status usually pending + heuristic `aiScore` + hash  
2. Admin opens `/admin/image-audit`  
3. Reviews property image groups, scores, duplicate/suspicious flags  
4. Updates each image → `PUT /api/admin/image-audit/:propertyId/:imageId`  
5. Mark **verified** or **rejected** (and related statuses as implemented)

**Files:** `imageAuditController.js`, `imageVerification.js`, `imageAiScore.js`, `components/imageAudit/*`  
**See:** [image-audit.md](./image-audit.md)

---

### B. Listing moderation

1. Open `/admin/listings`  
2. Load pending → `GET /api/admin/listings/pending`  
3. Inspect listing details / image verification state  
4. **Approve** only if ≥ 1 verified image → `PUT /api/admin/listings/:id/approve`  
5. Or **reject** with reason/status → `PUT /api/admin/listings/:id/reject`  

Also: `PUT /api/properties/:id/moderate` exists for admin moderation helper on property routes.

Approved listings become searchable by guests.

---

### C. User management

1. `/admin/users`  
2. List users → `GET /api/admin/users`  
3. Toggle verification → `PUT /api/admin/users/:id/verify`  
4. Change role (guest/owner/admin) carefully → `PUT /api/admin/users/:id/role`  

Changing roles affects dashboard access immediately after next auth refresh.

---

### D. Quality / sentiment awareness (read-only ops)

Admins do not retrain the model from the UI. For ops:

- Ensure sentiment-service is running if reviews look neutral unexpectedly  
- Optional scripts: `reanalyze:reviews`, `syncPropertySentiment` (server)

Admins do not manually “fix” recommendation rankings — rankings are algorithmic.

---

## 3. Admin APIs cheat sheet

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/admin/users` | Admin |
| PUT | `/api/admin/users/:id/verify` | Admin |
| PUT | `/api/admin/users/:id/role` | Admin |
| GET | `/api/admin/image-audit` | Admin |
| PUT | `/api/admin/image-audit/:propertyId/:imageId` | Admin |
| GET | `/api/admin/listings/pending` | Admin |
| PUT | `/api/admin/listings/:id/approve` | Admin |
| PUT | `/api/admin/listings/:id/reject` | Admin |
| PUT | `/api/properties/:id/moderate` | Admin |

---

## 4. Services used

`imageAuditService`, `listingModerationService`, `userManagementService`, `authService`

---

## 5. Decision rules (viva-friendly)

| Decision | Rule |
|----------|------|
| Verify image | Human review + heuristic score + duplicate check |
| Approve listing | At least one verified image + listing content acceptable |
| Reject listing | Bad images / policy / incomplete data |
| Change user role | Only when intentional; avoid locking yourself out of last admin |

---

## 6. Testing checklist (admin)

- [ ] Login as admin  
- [ ] Image audit: verify one image on a pending listing  
- [ ] Approve listing → appears in `/search`  
- [ ] Reject a listing → stays out of public search  
- [ ] Try approve with zero verified images → should fail/block  
- [ ] Change a test user role and confirm route access  
- [ ] RTL check on admin tables  
