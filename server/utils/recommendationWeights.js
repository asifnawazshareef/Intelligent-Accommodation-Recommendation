/**
 * Recommendation / Bayesian quality configuration.
 *
 * These weights are heuristic and empirically tuned for the IARS FYP.
 * They are NOT mathematically fixed optima; they are documented constants
 * so the Bayesian Quality model can be defended and adjusted transparently
 * during evaluation without scattering magic numbers through the codebase.
 */

/**
 * Bayesian smoothing configuration.
 *
 * priorWeight (C):
 *   Controls how strongly the global prior mean pulls a property's observed
 *   average rating. In Bayesian average form:
 *     R_bayes = (avgRating * n + priorMean * C) / (n + C)
 *   A value of 4 means a property needs roughly four reviews before its
 *   observed mean outweighs the global prior. This reduces over-ranking of
 *   properties with only one or two extreme ratings.
 *
 * fallbackPriorMean:
 *   Used only until the first successful computation of the dynamic global
 *   average rating from approved properties that already have reviews.
 *
 * priorMeanCacheTtlMs:
 *   How long the cached global prior mean remains valid before a background
 *   refresh is attempted. Avoids recomputing the global average on every
 *   recommendation request.
 *
 * minimumQualityScore:
 *   Quality floor. Properties below this combined Bayesian Quality threshold
 *   should not be promoted by personalization alone.
 */
export const BAYESIAN_CONFIG = {
  priorWeight: 4,
  fallbackPriorMean: 3.5,
  priorMeanCacheTtlMs: 5 * 60 * 1000,
  minimumQualityScore: 0.28,
};

/**
 * Weights used inside computeBayesianQualityScore for properties that have
 * at least one review.
 *
 * Quality Score =
 *   Rating Contribution
 *   + Sentiment Contribution
 *   + Review Credibility
 *   + Availability
 *   + Amenities
 *   - Negative Review Penalty
 *   (+ optional disagreement / low-rating adjustments)
 *
 * Why these approximate values were selected:
 * - Sentiment receives the largest positive weight because this FYP's core
 *   AI contribution is review-text analysis; star ratings alone omit tone.
 * - Rating remains substantial because guests still rely on stars.
 * - Credibility grows with review count (log-normalized) so sparse evidence
 *   cannot dominate.
 * - Availability and amenities are weaker operational signals; they support
 *   quality but do not redefine it.
 * - Negative penalty subtracts when many reviews are classified negative.
 *
 * These values remain heuristic / empirically tuned, not closed-form optima.
 */
export const QUALITY_WEIGHTS = {
  /**
   * Signal: Bayesian-smoothed star rating normalized to [0, 1].
   * Why: captures overall guest satisfaction in a familiar metric.
   * Weight ~0.30: strong but not exclusive, leaving room for sentiment.
   */
  rating: 0.3,

  /**
   * Signal: positive sentiment share from the sentiment analyzer.
   * Why: review text polarity is a richer quality cue than stars alone.
   * Weight ~0.40: largest positive term to reflect the project's NLP focus.
   */
  sentiment: 0.4,

  /**
   * Signal: log-normalized review count (credibility).
   * Why: more reviews make the observed mean more trustworthy.
   * Weight ~0.15: meaningful support without overpowering polarity/rating.
   */
  credibility: 0.15,

  /**
   * Signal: availability calendar usefulness for the requested/current date.
   * Why: a high-rated unavailable property is less useful to the guest now.
   * Weight ~0.08: secondary operational contribution.
   */
  availability: 0.08,

  /**
   * Signal: amenity keyword richness in the property description.
   * Why: amenities correlate with perceived stay quality.
   * Weight ~0.05: light support; description text is imperfect evidence.
   */
  amenities: 0.05,

  /**
   * Signal: share of negative sentiment-classified reviews.
   * Why: concentrated negativity should reduce trust even if stars look fair.
   * Weight ~0.20: applied as a subtraction (penalty), not an additive bonus.
   */
  negativePenalty: 0.2,
};

/**
 * Fallback quality composition when a property has zero reviews.
 * Without ratings/sentiment, only weak operational signals remain.
 */
export const NO_REVIEW_QUALITY_WEIGHTS = {
  /**
   * Base score for unreviewed approved listings so they are not scored at 0,
   * while remaining clearly below well-reviewed quality properties.
   */
  base: 0.12,

  /**
   * Availability still matters for cold/unreviewed inventory.
   */
  availability: 0.1,

  /**
   * Amenity description provides a minimal positive cue.
   */
  amenities: 0.06,
};

/**
 * Extra heuristic adjustments applied after the main weighted sum.
 * These encode known failure modes observed during development.
 */
export const QUALITY_ADJUSTMENTS = {
  /**
   * High star rating but weak positive sentiment share: stars and text disagree.
   * Penalize to avoid trusting inflated ratings without supportive review tone.
   */
  ratingSentimentDisagreementPenalty: 0.12,

  /**
   * Thresholds that trigger the disagreement penalty.
   */
  highRatingThreshold: 4,
  weakPositivePercentThreshold: 50,

  /**
   * Bayesian-smoothed rating below this value indicates overall weak trust.
   */
  lowBayesianRatingThreshold: 3,
  lowBayesianRatingPenalty: 0.15,
};

/** Re-export alias kept for callers that import the floor from config. */
export const MIN_QUALITY_SCORE = BAYESIAN_CONFIG.minimumQualityScore;

/**
 * Hybrid recommendation score weights.
 * Used by personalizedRecommendationEngine.computeHybridRecommendationScore.
 * Sentiment-derived ReviewAnalysis is one feature among others — not a recommender.
 */
export const HYBRID_SCORE_WEIGHTS = {
  personalized: {
    reviewAnalysis: 0.42,
    bayesianQuality: 0.28,
    personalization: 0.3,
  },
  coldStart: {
    reviewAnalysis: 0.55,
    bayesianQuality: 0.45,
  },
  /**
   * When combining review-analysis and Bayesian quality into combinedQuality.
   */
  combinedQuality: {
    reviewAnalysis: 0.58,
    bayesianQuality: 0.42,
  },
};

/**
 * Trust-floor multipliers / thresholds used when gating personalization.
 */
export const TRUST_FLOOR = {
  /**
   * Bayesian quality must be at least minimumQualityScore * this factor.
   */
  bayesianFloorFactor: 0.88,
  /**
   * Minimum ReviewAnalysisScore when the property already has analyzed reviews.
   */
  minimumReviewAnalysisScore: 0.32,
};

/**
 * Feature weights for converting sentiment-analyzer output into ReviewAnalysisScore.
 * This is feature extraction configuration, not recommendation ranking itself.
 */
export const REVIEW_ANALYSIS_FEATURE_WEIGHTS = {
  polarity: 0.45,
  aspect: 0.25,
  insight: 0.15,
  credibility: 0.15,
  negativePenalty: 0.28,
  noReviewNeutralScore: 0.45,
  weakPolarityPercentThreshold: 40,
  highNegativeShareThreshold: 0.35,
  weakPolarityPenalty: 0.12,
  strongPositivePercentThreshold: 70,
  strongAspectThreshold: 0.65,
  strongPositiveBoost: 0.06,
  insightPraised: 0.85,
  insightMixed: 0.55,
  insightConcerns: 0.25,
  insightNeutral: 0.5,
};

/**
 * Guest profile defaults / budget heuristics.
 * fallbackPreferredPrice is only used until the dynamic market average price
 * cache has been populated from approved listings.
 */
export const PROFILE_DEFAULTS = {
  fallbackPreferredPrice: 15000,
  budgetMinFactor: 0.8,
  budgetMaxFactor: 1.2,
  bookedBudgetMinFactor: 0.75,
  bookedBudgetMaxFactor: 1.25,
  marketPriceCacheTtlMs: 5 * 60 * 1000,
};
