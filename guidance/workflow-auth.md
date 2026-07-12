# Workflow: Authentication

Actors: **Guest**, **Owner**, **Admin**

---

## Goal

Create an account, obtain a JWT, and access role-specific dashboards.

---

## Steps

1. User opens `/register` or `/login`  
2. Frontend calls `authService`  
3. Backend `authController` validates credentials / creates user  
4. JWT issued via `generateToken.js`  
5. Client stores token in `AuthContext` and attaches it on Axios (`api.js` interceptor)  
6. `GET /api/auth/me` hydrates session on refresh  
7. User is routed to role dashboard  

---

## APIs

| Method | Path | Body (typical) | Result |
|--------|------|----------------|--------|
| POST | `/api/auth/register` | name, email, password, role, phone… | user + token |
| POST | `/api/auth/login` | email, password | user + token |
| GET | `/api/auth/me` | — (Bearer token) | current user |

---

## Files

| Layer | Files |
|-------|-------|
| Pages | `LoginPage.jsx`, `RegisterPage.jsx` |
| Context | `AuthContext.jsx` |
| Guards | `ProtectedRoute.jsx`, `RoleBasedRoute.jsx` |
| Service | `authService.js`, `api.js` |
| Backend | `authController.js`, `authRoutes.js`, `authMiddleware.js`, `roleMiddleware.js`, `User.js`, `generateToken.js` |

---

## Failure cases

- Wrong password → 401  
- Duplicate email on register → validation error  
- Expired/invalid token → forced re-login  
- Wrong role on a guarded page → blocked by `RoleBasedRoute`

---

## Test

- [ ] Register guest + owner  
- [ ] Login each role → correct dashboard  
- [ ] Refresh page → session persists via `/me`  
- [ ] Logout → protected routes blocked  
