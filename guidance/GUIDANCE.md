# IARS Master Guidance

Central guide for the whole website codebase. Use this file for orientation; open the linked files for detail.

---

## 1. Project purpose

IARS helps guests find accommodation using:

1. **Sentiment analysis** of reviews (text → structured scores)
2. **Bayesian quality** (trust / rating credibility)
3. **Personalized recommendations** (when the guest has history)

Important research separation:

> The **sentiment model does not recommend properties**.  
> It only produces numerical features. The **recommendation engine** ranks properties using those features plus Bayesian quality and (optionally) personalization.

---

## 2. Repository layout

```text
sentiment-mern-integration/
├── client/                 # React frontend
├── server/                 # Express API
├── sentiment-service/      # FastAPI ML sentiment API
├── docs/                   # Dissertation / algorithm docs
├── guidance/               # THIS folder — developer guidance
├── package.json            # npm run dev (client + server + sentiment)
└── .cursor/rules/          # Project scope rules
```

---

## 3. How to run

From repo root:

```bash
npm run dev
```

Typical ports:

| Service | Default |
|---------|---------|
| Client | `http://localhost:5173` |
| Server | `http://localhost:5000` (check `.env`) |
| Sentiment | `http://localhost:8000` |

Useful scripts:

- `npm run seed` / seed admin / seed properties / seed demo reviews
- `npm run train:sentiment`
- `npm run reanalyze:reviews`

---

## 4. Main workflow (must stay intact)

1. Owner registers / logs in  
2. Owner creates property listing  
3. Owner uploads property images  
4. Image verification data is stored  
5. Admin reviews and approves the property (≥1 verified image)  
6. Guest searches approved properties  
7. Guest views property details  
8. Guest makes booking  
9. Payment confirmation updates booking status  
10. Guest leaves review  
11. Sentiment model analyzes review  
12. Sentiment result is saved and displayed  
13. Admin can manage users and audit decisions  

See [main-workflow.md](./main-workflow.md) for file-level mapping of each step.

---

## 5. Architecture (request flow)

```text
Browser (React)
    │  REST /api/*
    ▼
Express (server/)
    ├── Auth / Property / Booking / Payment / Offline / Admin
    ├── Reviews ──HTTP──► sentiment-service /predict
    ├── Sentiment summary (aggregated from Review + Property.sentimentSnapshot)
    └── Recommendations (hybrid engine using ReviewAnalysis + Bayesian + Profile)
            │
            ▼
        MongoDB
```

---

## 6. Feature map → guidance files

| Feature | Guidance |
|---------|----------|
| **All roles** | [roles.md](./roles.md), [role-guest.md](./role-guest.md), [role-owner.md](./role-owner.md), [role-admin.md](./role-admin.md) |
| **All workflows** | [workflows.md](./workflows.md) (+ `workflow-*.md` files) |
| Recommendations | [recommendation-system-complete.md](./recommendation-system-complete.md) (viva-ready) · [recommendations.md](./recommendations.md) |
| Sentiment model + display | [sentiment-model.md](./sentiment-model.md) |
| Image verification / audit | [image-audit.md](./image-audit.md) |
| Backend modules | [backend-modules.md](./backend-modules.md) |
| Frontend modules | [frontend-modules.md](./frontend-modules.md) |
| All website pages | [website-pages.md](./website-pages.md) |
| API list | [api-cheatsheet.md](./api-cheatsheet.md) |
| i18n / RTL | [i18n-layout.md](./i18n-layout.md) |
| Setup / seeds / scripts | [setup-scripts.md](./setup-scripts.md) |

---

## 7. Roles

| Role | Can do |
|------|--------|
| **Guest** | Search, view, book, pay, review, offline requests |
| **Owner** | Listings, images, owner bookings view, respond to offline requests |
| **Admin** | Approve listings, image audit, user management |

Route guards live in `client/src/components/auth/RoleBasedRoute.jsx`.  
JWT protection lives in `server/middleware/authMiddleware.js` + `roleMiddleware.js`.

---

## 8. Multilingual / layout rules

- Default language: **English (LTR)**
- Also: **Urdu (RTL)**, **Arabic (RTL)**
- Use `i18next` keys — do not hardcode UI strings
- Do **not** translate user content (titles, descriptions, reviews, names, emails, phones, image URLs)
- Prefer direction-safe classes: `text-start`, `text-end`, `start`, `end`, `flex-wrap`, responsive grids

Files:

- `client/src/i18n/index.js`
- `client/src/i18n/en.json`, `ur.json`, `ar.json`
- `client/src/components/LanguageSwitcher.jsx`

---

## 9. Tuning recommendation / quality weights

Do **not** scatter magic numbers. Edit:

`server/utils/recommendationWeights.js`

Contains:

- Bayesian prior weight / quality floor
- Hybrid score weights (personalized + cold start)
- Review-analysis feature weights
- Trust floor
- Profile budget / market price fallbacks

Dynamic market values (cached):

- Global prior mean rating \(\mu_0\)
- Global average approved listing price  

Implemented in `server/utils/bayesianRanking.js`.

---

## 10. API surface (high level)

| Mount | Purpose |
|-------|---------|
| `/api/auth` | Register, login, me |
| `/api/properties` | Listings CRUD, views, images |
| `/api/search` | Property search |
| `/api/recommendations` | Personalized / cold-start recommendations |
| `/api/bookings` | Bookings + demo payment |
| `/api/payments/stripe` | Checkout + verify |
| `/api/reviews` | Create / list reviews |
| `/api/sentiment` | Property sentiment summary |
| `/api/offline-requests` | Offline booking forms |
| `/api/admin` | Users, listings, image audit |
| Sentiment service `/predict` | Raw review sentiment (not public browser → usually via Node) |

---

## 11. Viva / defense one-liners

**Sentiment:** “Unstructured review text is converted into polarity, confidence, and aspects; those become a numerical ReviewAnalysisScore feature.”

**Recommendation:** “Ranking combines ReviewAnalysis + BayesianQuality; if the guest has enough history, Personalization is added. Personalization cannot override the quality floor.”

**Image audit:** “Uploaded images get hash, duplicate detection, and a heuristic AI score; admin verifies; listing approval requires at least one verified image.”
