# Workflow: Search, View & Recommendations

Actors: **Public** (cold start), **Guest** (personalized when history exists)

---

## A. Search

### Steps

1. User enters filters on `/` or `/search` (city, min/max price, etc.)  
2. Client builds query via `usePropertySearch` / `searchParams` helpers  
3. `GET /api/search`  
4. Server returns **approved** properties matching filters  
5. Cards render; click → `/properties/:id`

### Files

- Frontend: `HomePage`, `SearchPage`, `components/search/*`, `searchService.js`  
- Backend: `searchController.searchProperties`, `searchRoutes.js`

Optional: search may write `SearchHistory` for logged-in guests (feeds personalization).

---

## B. Property view

### Steps

1. `GET /api/properties/:id`  
2. Show gallery (filtered), description, price, reviews, sentiment summary  
3. Logged-in guest may `POST /api/properties/:id/view` → `PropertyView` document  

Views help unlock personalized recommendations (≥ 2 views is one gate signal).

---

## C. Recommendations

### Steps

1. Client calls `GET /api/recommendations` (with JWT if logged in)  
2. Server refreshes market stats (prior mean + avg price)  
3. Builds user profile from searches/views/bookings/reviews  
4. Attaches review stats + sentiment summaries  
5. Chooses mode:
   - **Cold start:** ReviewAnalysis + Bayesian  
   - **Personalized:** + Personalization layer + sectioned results  
6. Applies trust floor  
7. Returns sections + transparency metadata  
8. UI shows `RecommendedProperties` / cards with reasons  

### Modes

| Condition | Mode |
|-----------|------|
| No auth | Cold start |
| Auth but little history | Cold start |
| Auth + sufficient history | Personalized |

### Files

See full map in [recommendations.md](./recommendations.md).

Key: `searchController.getRecommendations`, `personalizedRecommendationEngine.js`, `buildUserProfile.js`, `bayesianRanking.js`, `reviewSentimentRecommendation.js`

---

## Test

- [ ] Anonymous search works  
- [ ] Cold-start recommendations return  
- [ ] After guest views/searches/books → personalized sections appear  
- [ ] Low-quality properties stay suppressed by trust floor  
- [ ] Reasons / transparency fields show on cards when provided  
