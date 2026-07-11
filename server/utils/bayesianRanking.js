import Property from "../models/Property.js";
import {
  computeAvailabilityScore,
  computeAmenityScore,
} from "./propertySignals.js";
import {
  BAYESIAN_CONFIG,
  QUALITY_WEIGHTS,
  NO_REVIEW_QUALITY_WEIGHTS,
  QUALITY_ADJUSTMENTS,
  MIN_QUALITY_SCORE as CONFIG_MIN_QUALITY_SCORE,
  PROFILE_DEFAULTS,
} from "./recommendationWeights.js";

/**
 * =============================================================================
 * Bayesian Quality Module
 * =============================================================================
 *
 * This module provides two related but distinct quantities:
 *
 * 1) Bayesian Rating (R_bayes)
 *    A smoothed star rating that shrinks sparse averages toward a global prior.
 *    Formula:
 *      R_bayes = (avgRating * n + μ0 * C) / (n + C)
 *    where:
 *      avgRating = observed mean star rating
 *      n         = review count
 *      μ0        = dynamic global prior mean (cached)
 *      C         = prior weight (BAYESIAN_CONFIG.priorWeight)
 *
 * 2) Bayesian Quality Score (Q)
 *    A broader [0, 1] trust/quality signal used as the recommendation quality
 *    floor. It combines Bayesian Rating with sentiment, credibility,
 *    availability, amenities, and a negative-review penalty.
 *
 * Why Bayesian smoothing is used:
 *    A property with one 5-star review should not outrank a property with fifty
 *    consistently strong reviews. Smoothing reduces small-sample volatility.
 *
 * Why review count matters:
 *    As n grows, R_bayes approaches the observed mean; as n → 0, it approaches
 *    the global prior. Credibility also rises (log-normalized) with n.
 *
 * Quality Floor:
 *    Personalization may reorder among trustworthy properties, but must not
 *    promote listings that fail the Bayesian Quality threshold. Preference
 *    matching alone cannot override poor quality.
 *
 * Backward compatibility:
 *    Exported function names and call signatures remain unchanged so the
 *    recommendation workflow and API behaviour stay intact.
 * =============================================================================
 */

/** @type {number} */
let cachedPriorMean = BAYESIAN_CONFIG.fallbackPriorMean;

/** @type {number} */
let priorMeanCachedAt = 0;

/** @type {Promise<number> | null} */
let priorMeanRefreshPromise = null;

/** @type {number} */
let cachedAveragePrice = PROFILE_DEFAULTS.fallbackPreferredPrice;

/** @type {number} */
let averagePriceCachedAt = 0;

/** @type {Promise<number> | null} */
let averagePriceRefreshPromise = null;

const clampScore = (value) => Math.max(0, Math.min(1, value));

/**
 * Logarithmic normalization of review count into [0, 1].
 * Diminishing returns: going from 0→8 reviews matters more than 40→48.
 */
const logNorm = (value, cap = 8) =>
  Math.min(Math.log1p(Math.max(0, value)) / Math.log1p(cap), 1);

/**
 * Computes the weighted global average rating across approved properties that
 * already have reviews. Uses sentimentSnapshot averages weighted by review
 * count so properties with more evidence influence the prior more strongly.
 *
 * @returns {Promise<number>} global prior mean in [1, 5] (approximately)
 */
export const computeGlobalAverageRating = async () => {
  const properties = await Property.find({
    status: "approved",
    "sentimentSnapshot.totalReviews": { $gt: 0 },
    "sentimentSnapshot.averageRating": { $gt: 0 },
  })
    .select("sentimentSnapshot.averageRating sentimentSnapshot.totalReviews")
    .lean();

  let weightedSum = 0;
  let totalWeight = 0;

  properties.forEach((property) => {
    const averageRating = Number(property.sentimentSnapshot?.averageRating);
    const reviewCount = Number(property.sentimentSnapshot?.totalReviews) || 0;

    if (!Number.isFinite(averageRating) || reviewCount <= 0) {
      return;
    }

    weightedSum += averageRating * reviewCount;
    totalWeight += reviewCount;
  });

  if (totalWeight <= 0) {
    return BAYESIAN_CONFIG.fallbackPriorMean;
  }

  return weightedSum / totalWeight;
};

/**
 * Refreshes the cached Bayesian prior mean (μ0).
 * Safe to call concurrently; concurrent callers share one in-flight promise.
 *
 * @returns {Promise<number>}
 */
export const refreshBayesianPriorMean = async () => {
  if (priorMeanRefreshPromise) {
    return priorMeanRefreshPromise;
  }

  priorMeanRefreshPromise = computeGlobalAverageRating()
    .then((mean) => {
      const safeMean = Number.isFinite(mean)
        ? mean
        : BAYESIAN_CONFIG.fallbackPriorMean;
      cachedPriorMean = safeMean;
      priorMeanCachedAt = Date.now();
      return cachedPriorMean;
    })
    .catch(() => {
      // Keep the last known / fallback mean if MongoDB is temporarily unavailable.
      priorMeanCachedAt = Date.now();
      return cachedPriorMean;
    })
    .finally(() => {
      priorMeanRefreshPromise = null;
    });

  return priorMeanRefreshPromise;
};

/**
 * Returns the current Bayesian prior mean (μ0).
 * Triggers a non-blocking refresh when the cache TTL has expired so request
 * paths remain synchronous and recommendation latency stays stable.
 *
 * @returns {number}
 */
export const getBayesianPriorMean = () => {
  const isStale =
    Date.now() - priorMeanCachedAt >= BAYESIAN_CONFIG.priorMeanCacheTtlMs;

  if (isStale) {
    // Fire-and-forget refresh; callers continue with the last cached value.
    refreshBayesianPriorMean().catch(() => {});
  }

  return cachedPriorMean;
};

/**
 * Computes the mean price of approved properties.
 * Used as a dynamic cold-start preferred-price fallback instead of a fixed
 * hard-coded market price.
 *
 * @returns {Promise<number>}
 */
export const computeGlobalAveragePrice = async () => {
  const result = await Property.aggregate([
    {
      $match: {
        status: "approved",
        price: { $gt: 0 },
      },
    },
    {
      $group: {
        _id: null,
        averagePrice: { $avg: "$price" },
        count: { $sum: 1 },
      },
    },
  ]);

  const averagePrice = result[0]?.averagePrice;
  if (!Number.isFinite(averagePrice) || averagePrice <= 0) {
    return PROFILE_DEFAULTS.fallbackPreferredPrice;
  }

  return Math.round(averagePrice);
};

/**
 * Refreshes the cached global average listing price.
 *
 * @returns {Promise<number>}
 */
export const refreshGlobalAveragePrice = async () => {
  if (averagePriceRefreshPromise) {
    return averagePriceRefreshPromise;
  }

  averagePriceRefreshPromise = computeGlobalAveragePrice()
    .then((price) => {
      cachedAveragePrice = Number.isFinite(price)
        ? price
        : PROFILE_DEFAULTS.fallbackPreferredPrice;
      averagePriceCachedAt = Date.now();
      return cachedAveragePrice;
    })
    .catch(() => {
      averagePriceCachedAt = Date.now();
      return cachedAveragePrice;
    })
    .finally(() => {
      averagePriceRefreshPromise = null;
    });

  return averagePriceRefreshPromise;
};

/**
 * Returns the cached dynamic average approved-property price.
 * Triggers a background refresh when stale.
 *
 * @returns {number}
 */
export const getGlobalAveragePrice = () => {
  const isStale =
    Date.now() - averagePriceCachedAt >= PROFILE_DEFAULTS.marketPriceCacheTtlMs;

  if (isStale) {
    refreshGlobalAveragePrice().catch(() => {});
  }

  return cachedAveragePrice;
};

/**
 * Refreshes all dynamic recommendation market statistics used as priors /
 * fallbacks (Bayesian prior mean + average listing price).
 *
 * @returns {Promise<{ priorMean: number, averagePrice: number }>}
 */
export const refreshRecommendationMarketStats = async () => {
  const [priorMean, averagePrice] = await Promise.all([
    refreshBayesianPriorMean(),
    refreshGlobalAveragePrice(),
  ]);

  return { priorMean, averagePrice };
};

// Prime market-stat caches once at module load (non-blocking).
refreshRecommendationMarketStats().catch(() => {});

/**
 * Bayesian Rating (smoothed star rating).
 *
 * R_bayes = (avgRating * n + μ0 * C) / (n + C)
 *
 * @param {number} [avgRating=0] Observed mean star rating for the property.
 * @param {number} [reviewCount=0] Number of reviews supporting avgRating.
 * @param {number} [priorMean] Optional override for μ0 (tests / diagnostics).
 * @returns {number} Smoothed rating on the star scale (typically ~1–5).
 */
export const computeBayesianRating = (
  avgRating = 0,
  reviewCount = 0,
  priorMean = getBayesianPriorMean(),
) => {
  const μ0 = Number.isFinite(priorMean)
    ? priorMean
    : BAYESIAN_CONFIG.fallbackPriorMean;
  const C = BAYESIAN_CONFIG.priorWeight;
  const safeAvg = Number.isFinite(avgRating) ? avgRating : μ0;
  const n = Math.max(0, reviewCount);

  return (safeAvg * n + μ0 * C) / (n + C);
};

/**
 * Bayesian Quality Score in [0, 1].
 *
 * Quality Score =
 *   Rating Contribution
 *   + Sentiment Contribution
 *   + Review Credibility
 *   + Availability
 *   + Amenities
 *   - Negative Review Penalty
 *   [± heuristic disagreement / low-rating adjustments]
 *
 * Component meanings:
 * - Rating Contribution: Bayesian-smoothed stars / 5, weighted by QUALITY_WEIGHTS.rating
 * - Sentiment Contribution: positivePercent / 100 from sentiment analysis
 * - Review Credibility: logNorm(reviewCount)
 * - Availability: calendar usefulness for the requested/current date
 * - Amenities: description amenity density
 * - Negative Review Penalty: negativeShare * QUALITY_WEIGHTS.negativePenalty
 *
 * Research role:
 *   This score is the trust/quality floor for recommendation. The Personalized
 *   Recommendation Layer may refine ordering among properties that pass the
 *   floor, but personalization must not rescue listings with poor Bayesian
 *   Quality. Preference matching alone cannot override quality.
 *
 * @param {object} property Property document/plain object with review stats and
 *   sentimentSummary / availabilityCalendar / description.
 * @param {object} [context={}] Optional ranking context (e.g. availabilityDate).
 * @returns {number} Quality score clamped to [0, 1].
 */
export const computeBayesianQualityScore = (property, context = {}) => {
  const sentiment = property.sentimentSummary || {};
  const reviewCount = property.reviewCount || sentiment.totalReviews || 0;
  const avgRating = property.avgRating || sentiment.averageRating || 0;

  // --- Bayesian Rating (smoothed stars), then normalize to [0, 1] ---
  const bayesianRating = computeBayesianRating(avgRating, reviewCount);
  const ratingNorm = bayesianRating / 5;

  // --- Sentiment analyzer feature (positive polarity share) ---
  const positivePercent = sentiment.positivePercent ?? 0;
  const sentimentScore = positivePercent / 100;
  const negativeCount = sentiment.negativeCount || 0;
  const negativeShare = reviewCount > 0 ? negativeCount / reviewCount : 0;

  // --- Credibility grows with review evidence (diminishing returns) ---
  const credibility = logNorm(reviewCount);

  // --- Operational support signals ---
  const availabilityScore = computeAvailabilityScore(
    property.availabilityCalendar,
    context.availabilityDate,
  );
  const amenityScore = computeAmenityScore(property.description);

  // Unreviewed properties: weak operational baseline only.
  if (reviewCount === 0) {
    return clampScore(
      NO_REVIEW_QUALITY_WEIGHTS.base +
        availabilityScore * NO_REVIEW_QUALITY_WEIGHTS.availability +
        amenityScore * NO_REVIEW_QUALITY_WEIGHTS.amenities,
    );
  }

  /**
   * Quality Score =
   *   Rating Contribution
   *   + Sentiment Contribution
   *   + Review Credibility
   *   + Availability
   *   + Amenities
   *   - Negative Review Penalty
   */
  let quality =
    ratingNorm * QUALITY_WEIGHTS.rating +
    sentimentScore * QUALITY_WEIGHTS.sentiment +
    credibility * QUALITY_WEIGHTS.credibility +
    availabilityScore * QUALITY_WEIGHTS.availability +
    amenityScore * QUALITY_WEIGHTS.amenities -
    negativeShare * QUALITY_WEIGHTS.negativePenalty;

  // Stars look strong but sentiment text is weak → distrust the rating alone.
  if (
    avgRating >= QUALITY_ADJUSTMENTS.highRatingThreshold &&
    positivePercent < QUALITY_ADJUSTMENTS.weakPositivePercentThreshold
  ) {
    quality -= QUALITY_ADJUSTMENTS.ratingSentimentDisagreementPenalty;
  }

  // Overall Bayesian-smoothed rating is weak → additional trust penalty.
  if (bayesianRating < QUALITY_ADJUSTMENTS.lowBayesianRatingThreshold) {
    quality -= QUALITY_ADJUSTMENTS.lowBayesianRatingPenalty;
  }

  return clampScore(quality);
};

/**
 * Quality floor used by the recommendation engine.
 * Personalization must not promote properties below this threshold.
 * Re-exported from recommendationWeights.js for backward-compatible imports.
 */
export const MIN_QUALITY_SCORE = CONFIG_MIN_QUALITY_SCORE;
