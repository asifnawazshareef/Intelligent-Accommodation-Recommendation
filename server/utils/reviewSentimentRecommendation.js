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
import {
  REVIEW_ANALYSIS_FEATURE_WEIGHTS as W,
  TRUST_FLOOR,
} from "./recommendationWeights.js";

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
 * Feature composition (weights from REVIEW_ANALYSIS_FEATURE_WEIGHTS):
 *   - Overall polarity (positivePercent)
 *   - Aspect-level praise vs concern balance
 *   - Insight type (praised / mixed / concerns)
 *   - Review-volume credibility
 *   - Negative-share penalty
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
      reviewAnalysisScore: W.noReviewNeutralScore,
      hasReviewAnalysis: false,
      analysis,
      breakdown: {
        polarityScore: W.noReviewNeutralScore,
        aspectScore: 0.5,
        insightScore: W.noReviewNeutralScore,
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

  let insightScore = W.insightNeutral;
  if (insightType === "praised" || (praisedAspects?.length || 0) > 0) {
    insightScore = W.insightPraised;
  } else if (insightType === "mixed") {
    insightScore = W.insightMixed;
  } else if (insightType === "concerns" || (concernAspects?.length || 0) > 0) {
    insightScore = W.insightConcerns;
  }

  const credibilityScore = logNorm(totalReviews);

  let reviewAnalysisScore =
    polarityScore * W.polarity +
    aspectScore * W.aspect +
    insightScore * W.insight +
    credibilityScore * W.credibility -
    negativeShare * W.negativePenalty;

  if (
    positivePercent < W.weakPolarityPercentThreshold &&
    negativeShare >= W.highNegativeShareThreshold
  ) {
    reviewAnalysisScore -= W.weakPolarityPenalty;
  }

  if (
    positivePercent >= W.strongPositivePercentThreshold &&
    aspectScore >= W.strongAspectThreshold
  ) {
    reviewAnalysisScore += W.strongPositiveBoost;
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
export const MIN_REVIEW_ANALYSIS_SCORE = TRUST_FLOOR.minimumReviewAnalysisScore;
