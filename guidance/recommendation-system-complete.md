# Complete Recommendation System Guidance (Viva Ready)

This is the **full recommendation guidance** for IARS: what you built, how it works now, step-by-step flow, why it impresses a supervisor, likely viva questions with answer points, and a final summary.

Related shorter map: [recommendations.md](./recommendations.md)  
Academic depth: `docs/recommendation_algorithm.md`, `docs/bayesian_quality.md`

---

## 1. One-sentence pitch (memorize this)

> Our recommendation system is a **hybrid ranking engine**. The **sentiment model does not recommend** properties — it only converts review text into a numerical feature (`ReviewAnalysisScore`). The engine then combines **Review Analysis + Bayesian Quality + Personalization** (when the guest has enough history), with a **quality floor** so preference matching cannot promote poor listings.

---

## 2. What we built (research + engineering contribution)

### 2.1 Research framing

| Piece | Role |
|-------|------|
| Sentiment analyzer (ML) | Feature extractor only |
| ReviewAnalysisScore | Structured numerical feature from reviews |
| Bayesian Quality | Trust / credibility ranking signal |
| Personalized layer | Extends Bayesian ranking using `user_id` history |
| Quality / trust floor | Personalization cannot override poor quality |
| Cold start | Works for anonymous / new guests without history |
| Transparency | Reasons / matched signals for explainability |

### 2.2 What was implemented in code

1. **Hybrid score formulas** (personalized vs cold start)  
2. **Bayesian rating smoothing** with **dynamic prior mean** \(\mu_0\)  
3. **Bayesian Quality Score** combining rating, sentiment, credibility, availability, amenities, penalties  
4. **ReviewAnalysisScore** from polarity, aspects, insight type, credibility  
5. **User profile builder** from searches, views, bookings, reviews  
6. **Collaborative filtering** (co-occurrence) as part of personalization  
7. **Content similarity** (city, price, amenities, type)  
8. **Sectioned recommendations** (searches, bookings, budget, views, city, for-you)  
9. **Dynamic market average price** for cold-start budget fallback (not a hard-coded forever `15000`)  
10. **Centralized weights** in `recommendationWeights.js`  
11. **Explainability / transparency** metadata for UI and defense  
12. **API** `GET /api/recommendations` wired to Home/Search UI  

### 2.3 What we deliberately did NOT do

- Did not let the sentiment model “pick winners” alone  
- Did not replace Bayesian quality with personalization  
- Did not require login for basic recommendations (cold start exists)  
- Did not add out-of-scope features (wishlist ranking, chat bots, etc.)

---

## 3. How recommendation works NOW (current design)

### 3.1 Three inputs

```text
┌─────────────────────┐
│ ReviewAnalysisScore │  ← from sentiment analyzer output (feature)
└─────────┬───────────┘
          │
┌─────────▼───────────┐
│  Bayesian Quality   │  ← smoothed stars + trust signals
└─────────┬───────────┘
          │
┌─────────▼───────────┐
│ Personalization     │  ← only if logged-in + enough history
└─────────┬───────────┘
          │
          ▼
   Hybrid RecommendationScore
   (+ trust floor gate)
```

### 3.2 Formulas (current weights)

Configured in `server/utils/recommendationWeights.js`.

**Personalized:**

```text
Score = (ReviewAnalysis × 0.42) + (Bayesian × 0.28) + (Personalization × 0.30)
```

**Cold start:**

```text
Score = (ReviewAnalysis × 0.55) + (Bayesian × 0.45)
```

Why ReviewAnalysis is weighted highly: this FYP’s AI contribution is review-text understanding, so text-derived quality must matter — but ranking still stays in the recommendation engine.

### 3.3 Bayesian rating (inside quality)

```text
R_bayes = (avgRating × n + μ0 × C) / (n + C)
```

| Symbol | Meaning in IARS |
|--------|-----------------|
| `avgRating` | Observed mean stars |
| `n` | Review count |
| `μ0` | **Dynamic** global prior mean (cached from approved reviewed properties) |
| `C` | Prior weight = `4` |

**Why Bayesian?** A property with one 5-star review should not beat a property with fifty strong reviews. Smoothing pulls sparse ratings toward the market prior.

### 3.4 Modes

| Mode | Who | What UI shows |
|------|-----|----------------|
| **Cold start** | Logged out, or logged in with little history | Top Bayesian / best reviewed / trending style sections |
| **Personalized** | Logged-in guest with enough history | Recent searches, previous bookings, preferred budget, viewed similar, popular in city, recommended for you |

**History gate (enough history if any of):** bookings, reviews, city searches, ≥ 2 views, favourites, or profile `hasSufficientHistory`.

### 3.5 Trust floor (critical viva point)

Before a property can be strongly promoted:

- Bayesian / combined quality must clear `minimumQualityScore` (0.28)  
- Soft Bayesian check uses `0.88 × minimumQualityScore`  
- If reviews exist, ReviewAnalysisScore must also clear ~`0.32`  

If trust floor fails → hybrid score becomes **0** (not recommended).

> **Viva line:** “Personalization reorders among trustworthy properties; it does not rescue bad ones.”

### 3.6 Dynamic market values (recent improvement)

| Value | Old risk | Now |
|-------|----------|-----|
| Prior mean \(\mu_0\) | Fixed 3.5 forever | Cached average of approved reviewed properties |
| Preferred price fallback | Hard-coded 15000 | Cached average approved listing price; 15000 only last-resort fallback |

Refreshed via `refreshRecommendationMarketStats()` when recommendations are requested.

---

## 4. Step-by-step: how a recommendation request works

Follow this sequence when explaining in viva (use the whiteboard).

### Step 1 — Client asks for recommendations

- Page: Home / Search  
- Call: `GET /api/recommendations` (JWT optional)  
- Optional query: city, price, min/max price, availabilityDate  
- Files: `searchService.js` → `searchController.getRecommendations`

### Step 2 — Refresh market statistics (background)

- Update cached global prior mean \(\mu_0\)  
- Update cached average listing price  
- File: `bayesianRanking.js`

### Step 3 — Build guest profile

- If no user → empty / cold-start profile (market price fallback)  
- If user → load searches, views, bookings, reviews  
- Derive preferred cities, budget, sentiment preference, interactions  
- File: `buildUserProfile.js`

### Step 4 — Load ranking context in parallel

- Approved properties from MongoDB  
- Global booking counts  
- Collaborative co-occurrence matrix  
- Files: `Property` model, `collaborativeFiltering.js`

### Step 5 — Enrich each property

- Attach review counts / average ratings  
- Attach sentiment summaries / snapshots  
- Files: `searchController` helpers, `recommendationEnrichment.js`, `propertySentimentStore` data

### Step 6 — Decide mode

- `buildRecommendationMode(userProfile, isAuthenticated)`  
- Personalized **or** cold start  
- File: `personalizedRecommendationEngine.js`

### Step 7 — Score every candidate property

For each approved property:

1. Compute **ReviewAnalysisScore** (`reviewSentimentRecommendation.js`)  
2. Compute **Bayesian Quality** (`bayesianRanking.js`)  
3. Compute **PersonalizationScore** if personalized (content + collaborative + profile match)  
4. Check **trust floor**  
5. Compute **Hybrid RecommendationScore**  

### Step 8 — Build sections

**Personalized sections (examples):**

- Based on recent searches  
- Similar to previous bookings  
- Within preferred budget  
- Similar to viewed properties  
- Popular in preferred city  
- Overall “for you” blend  

**Cold-start sections (examples):**

- Top Bayesian quality  
- Best reviewed / review-analysis strong  
- Trending (booking popularity signals)

### Step 9 — Finalize + explain

- Sort, dedupe, apply limits (`SECTION_LIMIT`, `RECOMMENDATION_TOTAL`)  
- Attach transparency: reasons, matched signals, score breakdown  
- Filter images for guest safety  
- File: `recommendationTransparency.js`, `filterGuestImages`

### Step 10 — Respond to UI

- JSON with `mode`, `sections`, `formula`, profile signals  
- UI renders `RecommendedProperties` / cards with reasons  

---

## 5. End-to-end data journey (from review text to ranked card)

```text
Guest writes review
        │
        ▼
sentiment-service /predict   (TF-IDF + Logistic Regression)
        │
        ▼
Review.sentiment + aspects stored
        │
        ▼
Property.sentimentSnapshot aggregated
        │
        ▼
ReviewAnalysisScore extracted   ← FEATURE (not a ranking decision)
        │
        ├── Bayesian Quality (stars + trust)
        ├── Personalization (if history)
        ▼
Hybrid score + trust floor
        │
        ▼
Ranked sections on Home / Search
```

---

## 6. File map (everything recommendation-related)

### Backend core

| File | Why it matters |
|------|----------------|
| `server/controllers/searchController.js` | HTTP orchestration for `/recommendations` |
| `server/routes/searchRoutes.js` | Route mount |
| `server/utils/personalizedRecommendationEngine.js` | Main hybrid engine + sections + mode |
| `server/utils/recommendationWeights.js` | All tunable weights / floors |
| `server/utils/bayesianRanking.js` | Bayesian rating/quality + dynamic market caches |
| `server/utils/reviewSentimentRecommendation.js` | Sentiment → ReviewAnalysisScore |
| `server/utils/buildUserProfile.js` | User history → preference profile |
| `server/utils/collaborativeFiltering.js` | Co-occurrence personalization |
| `server/utils/recommendationEnrichment.js` | Sentiment attach / reason helpers |
| `server/utils/recommendationTransparency.js` | Explainability payload |
| `server/utils/propertySignals.js` | Availability / amenity / aspect signals |
| `server/utils/propertySimilarity.js` | Content similarity |
| `server/utils/propertySentimentStore.js` | Keeps snapshot updated |
| `server/utils/sentimentAggregation.js` | Aggregate polarity/aspects |

### Models used

`Property`, `Review`, `Booking`, `PropertyView`, `SearchHistory`, `User`

### Frontend

`searchService.js`, `RecommendedProperties.jsx`, `RecommendedPropertyCard.jsx`, `HomePage.jsx`, `SearchPage.jsx`, `sentimentInsights.js`

---

## 7. Why this will impress the supervisor in viva

Use these talking points (short, confident, technical).

### 7.1 Clear research separation

Most student projects blur “sentiment app” and “recommender”. You can clearly say:

> Sentiment analyzes text. Recommendation ranks listings. Sentiment is an input feature.

That shows **architectural maturity**.

### 7.2 Hybrid, not a single naive sort

You did not sort only by average stars. You combine:

- NLP-derived review analysis  
- Bayesian-smoothed trust  
- Personalization from real user behaviour  

That looks like a **proper IR / recommender pipeline**, not a filter.

### 7.3 Cold-start problem solved

Supervisors often ask: “What if the user is new?”  
You have an explicit cold-start formula and sections — system still useful without history.

### 7.4 Quality floor / safety

Supervisors care about fairness and trust. You prevent:

> “I liked cheap noisy hotels, so recommend another low-quality hotel with bad reviews.”

Personalization is constrained by Bayesian + review-analysis floors.

### 7.5 Bayesian smoothing is academically defensible

You can write the formula and explain sparse-data bias. That is stronger than “we sorted by rating”.

### 7.6 Dynamic priors / market stats

You improved beyond hard-coded constants:

- Dynamic \(\mu_0\)  
- Dynamic average price fallback  

Shows you understand **data-dependent parameters**.

### 7.7 Explainability

Returning reasons / matched signals shows you thought about **trustworthy AI / transparency**, which supervisors like in FYP demos.

### 7.8 Clean engineering

Weights centralized; modules separated; API + UI wired; multilingual site still works. That shows implementation quality, not only theory slides.

### 7.9 Fits the full product workflow

Recommendations sit naturally after:

listing approval → guest search/view/book/review → sentiment → better ranking  

So it is not a disconnected ML demo.

---

## 8. Likely supervisor questions (with answer points)

### Q1. Does the sentiment model recommend properties?

**Answer:** No. It only converts review text into structured signals. The recommendation engine ranks using ReviewAnalysisScore as one feature among Bayesian quality and personalization.

### Q2. What is your recommendation formula?

**Answer:**  
Personalized: `0.42·ReviewAnalysis + 0.28·Bayesian + 0.30·Personalization`  
Cold start: `0.55·ReviewAnalysis + 0.45·Bayesian`  
Weights are heuristic/empirically tuned and documented in `recommendationWeights.js`.

### Q3. Why not 100% sentiment?

**Answer:** Sentiment can be noisy, sparse, or missing. Stars, review count, availability, and user preference still matter. Hybrid ranking is more robust.

### Q4. What is Bayesian rating and why use it?

**Answer:**  
`R = (avg·n + μ0·C)/(n+C)`. It shrinks extreme ratings with few reviews toward the global prior so one 5-star review cannot dominate.

### Q5. Is μ0 fixed?

**Answer:** Fallback is 3.5, but the live system uses a **dynamic cached global average** from approved properties that have reviews.

### Q6. What is the cold-start problem and how do you handle it?

**Answer:** New/anonymous users lack history. We disable personalization and rank by ReviewAnalysis + Bayesian quality, with cold-start sections.

### Q7. When does personalization turn on?

**Answer:** User must be authenticated and have sufficient history (bookings/reviews/searches/≥2 views/favourites). Otherwise cold start.

### Q8. Can personalization override bad reviews?

**Answer:** No. Trust floor blocks low Bayesian quality / weak ReviewAnalysis. Preference matching alone cannot promote poor listings.

### Q9. What signals are in personalization?

**Answer:** Content similarity to past bookings/views, search filter match, budget/city preference, collaborative co-occurrence from other users’ interactions, recency decay.

### Q10. How do collaborative and content-based methods appear?

**Answer:** Content-based via property similarity (city/price/amenities/type). Collaborative via co-occurrence matrix over bookings/views. Hybrid personalization blends them.

### Q11. Where is the code for ranking?

**Answer:** Main engine `personalizedRecommendationEngine.js`; Bayesian in `bayesianRanking.js`; feature extraction in `reviewSentimentRecommendation.js`; API in `searchController.js`.

### Q12. How do you evaluate / defend the weights?

**Answer:** Weights are heuristic, not claimed mathematical optima. They are centralized, documented, and chosen to emphasize review-text analysis (FYP focus) while keeping trust and personalization balanced. They can be tuned during evaluation without rewriting the engine.

### Q13. What if sentiment-service is down?

**Answer:** Review creation fails soft / uses fallback behaviour in the Node bridge; properties without strong analysis follow neutral/no-review paths; cold-start/Bayesian paths still function. Ranking does not require every property to have rich sentiment.

### Q14. How is this different from Airbnb-style filters?

**Answer:** Filters only narrow the set. Our system **ranks** using learned text features + Bayesian trust + personal history, and explains why items appear.

### Q15. Show me the pipeline on the board.

**Answer:** Use Section 4 + Section 5 of this document (request steps + review→rank journey).

### Q16. What did you improve recently?

**Answer:** Dynamic prior mean, dynamic average price for cold-start budget, centralized hybrid/feature/trust weights, market-stat refresh on recommendation requests, transparency metadata.

### Q17. Is image AI part of recommendation?

**Answer:** No. Image verification/audit is for listing trust and approval. Recommendation uses review analysis, Bayesian quality, and personalization. Approved listings are the candidate pool.

### Q18. Complexity / scalability note (if asked)

**Answer:** For FYP scale we score approved listings in Node with cached market stats and precomputed co-occurrence. For production scale one would add indexing, candidate generation, and offline feature stores — but the **algorithmic design** (hybrid + floor + cold start) remains valid.

---

## 9. Demo script for viva (2–3 minutes)

1. Open site logged out → show **cold-start** recommendations  
2. Login as guest with history (or quickly search/view twice) → show **personalized sections**  
3. Open a property with reviews → show **sentiment badges/summary**  
4. Say: “This sentiment is a feature for ranking, not the recommender itself”  
5. Mention formula + quality floor in one sentence  
6. Optional: show API response `mode` / `formula` fields if network tab is open  

---

## 10. Common mistakes to avoid in viva

| Don’t say | Say instead |
|-----------|-------------|
| “Sentiment recommends hotels” | “Sentiment extracts features; engine recommends” |
| “We sort by average rating” | “We use Bayesian-smoothed quality + hybrid score” |
| “Weights are optimal” | “Weights are documented heuristics tuned for this FYP” |
| “It only works if logged in” | “Cold start works for everyone; personalization when history exists” |
| “AI image model ranks listings” | “Image audit gates approval; ranking is separate” |

---

## 11. Summary

**What it is:** A hybrid accommodation recommender for IARS that ranks approved properties using Review Analysis (from ML sentiment), Bayesian Quality, and optional Personalization.

**What problem it solves:** Guests need trustworthy, relevant listings — not only star averages, and not only generic popularity — while new users still get useful suggestions.

**How it works:**  
Review text → sentiment feature → ReviewAnalysisScore → combine with Bayesian quality → add personalization if history exists → apply trust floor → return explained sections via `/api/recommendations`.

**Why it is strong for viva:** Clear research separation, academically defensible Bayesian smoothing, cold-start handling, quality floor, dynamic market parameters, explainability, and clean modular implementation aligned with the full booking/review workflow.

**Key files to remember:**  
`personalizedRecommendationEngine.js`, `bayesianRanking.js`, `reviewSentimentRecommendation.js`, `recommendationWeights.js`, `buildUserProfile.js`, `searchController.js`.

**Key formulas to remember:**  
Personalized `0.42 / 0.28 / 0.30`, Cold start `0.55 / 0.45`, Bayesian `(avg·n + μ0·C)/(n+C)` with `C=4` and dynamic \(\mu_0\).

---

## 12. Client explanation script (1–5 minutes)

For a spoken client / demo explanation with **exact code file references**, use:

→ [recommendation-client-script.md](./recommendation-client-script.md)