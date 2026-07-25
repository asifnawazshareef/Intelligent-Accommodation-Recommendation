# Personalized Recommendation Layer on Bayesian Ranking

## Intelligent Accommodation Review System (IARS)

This document describes the recommendation algorithm implemented in the IARS
backend. It is written as research documentation for the final-year project and
explains how a **Personalized Recommendation Layer** is added on top of an
existing **Bayesian quality ranking** engine without replacing that engine.

---

## 0. Core Idea: Sentiment Analysis Is a Feature Extractor

The sentiment analyzer does **not** recommend properties.

Its role is narrower and more precise:

1. Take unstructured guest review text
2. Convert that text into structured numerical signals
   (polarity, aspects, positive/negative counts, insight type)
3. Aggregate those signals into a property-level
   **ReviewAnalysisScore** ∈ `[0, 1]`
4. Pass that score into the recommendation engine as **one input feature**

```text
Unstructured review text
        │
        ▼
Sentiment Analyzer
(feature extraction only)
        │
        ▼
Structured numerical feature
(ReviewAnalysisScore)
        │
        ▼
Recommendation Engine
(combines ReviewAnalysis + Bayesian + Personalization)
        │
        ▼
Ranked property recommendations
```

Recommendation decisions are made only by the recommendation engine.
Sentiment analysis supplies a quality feature; it does not choose listings.

---

## 1. Existing Bayesian Recommendation

Before personalization, the platform ranked approved properties primarily by
quality signals:

- Bayesian-smoothed average rating
- Review count (credibility)
- Sentiment quality (positive / negative share)
- Availability and amenity signals

The Bayesian rating used in code is:

\[
R_{bayes} = \frac{\bar{r} \cdot n + \mu_0 \cdot w_0}{n + w_0}
\]

where \(\bar{r}\) is the observed average rating, \(n\) is the review count,
\(\mu_0 = 3.5\) is the prior mean, and \(w_0 = 4\) is the prior weight.

This score is then combined with sentiment and credibility into a single
**Bayesian Quality** value in `[0, 1]`. The same quality signal remains the
trust floor after personalization is introduced.

---

## 2. Research Gap

The original ranking treated every guest as identical. Two different
authenticated users searching the same catalogue would receive almost the same
ordered list, because ranking depended on property quality rather than on an
individual guest’s history.

The system already stored interaction records (`SearchHistory`, `PropertyView`,
`Booking`, `Review`) under `user_id`, but those records were not consistently
used as a guest-specific preference profile that drives ranking.

Without a `user_id`-scoped preference model, the engine cannot:

- prefer cities a guest repeatedly searches or books
- respect a guest’s budget behaviour
- surface properties similar to past stays or views
- collaborate with behaviour of similar guests

---

## 3. Why Personalization Is Required

Accommodation choice is highly individual. A guest who repeatedly books
family chalets in Murree at a mid-range budget should not receive the same
top list as a guest who searches luxury apartments in Lahore.

Personalization is therefore required to:

1. Link interactions over time to one guest identity (`user_id`)
2. Convert those interactions into a reusable preference profile
3. Re-rank high-quality properties according to that profile

Importantly, personalization is an **extension layer**, not a replacement for
Bayesian quality. Trust and listing quality must remain first-class.

---

## 4. User Interaction Tracking

Every recommendation for an authenticated guest is generated for a specific
`user_id`. Interactions stored against that identity include:

| Interaction | Model / Source | Role in personalization |
|---|---|---|
| Search | `SearchHistory` | Preferred cities, budget ranges, recent intent |
| Property view | `PropertyView` | Browse interest and content similarity seeds |
| Booking | `Booking` | Strong preference signal for city / type / price |
| Rating / review | `Review` | Favourite properties and sentiment preference |

Wishlist is intentionally out of scope for this FYP and is not required by the
algorithm.

Views are recorded through `POST /api/properties/:id/view`. Searches are
recorded when an authenticated guest runs a filtered search. Bookings and
reviews already store `guest` as `user_id`.

---

## 5. User Profile Construction

`buildUserRecommendationProfile(userId)` aggregates the guest’s history into a
reusable profile consumed by the Personalized Recommendation Layer:

- Preferred cities
- Preferred budget (`min`, `max`, preferred price)
- Preferred amenities (inferred from interacted property descriptions)
- Favourite property types
- Average booking price
- Booking frequency
- Recent searches
- Most viewed properties
- Most booked cities
- Review behaviour / sentiment preference
- Favourite properties (high ratings)

If `userId` is missing, or history is insufficient, the profile is marked
`hasSufficientHistory = false` and the engine stays in cold-start mode.

---

## 6. Content-Based Filtering

Content-based scoring compares a candidate property with properties the guest
has already booked, viewed, or highly rated. Similarity uses:

- City match
- Price proximity
- Inferred property type
- Amenity overlap from description text
- Weighted recency decay (recent interactions count more)

This answers: *“Which approved properties are similar to what this guest has
already shown interest in?”*

---

## 7. Collaborative Filtering

Collaborative filtering builds a co-occurrence matrix over guests:

- Two properties co-booked by the same guest receive a strong link
- Two properties co-viewed by the same guest receive a weaker link

A candidate property scores higher when it co-occurs with properties already in
the guest’s interaction set. This answers: *“What do similar guests also
engage with?”*

---

## 8. Hybrid Recommendation

The recommendation engine combines **independent inputs**. One of those inputs
is the ReviewAnalysisScore feature extracted from sentiment analysis:

- ReviewAnalysisScore ← numerical feature from sentiment analyzer
- Bayesian rating quality
- Content-based / collaborative / preference personalization

### Personalized formula

```text
RecommendationScore =
  (ReviewAnalysisScore × 0.42)
  + (BayesianQuality × 0.28)
  + (PersonalizationScore × 0.30)
```

### Cold-start formula

```text
RecommendationScore =
  (ReviewAnalysisScore × 0.55)
  + (BayesianQuality × 0.45)
```

Sentiment analysis remains upstream feature extraction. The recommendation
engine alone produces the final ranked list.

---

## 9. Cold Start Strategy

Cold start is a deliberate design choice, not a failure mode.

Personalization is **not** attempted until the guest has sufficient
`user_id`-linked history, defined as at least one strong signal (booking,
high rating, or city search) or at least two property views.

Until then:

- Anonymous guests and new guests receive the existing Bayesian ranking
- Sections emphasise top Bayesian quality, best-reviewed, and trending listings
- `isColdStart = true` is returned in the API response

This prevents noisy personalization from a single accidental click and keeps
the Bayesian engine as the safe default.

---

## 10. Bayesian Quality Floor

Bayesian Quality remains the trust signal.

A property that fails the quality floor (`MIN_QUALITY_SCORE`) cannot receive a
high hybrid score merely because it matches the guest’s preferences. In
personalized mode, such properties are scored to zero for ranking purposes.

Interpretation for the dissertation:

> Personalization refines ordering among trustworthy properties; it does not
> override quality.

---

## 11. Recommendation Formula

### Personalized mode

\[
Score = (S \times 0.42) + (Q \times 0.28) + (P \times 0.30)
\]

where:

- \(S\) = ReviewAnalysisScore — structured numerical feature from sentiment analysis
- \(Q\) = Bayesian Quality
- \(P\) = Personalization Score

Sentiment analysis contributes \(S\). It does not produce the final ranking.

### Cold-start mode

\[
Score = (S \times 0.55) + (Q \times 0.45)
\]

### Transparency metadata

Each recommended property includes:

```json
{
  "recommendationScore": 0.81,
  "reviewAnalysisScore": 0.84,
  "bayesianQuality": 0.76,
  "personalizationScore": 0.88,
  "matchedSignals": [
    "Positive Reviews",
    "Preferred City",
    "Booking History",
    "Budget Match"
  ],
  "recommendationReason": "Recommended because positive guest sentiment and similar to your previous bookings",
  "isColdStart": false
}
```

---

## 12. Advantages

1. Preserves the existing Bayesian engine as the quality / trust backbone
2. Introduces a clear research contribution: a Personalized Recommendation Layer
3. Ties recommendations to a concrete `user_id` interaction graph
4. Supports cold start without inventing fake personalization
5. Produces explainable recommendations with matched signals
6. Remains modular (`bayesianRanking`, `buildUserProfile`, content similarity,
   collaborative filtering, transparency helpers)

---

## 13. Limitations

1. Collaborative filtering is sparse on small datasets and may contribute little
   early in deployment
2. Amenities and property types are inferred from free-text descriptions rather
   than a dedicated structured amenity schema
3. Sentiment preference is derived from a guest’s own reviews and may be weak
   when review volume is low
4. No wishlist signal is used (out of FYP scope)
5. The quality floor threshold is heuristic and may need empirical tuning on a
   larger labelled evaluation set

---

## 14. Future Work

1. Offline A/B evaluation of personalized vs Bayesian-only ranking
2. Stronger aspect-level preference modelling from review text
3. Temporal session modelling for short-term intent
4. Learning weight parameters (\(w_q\), \(w_p\)) from click / booking feedback
5. Optional wishlist / saved-property signal if later brought into scope

---

## Implementation Map

| Concern | Module |
|---|---|
| Sentiment analyzer → review analysis score | `server/utils/reviewSentimentRecommendation.js` |
| Sentiment snapshot aggregation | `server/utils/propertySentimentStore.js` |
| Bayesian quality / floor | `server/utils/bayesianRanking.js` |
| User profile from `user_id` history | `server/utils/buildUserProfile.js` |
| Content similarity | `server/utils/propertySimilarity.js` |
| Collaborative filtering | `server/utils/collaborativeFiltering.js` |
| Hybrid personalized engine | `server/utils/personalizedRecommendationEngine.js` |
| Explanation / transparency | `server/utils/recommendationTransparency.js` |
| API orchestration | `server/controllers/searchController.js` |

---

## Research Contribution Summary

The contribution of this project includes a clear separation of roles:

1. **Sentiment analyzer** = feature extractor  
   Converts unstructured review text into a structured numerical feature.
2. **Recommendation engine** = decision maker  
   Combines that feature with Bayesian quality and personalization to rank
   properties.
3. **Personalized Recommendation Layer**  
   Uses `user_id` interaction history on top of quality features, without
   replacing Bayesian ranking.

Sentiment analysis therefore feeds recommendation; it does not replace it.
