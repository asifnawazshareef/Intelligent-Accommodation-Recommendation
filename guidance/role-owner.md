# Owner Role Guidance

Role value: `"owner"`.

Owners list properties, upload images, and respond to offline booking requests. They do **not** approve their own listings — admin does.

---

## 1. Pages the owner uses

| Route | Page | Purpose |
|-------|------|---------|
| `/` `/search` `/properties/:id` | Public pages | Browse market context |
| `/login` `/register` | Auth | Register as owner |
| `/owner/dashboard` | `OwnerDashboard.jsx` | Owner hub |
| `/owner/properties` | `OwnerPropertiesPage.jsx` | List own properties + statuses |
| `/owner/properties/new` | `OwnerPropertyNewPage.jsx` | Create listing + upload images |
| `/owner/properties/:id/edit` | `OwnerPropertyEditPage.jsx` | Edit listing + images |
| `/owner/offline-requests` | `OwnerOfflineRequestsPage.jsx` | Inbox for offline requests |

Also useful: `GET /api/bookings/owner-bookings` for bookings on their properties (if surfaced in dashboard/UI).

---

## 2. Owner journeys

### A. Register as owner

1. `/register` — choose/select owner role (as implemented in Register UI)  
2. Login → redirect to `/owner/dashboard`

**API:** `POST /api/auth/register`, `POST /api/auth/login`

---

### B. Create listing + upload images

1. `/owner/properties/new`  
2. Fill title, description, city, price, amenities, availability, etc.  
3. Upload images (multer)  
4. Submit → `POST /api/properties` (multipart)  
5. Backend stores images + runs verification (`imageVerification.js`, `imageAiScore.js`)  
6. Listing status = **pending** (waiting for admin)  

**Files:** `propertyController.js`, `uploadMiddleware.js`, `PropertyForm` components  
**See:** [image-audit.md](./image-audit.md)

---

### C. Edit listing

1. `/owner/properties/:id/edit`  
2. Update fields / add images  
3. `PUT /api/properties/:id`  
4. If already approved, follow project rules for re-moderation if status resets (check controller behaviour)

---

### D. Wait for admin approval

Owner cannot force-approve. Admin must:

1. Verify ≥ 1 image in Image Audit  
2. Approve on Admin Listings  

Until approved, listing does **not** appear in public search.

Owner should check status badges on `/owner/properties` (`pending` / `approved` / `rejected`).

---

### E. Offline request responses

1. Guest submits offline form for a property  
2. Owner opens `/owner/offline-requests`  
3. Reads request details  
4. Responds (accept/decline/message as implemented) → `PUT /api/offline-requests/:id/respond`  
5. Guest sees updated status  

No SMS gateway — in-app form only.

---

### F. Owner bookings awareness

`GET /api/bookings/owner-bookings` returns bookings for the owner’s properties. Use dashboard/list UI if present to monitor confirmed stays.

Owners do **not** leave guest reviews; guests do after stay/payment eligibility.

---

## 3. Owner APIs cheat sheet

| Method | Path | Auth |
|--------|------|------|
| POST | `/api/auth/register` (role owner) | Public |
| GET | `/api/properties/owner/my-properties` | Owner |
| POST | `/api/properties` | Owner + upload |
| PUT | `/api/properties/:id` | Owner + upload |
| GET | `/api/bookings/owner-bookings` | Owner |
| GET | `/api/offline-requests/owner` | Owner |
| PUT | `/api/offline-requests/:id/respond` | Owner |

---

## 4. Services used

`authService`, `propertyService`, `bookingService` (owner lists), `offlineRequestService`

---

## 5. What owners should NOT do / cannot do

- Cannot approve their own listing  
- Cannot access `/admin/*`  
- Cannot create reviews as owner role  
- Should not expect chat/wishlist/coupons (out of scope)

---

## 6. Testing checklist (owner)

- [ ] Register/login as owner  
- [ ] Create property with multiple images  
- [ ] See pending status  
- [ ] Edit property  
- [ ] After admin verifies + approves → property appears in public search  
- [ ] Receive offline request → respond  
- [ ] RTL language check on owner forms/tables  
