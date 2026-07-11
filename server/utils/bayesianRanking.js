import {
  computeAvailabilityScore,
  computeAmenityScore,
} from "./propertySignals.js";

const PRIOR_RATING_MEAN = 3.5;
const PRIOR_RATING_WEIGHT = 4;

const clampScore = (value) => Math.max(0, Math.min(1, value));

const logNorm = (value, cap = 8) =>
  Math.min(Math.log1p(Math.max(0, value)) / Math.log1p(cap), 1);

export const computeBayesianRating = (avgRating = 0, reviewCount = 0) => {
  const safeAvg = Number.isFinite(avgRating) ? avgRating : PRIOR_RATING_MEAN;
  const count = Math.max(0, reviewCount);

  return (
    (safeAvg * count + PRIOR_RATING_MEAN * PRIOR_RATING_WEIGHT) /
    (count + PRIOR_RATING_WEIGHT)
  );
};

/**
 * Global trust/quality score used as the primary ranking signal and quality floor.
 * Combines Bayesian-smoothed star rating with sentiment and review credibility.
 *
 * Research role: this score is NOT replaced by personalization. The Personalized
 * Recommendation Layer only reorders among properties that pass this quality floor.
 * Poor-quality listings must never rank highly merely because they match a guest
 * preference profile.
 */
export const computeBayesianQualityScore = (property, context = {}) => {
  const sentiment = property.sentimentSummary || {};
  const reviewCount = property.reviewCount || sentiment.totalReviews || 0;
  const avgRating = property.avgRating || sentiment.averageRating || 0;
  const bayesianRating = computeBayesianRating(avgRating, reviewCount);
  const ratingNorm = bayesianRating / 5;

  const positivePercent = sentiment.positivePercent ?? 0;
  const sentimentScore = positivePercent / 100;
  const negativeCount = sentiment.negativeCount || 0;
  const negativeShare = reviewCount > 0 ? negativeCount / reviewCount : 0;
  const credibility = logNorm(reviewCount);

  const availabilityScore = computeAvailabilityScore(
    property.availabilityCalendar,
    context.availabilityDate,
  );
  const amenityScore = computeAmenityScore(property.description);

  if (reviewCount === 0) {
    return clampScore(
      0.12 + availabilityScore * 0.1 + amenityScore * 0.06,
    );
  }

  let quality =
    ratingNorm * 0.3 +
    sentimentScore * 0.4 +
    credibility * 0.15 +
    availabilityScore * 0.08 +
    amenityScore * 0.05 -
    negativeShare * 0.2;

  if (avgRating >= 4 && positivePercent < 50) {
    quality -= 0.12;
  }

  if (bayesianRating < 3) {
    quality -= 0.15;
  }

  return clampScore(quality);
};

export const MIN_QUALITY_SCORE = 0.28;
