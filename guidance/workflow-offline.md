# Workflow: Offline Booking (Form-Based)

Actors: **Guest** (or public submitter) ↔ **Owner**

---

## Goal

Allow booking interest without live chat/SMS — form submission + in-app owner response.

**Out of scope:** real SMS gateway, WhatsApp bots, email blasts.

---

## Steps

### Guest / public

1. Open `/offline-booking` (may include property context)  
2. Submit name, contact, dates, message, property reference  
3. `POST /api/offline-requests` (`optionalProtect` — works logged-in or anonymous per controller rules)  
4. If guest account: track at `/guest/offline-requests` → `GET /api/offline-requests/guest`

### Owner

5. `/owner/offline-requests`  
6. `GET /api/offline-requests/owner`  
7. Respond → `PUT /api/offline-requests/:id/respond`  
8. Guest sees updated status on their list  

---

## Files

| Layer | Files |
|-------|-------|
| Pages | `OfflineBookingPage.jsx`, `GuestOfflineRequestsPage.jsx`, `OwnerOfflineRequestsPage.jsx` |
| Components | `components/offline/*` |
| Service | `offlineRequestService.js` |
| Backend | `offlineRequestController.js`, `offlineRequestRoutes.js`, `OfflineRequest.js` |

---

## Test

- [ ] Submit offline form  
- [ ] Owner sees request  
- [ ] Owner responds  
- [ ] Guest status updates  
- [ ] RTL layout on forms/cards  
