# Workflow: Admin Moderation & User Management

Actors: **Admin**

Related: [role-admin.md](./role-admin.md), [image-audit.md](./image-audit.md), [workflow-listing.md](./workflow-listing.md)

---

## A. Image audit workflow

1. Pending images exist on owner listings  
2. Admin → `/admin/image-audit`  
3. Inspect AI score, duplicates, preview  
4. Update status per image  
5. Verified images unlock listing approval  

API: `GET/PUT /api/admin/image-audit...`

---

## B. Listing moderation workflow

1. Admin → `/admin/listings`  
2. Review pending listings  
3. Approve (gate: ≥ 1 verified image) or reject  
4. Approved → public search  

API: `/api/admin/listings/pending|approve|reject`  
Also: `PUT /api/properties/:id/moderate`

---

## C. User management workflow

1. Admin → `/admin/users`  
2. View all users  
3. Set verification flag  
4. Change role when needed (guest/owner/admin)  

API: `/api/admin/users`, `.../verify`, `.../role`

---

## Safety

- Keep at least one working admin account  
- Do not approve listings with only rejected/suspicious images  
- Role changes immediately affect frontend route access  

---

## Test

- [ ] Full image → approve → search visibility chain  
- [ ] Reject path  
- [ ] Role change for a test user  
- [ ] Unauthorized guest/owner cannot hit `/api/admin/*`  
