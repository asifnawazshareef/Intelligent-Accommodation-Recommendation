# Workflow: Listing → Image Verification → Approval

Actors: **Owner** → **Admin** → (result visible to) **Public/Guest**

---

## Goal

Publish a trustworthy listing: create property, verify images, admin-approve so it appears in search.

---

## Steps

### Owner

1. Login as owner  
2. `/owner/properties/new`  
3. Fill listing fields + upload images  
4. `POST /api/properties` (multipart)  
5. Server saves files under `uploads/properties`  
6. For each image: hash, duplicate check, heuristic `aiScore`, status ≈ pending  
7. Property `status` = pending  
8. Owner may edit later via `PUT /api/properties/:id`

### Admin — image audit

9. `/admin/image-audit`  
10. `GET /api/admin/image-audit`  
11. Review scores / duplicates  
12. `PUT /api/admin/image-audit/:propertyId/:imageId` → verify or reject  

### Admin — listing moderation

13. `/admin/listings`  
14. `GET /api/admin/listings/pending`  
15. Approve only if ≥ 1 verified image → `PUT /api/admin/listings/:id/approve`  
16. Or reject → `PUT /api/admin/listings/:id/reject`

### Public result

17. Approved property appears in `GET /api/search` and property detail  
18. Guest gallery uses `filterGuestImages`

---

## Files

| Concern | Files |
|---------|-------|
| Create/edit UI | `OwnerPropertyNewPage.jsx`, `OwnerPropertyEditPage.jsx`, `PropertyForm` |
| Upload | `uploadMiddleware.js` |
| Verification | `imageVerification.js`, `imageAiScore.js` |
| Controllers | `propertyController.js`, `imageAuditController.js`, `listingModerationController.js` |
| Admin UI | `AdminImageAuditPage.jsx`, `AdminListingsPage.jsx` |
| Model | `Property.js` |

---

## Gate rule

```text
IF verifiedImageCount < 1 THEN approve MUST fail
ELSE listing may become approved
```

---

## Test

- [ ] Create listing with images → pending  
- [ ] Approve without verified image → blocked  
- [ ] Verify one image → approve → visible in search  
- [ ] Reject listing → not in search  
