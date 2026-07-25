# Recommendation — Client Explanation Script (1–5 minutes)

Use this when explaining the recommendation system to a client.  
Speak naturally; use the short version first, then expand if they ask for detail.

Full technical guide: [recommendation-system-complete.md](./recommendation-system-complete.md)

---

## 1-minute version (elevator pitch)

> Our recommendation system ranks approved accommodations intelligently — it does **not** just sort by star rating.
>
> First, when guests write reviews, our **AI sentiment model** reads the text and converts it into a quality score. That model does **not** recommend hotels by itself; it only creates a feature.
>
> Then our **recommendation engine** combines three things:
> 1. **Review analysis** — how positive and trustworthy the written feedback is  
> 2. **Bayesian quality** — a trust score so one lucky 5-star review cannot beat fifty solid reviews  
> 3. **Personalization** — if the guest is logged in and has history, we also match their searches, views, bookings, city, and budget  
>
> New guests still get strong recommendations using quality only. And personalization cannot promote poor-quality listings — we keep a quality floor for trust.

---

## 3-minute version (recommended for most clients)

### Opening (20 sec)

> Let me explain how recommendations work on the platform.
>
> Guests see suggested properties on the home and search pages. Behind that is a hybrid ranking engine — not a simple filter, and not “AI randomly picking hotels.”

### How data enters the system (40 sec)

> The flow starts with real guest behaviour:
> - They search cities and budgets  
> - They view properties  
> - They book and pay  
> - They leave reviews  
>
> When a review is submitted, our Python sentiment service analyzes the text — positive, negative, neutral, mixed — and also looks at aspects like cleanliness, staff, location, and value.
>
> That result is saved on the review and summarized on the property. From that summary we build a **Review Analysis Score**.

### How the score is calculated (70 sec)

> For every approved property, the engine calculates up to three scores:
>
> **One — Review Analysis (from AI text).**  
> It weighs overall positivity, aspect praise vs concerns, insight type, and how many reviews support the signal. Many negative reviews reduce the score.
>
> **Two — Bayesian Quality (trust).**  
> We smooth star ratings with a Bayesian formula so sparse ratings don’t dominate. Then we combine smoothed rating, sentiment positivity, review credibility, availability, and amenities into a quality score.
>
> **Three — Personalization (only when we know the guest).**  
> If they are logged in and have enough history — bookings, reviews, searches, or several views — we score how well each listing matches their past behaviour: similar properties, similar guests’ choices, preferred city and budget.
>
> Then we blend them:
> - Personalized: **42% review analysis + 28% Bayesian quality + 30% personalization**  
> - New/anonymous guest: **55% review analysis + 45% Bayesian quality**

### Safety + result (30 sec)

> Before promoting a listing, we apply a **quality floor**. If trust or review analysis is too weak, that property is not pushed — even if it somehow matches a preference.
>
> Finally, results are shown in clear sections — like “based on your searches,” “similar to previous bookings,” “within your budget,” or “recommended for you” — with reasons where available.

### Close (20 sec)

> So for you as the client: guests get relevant suggestions, new users still get high-quality options, and the system stays trustworthy because poor listings cannot jump the ranking through preference matching alone.

---

## 5-minute version (technical client / investor / supervisor)

Use the 3-minute script, then add these extras if they want depth.

### Extra A — Cold start vs personalized

> If the guest is not logged in, or has almost no history, we run **cold start**: quality-only ranking with sections like top quality, best reviewed, and trending.
>
> Personalization turns on only when there is enough signal — for example a booking, a review, city searches, at least two views, or favourites. That avoids fake “personalization” on empty profiles.

### Extra B — Bayesian in plain words

> Bayesian rating means:
> *(average stars × number of reviews + market average × 4) ÷ (reviews + 4)*.
>
> The market average is calculated dynamically from real approved listings. So the system adapts as your catalogue grows — we are not stuck on one hard-coded number forever.
>
> Cold-start budget preference also uses the dynamic average listing price, instead of always assuming a fixed price.

### Extra C — Why this is better than “sort by rating”

> Sorting by average stars fails in two ways:
> 1. One extreme review can look “perfect”  
> 2. Stars ignore what people actually wrote  
>
> We fix both: text analysis captures tone and aspects, Bayesian trust handles sparse data, and personalization makes the list useful for each guest — under a quality floor.

### Extra D — Demo path while speaking

1. Open site logged out → show cold-start recommendations  
2. Login as a guest with history → show personalized sections  
3. Open a property with reviews → show sentiment summary  
4. Say: “Sentiment analyzes; recommendation ranks.”

---

## Code reference map (where this is written)

Point here if the client / supervisor asks “where is this in code?”

### API entry (request starts here)

| What | File |
|------|------|
| `GET /api/recommendations` route | `server/routes/searchRoutes.js` |
| Orchestrates profile, properties, mode, response | `server/controllers/searchController.js` → `getRecommendations` |

### Main engine (final ranking)

| What | File |
|------|------|
| Hybrid score, sections, cold start vs personalized, trust floor | `server/utils/personalizedRecommendationEngine.js` |
| Tunable weights / floors / budget factors | `server/utils/recommendationWeights.js` |

### Factor 1 — Review Analysis (sentiment feature)

| What | File |
|------|------|
| Review text → ML predict | `sentiment-service/app.py` |
| Node calls ML service | `server/services/sentimentService.js` |
| Review create stores sentiment | `server/controllers/reviewController.js` |
| Property sentiment snapshot | `server/utils/propertySentimentStore.js`, `server/utils/sentimentAggregation.js` |
| Snapshot → **ReviewAnalysisScore** | `server/utils/reviewSentimentRecommendation.js` |

### Factor 2 — Bayesian Quality

| What | File |
|------|------|
| Bayesian rating + quality score | `server/utils/bayesianRanking.js` |
| Dynamic prior mean μ₀ + average market price cache | same file: `bayesianRanking.js` |
| Quality / Bayesian weight config | `server/utils/recommendationWeights.js` (`BAYESIAN_CONFIG`, `QUALITY_WEIGHTS`) |

### Factor 3 — Personalization

| What | File |
|------|------|
| Guest profile from searches/views/bookings/reviews | `server/utils/buildUserProfile.js` |
| Collaborative co-occurrence (“similar guests”) | `server/utils/collaborativeFiltering.js` |
| Content similarity (city/price/amenities/type) | `server/utils/propertySimilarity.js` |
| Availability / amenity / aspect helpers | `server/utils/propertySignals.js` |
| Match reasons / enrichment | `server/utils/recommendationEnrichment.js` |
| Explainability metadata | `server/utils/recommendationTransparency.js` |

### History data (Mongo models)

| Signal | Model file |
|--------|------------|
| Listings + sentiment snapshot | `server/models/Property.js` |
| Reviews + sentiment fields | `server/models/Review.js` |
| Bookings | `server/models/Booking.js` |
| Property views | `server/models/PropertyView.js` |
| Search history | `server/models/SearchHistory.js` |
| User identity | `server/models/User.js` |

### Frontend (what the client sees)

| What | File |
|------|------|
| API call | `client/src/services/searchService.js` |
| Recommendation sections UI | `client/src/components/search/RecommendedProperties.jsx` |
| Recommendation card + reasons | `client/src/components/search/RecommendedPropertyCard.jsx` |
| Home surface | `client/src/pages/HomePage.jsx` |
| Search surface | `client/src/pages/SearchPage.jsx` |

### Academic / deeper docs (optional handout)

| Doc | Path |
|-----|------|
| Algorithm write-up | `docs/recommendation_algorithm.md` |
| Bayesian quality write-up | `docs/bayesian_quality.md` |
| Full viva guide | `guidance/recommendation-system-complete.md` |

---

## Quick formula card (keep on one slide / note)

```text
Personalized:
  Score = ReviewAnalysis(0.42) + Bayesian(0.28) + Personalization(0.30)

Cold start:
  Score = ReviewAnalysis(0.55) + Bayesian(0.45)

Bayesian rating:
  R = (avgRating × n + μ0 × 4) / (n + 4)
```

**Key lines to memorize**

1. Sentiment analyzes text — it does not recommend.  
2. Ranking = Review Analysis + Bayesian Quality + Personalization.  
3. Quality floor protects trust.  
4. Cold start works for new guests.  

---

## Summary (closing sentence)

> In short: reviews are analyzed by AI, quality is measured with Bayesian trust, and recommendations are personalized only when we know the guest — with code modularized across the recommendation engine, Bayesian module, sentiment feature extractor, and `/api/recommendations` API.
