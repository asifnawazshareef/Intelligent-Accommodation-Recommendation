# Frontend Modules Guidance

React + Vite app under `client/`. Router entry: `client/src/main.jsx` (no separate `App.jsx`).

---

## 1. Structure

```text
client/src/
├── main.jsx              # Routes
├── pages/                # Route-level screens
├── components/           # UI by domain
├── services/             # Axios API wrappers
├── context/              # Auth + theme
├── hooks/                # Shared hooks
├── i18n/                 # EN / UR / AR
├── lib/                  # Pure helpers
└── utils/                # e.g. languageUtils
```

---

## 2. Services (`client/src/services/`)

| File | Talks to | Use for |
|------|----------|---------|
| `api.js` | Axios base | Auth header interceptor; shared client |
| `authService.js` | `/api/auth` | Login, register, me |
| `propertyService.js` | `/api/properties` | Listings CRUD, views |
| `searchService.js` | `/api/search`, `/api/recommendations` | Search + recommendations |
| `bookingService.js` | `/api/bookings` | Bookings lifecycle |
| `paymentService.js` | `/api/payments/stripe` | Checkout / verify |
| `reviewService.js` | `/api/reviews` | Reviews |
| `offlineRequestService.js` | `/api/offline-requests` | Offline forms |
| `imageAuditService.js` | `/api/admin/image-audit` | Admin image audit |
| `listingModerationService.js` | `/api/admin/listings` | Approve/reject |
| `userManagementService.js` | `/api/admin/users` | Roles / verify |

Rule: pages/components call **services**, not raw Axios (except via `api.js`).

---

## 3. Context & auth UI

| File | Role |
|------|------|
| `context/AuthContext.jsx` | Current user, login/logout, token |
| `context/ThemeContext.jsx` | Theme toggle state |
| `components/auth/ProtectedRoute.jsx` | Must be logged in |
| `components/auth/RoleBasedRoute.jsx` | Role gate (guest/owner/admin) |
| `components/auth/PasswordInput.jsx` | Password field UX |

---

## 4. Layout components

| File | Role |
|------|------|
| `layout/PublicLayout.jsx` | Public pages shell (nav/footer) |
| `layout/AuthShellLayout.jsx` | Login/register shell |
| `layout/Navbar.jsx` / `Footer.jsx` | Chrome |
| `layout/ThemeToggle.jsx` | Theme control |
| `layout/AppLogo.jsx` | Brand mark |
| `dashboard/DashboardShell.jsx` | Role dashboards layout |
| `LanguageSwitcher.jsx` | EN / UR / AR |

---

## 5. Domain components

### Properties

`components/properties/` — forms, cards, gallery, booking panel, sentiment snapshot widgets, status badges.

### Search & recommendations

`components/search/` — search form/results, recommended sections/cards.

### Reviews & sentiment display

`components/reviews/` — form, list, sentiment badges/summary/result cards.

### Bookings

`components/bookings/` — status badge, steps, guest booking card.

### Image audit

`components/imageAudit/` — stats, AI score meter, verification badges/groups.

### Offline

`components/offline/` — request card + status badge.

### Admin

`components/admin/` — e.g. `UserRoleBadge`.

### UI primitives

`components/ui/` — shadcn-style buttons, inputs, EmptyState, PageHeader, toaster, etc.

---

## 6. Lib helpers (`client/src/lib/`)

| File | Role |
|------|------|
| `bookingDates.js` / `dateUtils.js` | Date handling |
| `formatters.js` | Money / display formatters |
| `imageUrl.js` | Absolute URL for uploads |
| `imageVerification.js` | Status helpers for UI |
| `notify.js` | Toast helpers |
| `reviewAspects.js` | Aspect display mapping |
| `searchParams.js` | Query string helpers |
| `sentimentInsights.js` | Sentiment insight text helpers |
| `utils.js` | `cn` / general |

---

## 7. i18n module

| File | Role |
|------|------|
| `i18n/index.js` | i18next init |
| `i18n/en.json` | English (default, LTR) |
| `i18n/ur.json` | Urdu (RTL) |
| `i18n/ar.json` | Arabic (RTL) |
| `utils/languageUtils.js` | Direction helpers |

**Rules:**

- UI chrome → translation keys  
- User-generated content → **never** translate  
- Layout → direction-safe classes (`text-start`, `start`/`end`, wrap, grids)

---

## 8. Hooks

| File | Role |
|------|------|
| `hooks/usePropertySearch.js` | Search params/results orchestration |

---

## 9. Pages pointer

Full route table: [website-pages.md](./website-pages.md).

---

## 10. Frontend change checklist

1. Is the change inside approved FYP scope?  
2. Add/update i18n keys for new UI text (en + ur + ar)  
3. Test LTR and RTL (Urdu or Arabic)  
4. Use existing services; keep loading / empty / error states  
5. For recommendations/sentiment, reuse existing components — do not invent a second ranking UI  
6. Prefer Tailwind + existing shadcn patterns  
