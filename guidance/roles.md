# Roles Guidance (Guest · Owner · Admin)

Every user has exactly one primary role stored on `User.role`. Route access is enforced by:

- Frontend: `client/src/components/auth/RoleBasedRoute.jsx`
- Backend: `server/middleware/authMiddleware.js` + `roleMiddleware.js`

| Role | Who | Primary job |
|------|-----|-------------|
| **guest** | Traveller / booker | Search, book, pay, review, offline requests |
| **owner** | Property host | Create listings, upload images, manage offline replies |
| **admin** | Platform moderator | Image audit, listing approve/reject, user management |

Deep guides:

- [role-guest.md](./role-guest.md)
- [role-owner.md](./role-owner.md)
- [role-admin.md](./role-admin.md)

---

## Shared (all roles)

| Action | Pages | Notes |
|--------|-------|-------|
| Register / login | `/register`, `/login` | JWT stored via `AuthContext` |
| Language | Navbar `LanguageSwitcher` | EN / UR / AR |
| Theme | Theme toggle | Cosmetic; not a product feature expansion |
| Public browse | `/`, `/search`, `/properties/:id` | Guests get personalization when logged in |

Unauthenticated users can still search and view approved properties; recommendations run in **cold-start** mode.

---

## Permission matrix (high level)

| Capability | Guest | Owner | Admin | Public |
|------------|:-----:|:-----:|:-----:|:------:|
| Search / view approved listings | ✓ | ✓ | ✓ | ✓ |
| Personalized recommendations | ✓* | — | — | cold-start |
| Create booking / pay / review | ✓ | — | — | — |
| Track property view | ✓ | — | — | — |
| Submit offline request | ✓ | — | — | ✓ (optional auth) |
| Create / edit own listings | — | ✓ | — | — |
| Upload listing images | — | ✓ | — | — |
| Respond to offline requests | — | ✓ | — | — |
| Image audit | — | — | ✓ | — |
| Approve / reject listings | — | — | ✓ | — |
| Manage users / roles | — | — | ✓ | — |

\* Personalized only when history is sufficient; otherwise cold start.

---

## After login — where each role lands

Typical dashboards:

| Role | Dashboard route |
|------|-----------------|
| guest | `/guest/dashboard` |
| owner | `/owner/dashboard` |
| admin | `/admin/dashboard` |

Redirect logic lives in auth/login flow + `AuthContext` (role-based navigation).

---

## Security notes

- Never rely on hiding UI alone — every mutating API must use `protect` + `authorize`
- Owners must only update **their** properties (enforced in controller)
- Guests must only pay/cancel **their** bookings
- Admin routes are under `/api/admin/*`
- Stripe webhook uses raw body + signature verification in `server.js`
