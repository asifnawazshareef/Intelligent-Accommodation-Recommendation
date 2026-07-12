# Recommendations Guidance

Concise file/formula map for the recommendation engine.

**For the complete viva-ready guide** (step-by-step, why it impresses supervisors, likely questions, summary), open:

→ [recommendation-system-complete.md](./recommendation-system-complete.md)

---

How the recommendation system works, which files own each piece, and how sentiment fits in as a **feature** (not a recommender).

---

## 1. Core idea

```text
Review text
  → Sentiment Analyzer (ML)
  → Review.sentiment + Property.sentimentSnapshot
  → ReviewAnalysisScore   ← numerical FEATURE only
  → Recommendation Engine ranks properties using:
        ReviewAnalysis + BayesianQuality + (optional) Personalization
```

**Quality floor:** personalization may reorder trustworthy properties but must not promote low-quality listings.

---

## 2. Formulas

Configured in `server/utils/recommendationWeights.js` → `HYBRID_SCORE_WEIGHTS`.

### Personalized (enough guest history)

```text
Score = (ReviewAnalysis × 0.42) + (Bayesian × 0.28) + (Personalization × 0.30)
```

### Cold start (anonymous / insufficient history)

```text
Score = (ReviewAnalysis × 0.55) + (Bayesian × 0.45)
```

### Bayesian rating (inside quality)

```text
R_bayes = (avgRating × n + μ0 × C) / (n + C)
```

- \(\mu_0\) = **dynamic** global prior mean (cached from approved reviewed properties)
- \(C\) = `priorWeight` (default `4`)
- Fallback \(\mu_0\) = `3.5` until cache is ready

### Dynamic market price (cold-start budget)

Cold-start preferred price uses **average approved listing price** (cached), not a fixed `15000` (that number is only a last-resort fallback in `PROFILE_DEFAULTS`).

---

## 3. Modes

| Mode | When | What guest sees |
|------|------|-----------------|
| Cold start | Not logged in, or logged in but little history | Top Bayesian / best reviewed / trending style sections |
| Personalized | Logged-in + sufficient history | Sections: recent searches, previous bookings, budget, viewed similar, city, for you |

History gate (engine): bookings **or** reviews **or** city searches **or** ≥2 views **or** favourites (or profile `hasSufficientHistory`).

Implemented in `buildRecommendationMode()` inside `personalizedRecommendationEngine.js`.

---

## 4. API

| Method | Path | Auth | Handler |
|--------|------|------|---------|
| `GET` | `/api/recommendations` | Optional JWT | `searchController.getRecommendations` |
| `GET` | `/api/search` | Optional | `searchController.searchProperties` |

Query params commonly used: `city`, `minPrice`, `maxPrice`, `price`, `availabilityDate`.

Client: `client/src/services/searchService.js`  
UI: `RecommendedProperties.jsx`, `RecommendedPropertyCard.jsx`, Home / Search pages.

On each recommendations request the controller refreshes market stats (prior mean + average price) in the background via `refreshRecommendationMarketStats()`.

---

## 5. File map (backend — recommendations)

| File | Role |
|------|------|
| `server/controllers/searchController.js` | Search + recommendations HTTP handlers; attaches review stats / sentiment; builds response |
| `server/routes/searchRoutes.js` | Mounts `/search` and `/recommendations` |
| `server/utils/personalizedRecommendationEngine.js` | **Main engine**: hybrid score, sections, cold start, trust floor, finalize |
| `server/utils/recommendationWeights.js` | **All tunable weights / floors / budget factors** |
| `server/utils/bayesianRanking.js` | Bayesian rating + quality score; dynamic \(\mu_0\); dynamic avg price |
| `server/utils/reviewSentimentRecommendation.js` | Builds **ReviewAnalysisScore** from sentiment snapshot |
| `server/utils/buildUserProfile.js` | Builds guest preference profile from DB history |
| `server/utils/collaborativeFiltering.js` | Co-occurrence matrix (bookings/views) |
| `server/utils/recommendationEnrichment.js` | Attach sentiment summaries, match reasons helpers |
| `server/utils/recommendationTransparency.js` | Explainability: matched signals, reason strings, score breakdown |
| `server/utils/propertySignals.js` | Availability, amenity density, aspect satisfaction |
| `server/utils/propertySimilarity.js` | Content similarity, type inference, amenity overlap |
| `server/utils/propertySentimentStore.js` | Keeps `Property.sentimentSnapshot` in sync after reviews |
| `server/utils/sentimentAggregation.js` | Aggregates polarity/aspects for summaries |

### Supporting models

| Model | Why recommendations need it |
|-------|-----------------------------|
| `Property.js` | Candidates + `sentimentSnapshot` + price/city |
| `Review.js` | Ratings + sentiment for features |
| `Booking.js` | Booking history / collaborative |
| `PropertyView.js` | View history |
| `SearchHistory.js` | Search preference history |
| `User.js` | Auth identity / language pref |

---

## 6. File map (frontend — recommendations)

| File | Role |
|------|------|
| `client/src/services/searchService.js` | Calls `/api/search` and `/api/recommendations` |
| `client/src/hooks/usePropertySearch.js` | Search state / params |
| `client/src/components/search/RecommendedProperties.jsx` | Sectioned recommendation UI |
| `client/src/components/search/RecommendedPropertyCard.jsx` | Card + reason display |
| `client/src/pages/HomePage.jsx` | Surfaces recommendations |
| `client/src/pages/SearchPage.jsx` | Search results (+ related recs where used) |
| `client/src/lib/sentimentInsights.js` | Helpers for showing sentiment insights |

---

## 7. Pipeline inside `getRecommendations` (conceptual)

1. Refresh market stats (async, non-blocking)  
2. Load user profile (`buildUserRecommendationProfile`)  
3. Load global booking counts + co-occurrence matrix  
4. Load approved properties  
5. Attach review stats + sentiment summaries  
6. Decide mode: personalized vs cold start  
7. Score / build sections via engine  
8. Finalize (limits, transparency metadata, guest-safe images)  
9. Return JSON to client  

---

## 8. Trust floor

From `TRUST_FLOOR` + `MIN_QUALITY_SCORE` in weights / Bayesian module:

- Combined / Bayesian quality must clear the floor  
- If the property has analyzed reviews, **ReviewAnalysisScore** must also clear `minimumReviewAnalysisScore` (default `0.32`)  
- Soft Bayesian floor factor (default `0.88 × minimumQualityScore`)  

If trust floor fails → recommendation score forced to `0` (not promoted).

---

## 9. What to change safely

| Goal | Edit |
|------|------|
| Change hybrid weights | `recommendationWeights.js` → `HYBRID_SCORE_WEIGHTS` |
| Change Bayesian C / quality floor | `BAYESIAN_CONFIG`, `QUALITY_WEIGHTS` |
| Change ReviewAnalysis feature mix | `REVIEW_ANALYSIS_FEATURE_WEIGHTS` |
| Change cold-start price fallback | `PROFILE_DEFAULTS.fallbackPreferredPrice` (only fallback) |
| Change section limits | `RECOMMENDATION_TOTAL`, `SECTION_LIMIT` in engine |

Do **not** make the sentiment service rank properties. Keep ranking in the Node engine.

---

## 10. Academic docs

- `docs/recommendation_algorithm.md`
- `docs/bayesian_quality.md`
- `docs/FYP-Recommendation-System-Documentation.md`
