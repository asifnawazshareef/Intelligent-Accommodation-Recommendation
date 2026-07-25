# Bayesian Quality in IARS

## 1. Purpose

This document explains the Bayesian Quality implementation used by the Intelligent Accommodation Review System (IARS). Bayesian Quality is the trust and quality signal of the recommendation engine. Personalization may refine ordering among trustworthy properties, but it must not promote low-quality listings merely because they match a guest’s preferences.

The implementation is intentionally configurable and documented so that the design can be defended in a Final Year Project viva without relying on unexplained magic numbers.

---

## 2. What Bayesian Rating Is

Bayesian Rating is a smoothed estimate of a property’s star rating. It blends the property’s observed average rating with a global prior mean, weighted by how many reviews support the observation.

Formal definition:

\[
R_{\text{bayes}} = \frac{\bar{r} \cdot n + \mu_0 \cdot C}{n + C}
\]

where:

- \(\bar{r}\) is the observed average rating of the property
- \(n\) is the number of reviews
- \(\mu_0\) is the global prior mean rating
- \(C\) is the prior weight (`BAYESIAN_CONFIG.priorWeight`)

In code, this is implemented by `computeBayesianRating()` in `server/utils/bayesianRanking.js`.

### Dynamic prior mean \(\mu_0\)

IARS does not hard-code \(\mu_0 = 3.5\) as a permanent constant. Instead, \(\mu_0\) is computed as the weighted global average rating of all **approved** properties that already have reviews, using `sentimentSnapshot.averageRating` weighted by `sentimentSnapshot.totalReviews`.

The value is cached and refreshed periodically (`priorMeanCacheTtlMs`) so recommendation requests do not recalculate the global mean on every call. Until the first successful refresh, a documented fallback mean is used.

### Configurable prior weight \(C\)

The prior weight is configured in `server/utils/recommendationWeights.js`:

```js
BAYESIAN_CONFIG.priorWeight = 4
```

A value of 4 means that approximately four reviews are required before the observed mean outweighs the global prior. This is a heuristic chosen for a student-scale dataset: large enough to dampen one-off extreme ratings, small enough that genuine evidence can still move the score.

---

## 3. Difference Between Bayesian Rating and Bayesian Quality Score

| Concept | Meaning | Scale | Role |
|---|---|---|---|
| **Bayesian Rating** | Smoothed star rating | Approximately 1–5 | Intermediate statistical estimate |
| **Bayesian Quality Score** | Broader trust/quality signal | `[0, 1]` | Recommendation quality floor |

Bayesian Rating answers: “What is a stable estimate of this property’s star rating?”

Bayesian Quality Score answers: “How trustworthy and useful is this property as a recommendation candidate?”

Bayesian Quality therefore includes Bayesian Rating, but also sentiment polarity, review credibility, availability, amenities, and penalties for negative review share or rating–sentiment disagreement.

---

## 4. Why Bayesian Smoothing Is Required

Without smoothing, a newly reviewed property with a single five-star rating can outrank a mature property with dozens of consistently strong reviews. That behaviour is statistically unstable and unfair.

Bayesian smoothing shrinks sparse averages toward the community prior. As review count grows, the estimate converges to the observed mean. This is a standard and academically recognised approach for ranking with aggregate feedback under small-sample uncertainty.

---

## 5. Why Review Count Is Important

Review count (\(n\)) plays two roles:

1. **In Bayesian Rating**, larger \(n\) reduces the influence of the prior and increases confidence in the observed mean.
2. **In Bayesian Quality**, review count is converted into a credibility term using logarithmic normalization. Credibility rises quickly for the first reviews and then saturates, reflecting diminishing informational returns.

Thus, evidence volume is rewarded without allowing raw review count to dominate polarity or rating.

---

## 6. Why Sentiment Is Included

Star ratings compress guest opinion into a single number. Review text contains richer quality cues: praise, complaints, and aspect-level tone.

IARS therefore includes the positive sentiment share produced by the sentiment analyzer as a major quality component. Sentiment analysis does not recommend properties by itself; it contributes a structured numerical feature that Bayesian Quality consumes.

This design is aligned with the project’s research narrative: NLP-derived review signals feed quality estimation, while the recommendation engine remains the decision maker.

---

## 7. Why Credibility Uses Logarithmic Normalization

Credibility is computed as:

\[
\text{credibility} = \min\left(\frac{\log(1 + n)}{\log(1 + \text{cap})}, 1\right)
\]

with a small cap (default 8). Logarithmic normalization is used because:

- moving from 0 to a handful of reviews substantially increases trust
- moving from 40 to 48 reviews adds comparatively little new certainty
- a linear function of \(n\) would over-reward popular listings simply for volume

This is a common diminishing-returns transformation for count-based evidence.

---

## 8. Why Availability and Amenities Are Included

Bayesian Quality is not only a retrospective review score; it is a recommendation utility score.

- **Availability** captures whether the property is currently usable for the guest’s date context. A highly rated but unavailable listing is less useful.
- **Amenities** provide a weak positive cue from the listing description. They are weighted lightly because free-text amenity extraction is imperfect.

These terms are secondary. They support quality; they do not redefine it.

---

## 9. Why Negative Review Penalties Exist

A property may retain a moderate average rating while accumulating a large share of negative sentiment-classified reviews. In that case, polarity evidence contradicts a naive reading of stars.

Bayesian Quality therefore subtracts a penalty proportional to negative review share. An additional disagreement penalty is applied when the average rating is high but positive sentiment percentage remains weak. A further penalty applies when the Bayesian-smoothed rating itself is low.

These adjustments encode observed failure modes and keep the quality floor conservative.

---

## 10. Quality Score Formula

For properties with at least one review:

```text
Quality Score =
  Rating Contribution
  + Sentiment Contribution
  + Review Credibility
  + Availability
  + Amenities
  - Negative Review Penalty
  ± Heuristic adjustments
```

Where:

- **Rating Contribution** = `(Bayesian Rating / 5) × QUALITY_WEIGHTS.rating`
- **Sentiment Contribution** = `(positivePercent / 100) × QUALITY_WEIGHTS.sentiment`
- **Review Credibility** = `logNorm(reviewCount) × QUALITY_WEIGHTS.credibility`
- **Availability** = `availabilityScore × QUALITY_WEIGHTS.availability`
- **Amenities** = `amenityScore × QUALITY_WEIGHTS.amenities`
- **Negative Review Penalty** = `negativeShare × QUALITY_WEIGHTS.negativePenalty`

All component weights are named constants in `server/utils/recommendationWeights.js`. They are heuristic and empirically tuned for this FYP; they are not claimed as mathematically unique optima.

For properties with zero reviews, a weaker operational baseline is used (`NO_REVIEW_QUALITY_WEIGHTS`) so unreviewed inventory is not scored as zero, but remains below well-reviewed quality candidates.

---

## 11. Why Bayesian Quality Acts as the Quality Floor

In the hybrid recommendation engine:

```text
RecommendationScore =
  f(ReviewAnalysisScore, BayesianQuality, PersonalizationScore)
```

Bayesian Quality (together with related trust checks) acts as a **quality floor**:

- personalization may reorder high-quality candidates for a specific guest
- personalization must not elevate a poor-quality property solely because it matches preferred city, budget, or browsing history

This separation is central to the research contribution. The Personalized Recommendation Layer extends Bayesian quality ranking; it does not replace the trust signal.

The minimum quality threshold is configured as:

```js
BAYESIAN_CONFIG.minimumQualityScore = 0.28
```

and exported as `MIN_QUALITY_SCORE` for backward-compatible imports.

---

## 12. Implementation Map

| Concern | Location |
|---|---|
| Configurable weights and Bayesian parameters | `server/utils/recommendationWeights.js` |
| Bayesian Rating + Bayesian Quality Score | `server/utils/bayesianRanking.js` |
| Dynamic prior mean computation / cache | `computeGlobalAverageRating`, `getBayesianPriorMean`, `refreshBayesianPriorMean` |
| Consumption by recommendation engine | `server/utils/personalizedRecommendationEngine.js` |

---

## 13. Viva Defence Summary

1. Bayesian Rating stabilises sparse star ratings using a dynamic global prior.  
2. Bayesian Quality Score expands that rating into a broader trust signal with sentiment and credibility.  
3. Weights are configurable, named, and academically justified as heuristics.  
4. Personalization cannot override the quality floor.  
5. Sentiment analysis contributes features; Bayesian Quality and the recommendation engine make ranking decisions.

This design is functionally aligned with the previous implementation while being more maintainable, configurable, and defendable in academic evaluation.
