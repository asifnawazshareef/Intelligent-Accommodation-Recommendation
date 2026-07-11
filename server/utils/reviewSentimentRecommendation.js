/**
 * Review-analysis feature for recommendations.
 *
 * Important architectural separation:
 *   The sentiment analyzer does NOT recommend properties.
 *   It only converts unstructured review text into a structured numerical
 *   feature (ReviewAnalysisScore in [0, 1]).
 *
 * Pipeline:
 *   Review text (unstructured)
 *     → Sentiment Analyzer (polarity + aspects)
 *     → Review.sentiment / aspects stored
 *     → Property.sentimentSnapshot aggregated
 *     → ReviewAnalysisScore  ← numerical FEATURE
 *     → Recommendation Engine uses this feature as ONE ranking input
 *       together with Bayesian quality and (when available) personalization
 */

import { computeAspectSatisfaction } from "./propertySignals.js";

const clampScore = (value) => Math.max(0, Math.min(1, value));

const logNorm = (value, cap = 8) =>
  Math.min(Math.log1p(Math.max(0, value)) / Math.log1p(cap), 1);

/**
 * Resolves the property's review-analysis payload from either the live
 * sentimentSummary (attached for ranking) or the persisted sentimentSnapshot.
 */
export const getReviewAnalysisInput = (property = {}) => {
  const summary = property.sentimentSummary || {};
  const snapshot = property.sentimentSnapshot || {};

  const totalReviews =
    summary.totalReviews ||
    snapshot.totalReviews ||
    property.reviewCount ||
    0;

  return {
    totalReviews,
    positiveCount: summary.positiveCount ?? snapshot.positiveCount ?? 0,
    negativeCount: summary.negativeCount ?? snapshot.negativeCount ?? 0,
    neutralCount: summary.neutralCount ?? snapshot.neutralCount ?? 0,
    mixedCount: summary.mixedCount ?? snapshot.mixedCount ?? 0,
    positivePercent: summary.positivePercent ?? snapshot.positivePercent ?? 0,
    averageRating:
      property.avgRating ??
      summary.averageRating ??
      snapshot.averageRating ??
      0,
    insightType: summary.insightType || snapshot.insightType || "none",
    topPraisedAspect:
      summary.topPraisedAspect || snapshot.topPraisedAspect || null,
    aspectBreakdown: summary.aspectBreakdown || snapshot.aspectBreakdown || [],
    praisedAspects: summary.praisedAspects || snapshot.praisedAspects || [],
    concernAspects: summary.concernAspects || snapshot.concernAspects || [],
  };
};

/**
 * Converts sentiment-analyzer output into one structured numerical feature
 * for the recommendation engine: ReviewAnalysisScore ∈ [0, 1].
 *
 * This is feature extraction, not recommendation.
 *
 * Feature composition:
 *   - Overall polarity (positivePercent)        45%
 *   - Aspect-level praise vs concern balance    25%
 *   - Insight type (praised / mixed / concerns) 15%
 *   - Review-volume credibility                 15%
 *   - Negative-share penalty                    embedded
 */
export const computeReviewAnalysisScore = (property = {}) => {
  const analysis = getReviewAnalysisInput(property);
  const {
    totalReviews,
    positivePercent,
    negativeCount,
    insightType,
    aspectBreakdown,
    praisedAspects,
    concernAspects,
  } = analysis;

  // No analyzed reviews yet: neutral midpoint feature value.
  if (!totalReviews) {
    return {
      reviewAnalysisScore: 0.45,
      hasReviewAnalysis: false,
      analysis,
      breakdown: {
        polarityScore: 0.45,
        aspectScore: 0.5,
        insightScore: 0.45,
        credibilityScore: 0,
      },
    };
  }

  const polarityScore = clampScore(positivePercent / 100);
  const negativeShare = negativeCount / totalReviews;
  const aspectScore = clampScore(
    computeAspectSatisfaction({
      aspectBreakdown,
    }),
  );

  let insightScore = 0.5;
  if (insightType === "praised" || (praisedAspects?.length || 0) > 0) {
    insightScore = 0.85;
  } else if (insightType === "mixed") {
    insightScore = 0.55;
  } else if (insightType === "concerns" || (concernAspects?.length || 0) > 0) {
    insightScore = 0.25;
  }

  const credibilityScore = logNorm(totalReviews);

  let reviewAnalysisScore =
    polarityScore * 0.45 +
    aspectScore * 0.25 +
    insightScore * 0.15 +
    credibilityScore * 0.15 -
    negativeShare * 0.28;

  if (positivePercent < 40 && negativeShare >= 0.35) {
    reviewAnalysisScore -= 0.12;
  }

  if (positivePercent >= 70 && aspectScore >= 0.65) {
    reviewAnalysisScore += 0.06;
  }

  return {
    reviewAnalysisScore: clampScore(reviewAnalysisScore),
    hasReviewAnalysis: true,
    analysis,
    breakdown: {
      polarityScore: Number(polarityScore.toFixed(4)),
      aspectScore: Number(aspectScore.toFixed(4)),
      insightScore: Number(insightScore.toFixed(4)),
      credibilityScore: Number(credibilityScore.toFixed(4)),
      negativeShare: Number(negativeShare.toFixed(4)),
    },
  };
};

/**
 * Soft floor for the review-analysis feature when reviews exist.
 * Used by the recommendation engine as a trust gate, not as a recommender.
 */
export const MIN_REVIEW_ANALYSIS_SCORE = 0.32;
