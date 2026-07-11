import {
  computeBayesianQualityScore,
  MIN_QUALITY_SCORE,
} from "./bayesianRanking.js";
import { computeCollaborativeScore } from "./collaborativeFiltering.js";
import { computeAvailabilityScore } from "./propertySignals.js";
import {
  computePropertyContentSimilarity,
  computeWeightedContentSimilarity,
  computeAmenityOverlapScore,
  inferPropertyType,
} from "./propertySimilarity.js";
import { enrichMatchReasons } from "./recommendationEnrichment.js";
import { attachRecommendationTransparency } from "./recommendationTransparency.js";
import {
  computeReviewAnalysisScore,
  MIN_REVIEW_ANALYSIS_SCORE,
} from "./reviewSentimentRecommendation.js";

/**
 * =============================================================================
 * Recommendation Engine + Sentiment Feature Integration
 * =============================================================================
 *
 * Key idea:
 *   The sentiment analyzer does NOT recommend properties.
 *   It converts unstructured review text into a structured numerical feature
 *   (ReviewAnalysisScore). That feature becomes ONE input of this engine.
 *
 * Inputs used by the recommendation engine:
 *   1. ReviewAnalysisScore   ← feature from sentiment analyzer output
 *   2. BayesianQuality       ← rating / credibility trust signal
 *   3. PersonalizationScore  ← user_id history layer (when available)
 *
 * Personalized formula:
 *   Score = (ReviewAnalysis × 0.42) + (Bayesian × 0.28) + (Personalization × 0.30)
 *
 * Cold-start formula:
 *   Score = (ReviewAnalysis × 0.55) + (Bayesian × 0.45)
 * =============================================================================
 */

export const RECOMMENDATION_TOTAL = 24;
export const SECTION_LIMIT = 4;

/**
 * Review analysis is one structured numerical FEATURE derived from the
 * sentiment analyzer. It is weighted highly because review text quality is
 * central to this FYP, but ranking decisions are made only by this engine.
 */
export const REVIEW_ANALYSIS_WEIGHT = 0.42;
export const QUALITY_WEIGHT = 0.28;
export const PERSONALIZATION_WEIGHT = 0.3;

/** Cold-start weights when personalization is unavailable. */
export const COLD_START_REVIEW_ANALYSIS_WEIGHT = 0.55;
export const COLD_START_QUALITY_WEIGHT = 0.45;

export const SECTION_IDS = {
  RECENT_SEARCHES: "recent_searches",
  PREVIOUS_BOOKINGS: "previous_bookings",
  PREFERRED_BUDGET: "preferred_budget",
  VIEWED_SIMILAR: "viewed_similar",
  POPULAR_IN_CITY: "popular_in_city",
  RECOMMENDED_FOR_YOU: "recommended_for_you",
};

export const COLD_START_SECTION_IDS = {
  TOP_BAYESIAN: "top_bayesian",
  BEST_REVIEWED: "best_reviewed",
  TRENDING: "trending",
};

const RECENCY_DECAY = [1, 0.72, 0.52, 0.38, 0.28];

const clampScore = (value) => Math.max(0, Math.min(1, value));

/**
 * Computes the hybrid recommendation score from multiple independent inputs.
 *
 * ReviewAnalysisScore is a feature extracted from sentiment analysis —
 * not a recommendation by itself.
 */
export const computeHybridRecommendationScore = ({
  reviewAnalysisScore,
  bayesianQuality,
  personalizationScore = 0,
  isColdStart = false,
  passesTrustFloor = true,
}) => {
  if (!passesTrustFloor) {
    return 0;
  }

  if (isColdStart) {
    return clampScore(
      reviewAnalysisScore * COLD_START_REVIEW_ANALYSIS_WEIGHT +
        bayesianQuality * COLD_START_QUALITY_WEIGHT,
    );
  }

  return clampScore(
    reviewAnalysisScore * REVIEW_ANALYSIS_WEIGHT +
      bayesianQuality * QUALITY_WEIGHT +
      personalizationScore * PERSONALIZATION_WEIGHT,
  );
};

const normalizeCity = (city = "") => city.trim().toLowerCase();

const matchesCity = (property, city) =>
  Boolean(city) &&
  normalizeCity(property.location?.city) === normalizeCity(city);

const parseNumber = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const isWithinBudget = (price, min, max) => {
  if (!price) {
    return false;
  }

  if (min !== null && max !== null) {
    return price >= min && price <= max;
  }

  if (min !== null) {
    return price >= min && price <= min * 1.35;
  }

  if (max !== null) {
    return price <= max && price >= max * 0.65;
  }

  return false;
};

const priceSimilarityScore = (price, target) => {
  if (!price || !target) {
    return 0;
  }

  const difference = Math.abs(price - target) / target;
  if (difference <= 0.12) return 1;
  if (difference <= 0.22) return 0.82;
  if (difference <= 0.35) return 0.62;
  if (difference <= 0.5) return 0.4;
  return Math.max(0, 1 - difference);
};

const computeSentimentQualityScore = (property) => {
  const summary = property.sentimentSummary || {};
  const positivePercent = summary.positivePercent ?? 0;
  const reviewCount = property.reviewCount || summary.totalReviews || 0;

  if (reviewCount === 0) {
    return 0.45;
  }

  const negativeShare = (summary.negativeCount || 0) / reviewCount;
  return clampScore(positivePercent / 100 - negativeShare * 0.35);
};

const computeRatingSentimentBoost = (property) => {
  const summary = property.sentimentSummary || {};
  const avgRating = property.avgRating || summary.averageRating || 0;
  const positivePercent = summary.positivePercent ?? 0;
  const reviewCount = property.reviewCount || summary.totalReviews || 0;
  const sentimentQuality = computeSentimentQualityScore(property);

  if (reviewCount === 0) {
    return 0.42;
  }

  const ratingNorm = Math.min(Math.max(avgRating, 0) / 5, 1);
  return clampScore(ratingNorm * 0.45 + sentimentQuality * 0.55);
};

const computeReviewFavouriteScore = (property, userProfile) => {
  const reviewInteractions = (userProfile.interactions || [])
    .filter((entry) => entry.source === "review" && entry.property)
    .slice(0, 5);

  if (!reviewInteractions.length) {
    const favouriteIds = userProfile.favouritePropertyIds || [];
    if (favouriteIds.includes(property._id.toString())) {
      return 0.75;
    }
    return 0;
  }

  return computeWeightedContentSimilarity(
    property,
    reviewInteractions.map((entry, index) => ({
      ...entry,
      weight: (entry.weight || 0.85) * (RECENCY_DECAY[index] ?? 0.25),
    })),
  );
};

const computeSearchFilterMatchScore = (property, userProfile) => {
  const recentSearches = userProfile.recentSearches?.slice(0, 5) || [];
  if (!recentSearches.length) {
    return 0;
  }

  const propertyTitle = (property.title || "").toLowerCase();
  let best = 0;

  recentSearches.forEach((search, index) => {
    const weight = RECENCY_DECAY[index] ?? 0.2;
    const searchTitle = (search.title || "").trim().toLowerCase();
    const searchCity = (search.city || "").trim().toLowerCase();
    const propertyCity = (property.location?.city || "").trim().toLowerCase();

    let match = 0;
    if (searchTitle && propertyTitle.includes(searchTitle)) {
      match = 0.9;
    } else if (searchTitle && searchTitle.length >= 3) {
      const tokens = searchTitle.split(/\s+/).filter((token) => token.length >= 3);
      const tokenHits = tokens.filter((token) => propertyTitle.includes(token)).length;
      if (tokenHits > 0) {
        match = Math.min(0.75, tokenHits / tokens.length);
      }
    }

    if (searchCity && propertyCity === searchCity) {
      match = Math.max(match, 0.65);
    }

    const searchMin = parseNumber(search.minPrice);
    const searchMax = parseNumber(search.maxPrice);
    if (isWithinBudget(property.price, searchMin, searchMax)) {
      match = Math.max(match, 0.55);
    }

    best = Math.max(best, match * weight);
  });

  return clampScore(best);
};

const computeCombinedQualityScore = (property, context) => {
  const bayesianQuality = computeBayesianQualityScore(property, context);
  const { reviewAnalysisScore } = computeReviewAnalysisScore(property);
  // Combined trust score: review analysis is the dominant half.
  return clampScore(reviewAnalysisScore * 0.58 + bayesianQuality * 0.42);
};

const meetsQualityTrustFloor = (
  combinedQuality,
  bayesianQuality,
  reviewAnalysisScore,
  hasReviewAnalysis,
) => {
  const bayesianOk =
    combinedQuality >= MIN_QUALITY_SCORE &&
    bayesianQuality >= MIN_QUALITY_SCORE * 0.88;

  // When sentiment analysis exists for the property, it must also pass the
  // review-analysis floor. Negative analyzed sentiment blocks ranking.
  if (hasReviewAnalysis) {
    return bayesianOk && reviewAnalysisScore >= MIN_REVIEW_ANALYSIS_SCORE;
  }

  return bayesianOk;
};

const computeRecencyCityScore = (property, cities = []) => {
  if (!cities.length) {
    return 0;
  }

  const propertyCity = normalizeCity(property.location?.city);
  let score = 0;

  cities.forEach((city, index) => {
    if (propertyCity === normalizeCity(city)) {
      score = Math.max(score, RECENCY_DECAY[index] ?? 0.2);
    }
  });

  return score;
};

const computeViewSimilarityScore = (property, userProfile) => {
  const viewInteractions = (userProfile.interactions || [])
    .filter((entry) => entry.source === "view" && entry.property)
    .slice(0, 5);

  if (!viewInteractions.length) {
    return 0;
  }

  const propertyId = property._id.toString();
  let best = 0;

  viewInteractions.forEach((entry, index) => {
    const weight = RECENCY_DECAY[index] ?? 0.2;

    if (entry.propertyId === propertyId) {
      best = Math.max(best, weight * 0.85);
      return;
    }

    const similarity = computePropertyContentSimilarity(property, entry.property);
    best = Math.max(best, similarity * weight);
  });

  return clampScore(best);
};

const computeBookingHistoryScore = (property, userProfile, coOccurrenceMatrix) => {
  const bookingInteractions = (userProfile.interactions || [])
    .filter((entry) => entry.source === "booking" && entry.property)
    .slice(0, 5);

  let score = computeRecencyCityScore(
    property,
    bookingInteractions.map((entry) => entry.property?.location?.city).filter(Boolean),
  );

  if (bookingInteractions.length) {
    const contentScore = computeWeightedContentSimilarity(
      property,
      bookingInteractions.map((entry, index) => ({
        ...entry,
        weight: (entry.weight || 1) * (RECENCY_DECAY[index] ?? 0.25),
      })),
    );
    score = Math.max(score, contentScore);
  }

  const interactionIds = bookingInteractions.map((entry) => entry.propertyId);
  const collaborativeScore = computeCollaborativeScore(
    property._id,
    interactionIds,
    coOccurrenceMatrix,
  );

  return clampScore(score * 0.65 + collaborativeScore * 0.35);
};

/**
 * Answers: "Given what this guest has liked before, which chalets are most similar
 * to those, or most liked by similar guests?"
 */
const computeGuestRelevanceScore = (
  property,
  userProfile,
  context,
  coOccurrenceMatrix,
) => {
  const interactions = (userProfile.interactions || []).slice(0, 8);

  const weightedInteractions = interactions.map((entry, index) => ({
    ...entry,
    weight: (entry.weight || 1) * (RECENCY_DECAY[index] ?? 0.2),
  }));

  const contentRelevance = computeWeightedContentSimilarity(
    property,
    weightedInteractions,
  );

  const interactionIds = interactions.map((entry) => entry.propertyId);
  const collaborativeRelevance = computeCollaborativeScore(
    property._id,
    interactionIds,
    coOccurrenceMatrix,
  );

  const preferenceRelevance = computeHybridPersonalizationScore(
    property,
    userProfile,
    context,
    coOccurrenceMatrix,
  );

  return {
    guestRelevanceScore: clampScore(
      contentRelevance * 0.42 +
        collaborativeRelevance * 0.28 +
        preferenceRelevance * 0.3,
    ),
    contentRelevance: clampScore(contentRelevance),
    collaborativeRelevance: clampScore(collaborativeRelevance),
    preferenceRelevance: clampScore(preferenceRelevance),
  };
};

const computeHybridPersonalizationScore = (
  property,
  userProfile,
  context,
  coOccurrenceMatrix,
) => {
  const latestBookingCity = userProfile.latestBookedCity || "";
  const recentSearchCities = userProfile.recentSearchCities?.slice(0, 5) || [];

  const latestBookingCityScore = matchesCity(property, latestBookingCity) ? 1 : 0;
  const recentSearchCityScore = computeRecencyCityScore(property, recentSearchCities);

  const budgetMin =
    userProfile.latestBudgetMin ??
    context.minPrice ??
    (context.priceFromQuery && context.price ? context.price * 0.8 : null);
  const budgetMax =
    userProfile.latestBudgetMax ??
    context.maxPrice ??
    (context.priceFromQuery && context.price ? context.price * 1.2 : null);

  let priceScore = 0;
  if (budgetMin !== null || budgetMax !== null) {
    priceScore = isWithinBudget(property.price, budgetMin, budgetMax) ? 1 : 0;
  }

  if (priceScore === 0 && userProfile.preferredPrice) {
    priceScore = priceSimilarityScore(property.price, userProfile.preferredPrice);
  }

  const viewScore = computeViewSimilarityScore(property, userProfile);
  const bookingHistoryScore = computeBookingHistoryScore(
    property,
    userProfile,
    coOccurrenceMatrix,
  );
  const reviewFavouriteScore = computeReviewFavouriteScore(property, userProfile);
  const searchFilterScore = computeSearchFilterMatchScore(property, userProfile);

  const propertyType = inferPropertyType(property.title, property.description);
  const typeScore = userProfile.preferredPropertyTypes?.includes(propertyType)
    ? 0.85
    : 0;
  const amenityScore = computeAmenityOverlapScore(
    property.description,
    userProfile.preferredAmenities || [],
  );

  const availabilityScore = computeAvailabilityScore(
    property.availabilityCalendar,
    context.availabilityDate,
  );

  const preferredCity =
    userProfile.preferredCity ||
    latestBookingCity ||
    recentSearchCities[0] ||
    "";
  const preferredCityScore = matchesCity(property, preferredCity) ? 0.9 : 0;

  if (context.cityFromQuery && matchesCity(property, context.city)) {
    return clampScore(
      latestBookingCityScore * 0.2 +
        recentSearchCityScore * 0.16 +
        preferredCityScore * 0.08 +
        priceScore * 0.15 +
        viewScore * 0.11 +
        bookingHistoryScore * 0.1 +
        reviewFavouriteScore * 0.07 +
        searchFilterScore * 0.06 +
        typeScore * 0.03 +
        amenityScore * 0.02 +
        availabilityScore * 0.06 +
        0.06,
    );
  }

  return clampScore(
    latestBookingCityScore * 0.22 +
      recentSearchCityScore * 0.18 +
      preferredCityScore * 0.08 +
      priceScore * 0.15 +
      viewScore * 0.12 +
      bookingHistoryScore * 0.1 +
      reviewFavouriteScore * 0.07 +
      searchFilterScore * 0.05 +
      typeScore * 0.04 +
      amenityScore * 0.03 +
      availabilityScore * 0.04 +
      (context.priceFromQuery ? priceScore * 0.02 : 0),
  );
};

const buildHybridMatchReasons = ({
  property,
  userProfile,
  context,
  combinedQuality,
  personalizationScore,
  bayesianQuality,
  reviewAnalysisScore = 0,
  hasReviewAnalysis = false,
}) => {
  const reasons = [];
  const summary = property.sentimentSummary || {};
  const avgRating = property.avgRating || summary.averageRating || 0;

  // Review-analysis reasons first — sentiment analyzer is the primary signal.
  if (hasReviewAnalysis && reviewAnalysisScore >= 0.7) {
    reasons.push("positive_reviews");
  } else if ((summary.positivePercent || 0) >= 60) {
    reasons.push("positive_reviews");
  }

  if (summary.topPraisedAspect || summary.insightType === "praised") {
    reasons.push("praised_sentiment");
  }

  if (matchesCity(property, userProfile.latestBookedCity)) {
    reasons.push("matches_preferred_city");
  } else if (
    userProfile.recentSearchCities?.some((city) => matchesCity(property, city))
  ) {
    reasons.push("similar_to_recent_searches");
  } else if (
    matchesCity(
      property,
      userProfile.preferredCity ||
        userProfile.latestBookedCity ||
        userProfile.recentSearchCities?.[0],
    )
  ) {
    reasons.push("popular_in_preferred_city");
  } else if (context.cityFromQuery && matchesCity(property, context.city)) {
    reasons.push("matches_preferred_city");
  }

  const budgetMin = userProfile.latestBudgetMin;
  const budgetMax = userProfile.latestBudgetMax;
  const preferredPrice = context.price ?? userProfile.preferredPrice;

  if (
    isWithinBudget(property.price, budgetMin, budgetMax) ||
    (preferredPrice && priceSimilarityScore(property.price, preferredPrice) >= 0.62)
  ) {
    reasons.push("matches_budget");
  }

  const bookingInteractions = (userProfile.interactions || []).filter(
    (entry) => entry.source === "booking",
  );
  const viewInteractions = (userProfile.interactions || []).filter(
    (entry) => entry.source === "view",
  );

  if (
    bookingInteractions.some(
      (entry) =>
        computePropertyContentSimilarity(property, entry.property) >= 0.58,
    )
  ) {
    reasons.push("similar_to_past_stays");
  } else if (
    viewInteractions.some(
      (entry) =>
        entry.propertyId === property._id.toString() ||
        computePropertyContentSimilarity(property, entry.property) >= 0.58,
    )
  ) {
    reasons.push("similar_to_viewed");
  }

  if ((property.collaborativeRelevance || 0) >= 0.35) {
    reasons.push("liked_by_similar_guests");
  }

  if (avgRating >= 4 && (summary.positivePercent ?? 100) >= 50) {
    reasons.push("highly_rated");
  }

  if (bayesianQuality >= 0.72) {
    reasons.push("high_bayesian_quality");
  }

  if (!reasons.length && personalizationScore > 0.35) {
    reasons.push("recommended_for_you");
  }

  if (!reasons.length && combinedQuality >= 0.55) {
    reasons.push("highly_rated");
  }

  return [...new Set(reasons)].slice(0, 4);
};

/**
 * Determines whether the Personalized Recommendation Layer should activate.
 *
 * Requires an authenticated user_id AND sufficient interaction history.
 * Without that relationship the engine cannot personalize and must fall
 * back to Bayesian cold-start ranking (important dissertation design choice).
 */
const hasPersonalHistory = (userProfile, isPersonalized) =>
  Boolean(
    isPersonalized &&
      userProfile.userId &&
      (userProfile.hasSufficientHistory !== false) &&
      ((userProfile.interactions?.length || 0) > 0 ||
        (userProfile.recentSearchCities?.length || 0) > 0 ||
        userProfile.latestBookedCity ||
        (userProfile.favouritePropertyIds?.length || 0) > 0 ||
        (userProfile.viewedCount || 0) >= 2),
  );

const sortRecommendations = (items) =>
  [...items].sort((a, b) => {
    if (b.recommendationScore !== a.recommendationScore) {
      return b.recommendationScore - a.recommendationScore;
    }

    // Tie-break on review analysis first — sentiment is the primary quality signal.
    if ((b.reviewAnalysisScore || 0) !== (a.reviewAnalysisScore || 0)) {
      return (b.reviewAnalysisScore || 0) - (a.reviewAnalysisScore || 0);
    }

    if (b.bayesianQuality !== a.bayesianQuality) {
      return b.bayesianQuality - a.bayesianQuality;
    }

    if (b.combinedQuality !== a.combinedQuality) {
      return b.combinedQuality - a.combinedQuality;
    }

    const bPositive = b.sentimentSummary?.positivePercent || 0;
    const aPositive = a.sentimentSummary?.positivePercent || 0;

    if (bPositive !== aPositive) {
      return bPositive - aPositive;
    }

    return (b.reviewCount || 0) - (a.reviewCount || 0);
  });

/**
 * Scores every eligible approved property for a specific guest (user_id).
 *
 * Pipeline per property:
 *   1. Bayesian quality (trust floor / existing engine)
 *   2. Personalized layer (content + collaborative + preference matching)
 *   3. Hybrid score using QUALITY_WEIGHT + PERSONALIZATION_WEIGHT
 */
export const scoreAllEligibleProperties = ({
  properties,
  userProfile,
  context,
  isPersonalized,
  isAuthenticated = false,
  coOccurrenceMatrix = {},
}) => {
  const excludedIds = new Set(userProfile.excludePropertyIds || []);
  let eligible = properties.filter(
    (property) => !excludedIds.has(property._id.toString()),
  );

  if (eligible.length === 0 && properties.length > 0) {
    eligible = properties;
  }

  const personalized = hasPersonalHistory(userProfile, isPersonalized);
  const isColdStart = !personalized;
  const hasQueryContext = Boolean(
    context.cityFromQuery ||
      context.priceFromQuery ||
      context.availabilityDate,
  );

  return eligible.map((property) => {
    // Feature extraction only: sentiment analyzer output → numerical feature.
    // This does not recommend properties by itself.
    const {
      reviewAnalysisScore,
      hasReviewAnalysis,
      analysis: reviewAnalysis,
      breakdown: reviewAnalysisBreakdown,
    } = computeReviewAnalysisScore(property);

    // Supporting trust signal: Bayesian rating quality.
    const bayesianQuality = computeBayesianQualityScore(property, context);
    const combinedQuality = computeCombinedQualityScore(property, context);

    // Personalized layer from user_id interaction history (when available).
    const {
      guestRelevanceScore,
      contentRelevance,
      collaborativeRelevance,
      preferenceRelevance,
    } = computeGuestRelevanceScore(
      property,
      userProfile,
      context,
      coOccurrenceMatrix,
    );

    const personalizationScore = guestRelevanceScore;
    const passesTrustFloor = meetsQualityTrustFloor(
      combinedQuality,
      bayesianQuality,
      reviewAnalysisScore,
      hasReviewAnalysis,
    );

    let recommendationScore;

    if (personalized) {
      recommendationScore = computeHybridRecommendationScore({
        reviewAnalysisScore,
        bayesianQuality,
        personalizationScore,
        isColdStart: false,
        passesTrustFloor,
      });
    } else if (isAuthenticated && hasQueryContext) {
      // Soft personalization from the current search query only (still gated).
      recommendationScore = passesTrustFloor
        ? computeHybridRecommendationScore({
            reviewAnalysisScore,
            bayesianQuality,
            personalizationScore: Math.max(personalizationScore, 0.2),
            isColdStart: false,
            passesTrustFloor,
          })
        : clampScore(
            reviewAnalysisScore * 0.55 + bayesianQuality * 0.3,
          );
    } else {
      // Cold start: review analysis + Bayesian quality (no personalization).
      recommendationScore = computeHybridRecommendationScore({
        reviewAnalysisScore,
        bayesianQuality,
        personalizationScore: 0,
        isColdStart: true,
        passesTrustFloor: true,
      });
    }

    const matchReasons = buildHybridMatchReasons({
      property: {
        ...property,
        collaborativeRelevance,
      },
      userProfile,
      context,
      combinedQuality,
      personalizationScore,
      bayesianQuality,
      reviewAnalysisScore,
      hasReviewAnalysis,
    });

    // Extra lift when guest prefers positive sentiment and property analysis agrees.
    if (
      personalized &&
      userProfile.preferredSentiment === "positive" &&
      (reviewAnalysis.positivePercent || 0) >= 60
    ) {
      recommendationScore = clampScore(recommendationScore + 0.04);
      if (!matchReasons.includes("positive_reviews")) {
        matchReasons.push("positive_reviews");
      }
    }

    return {
      ...property,
      recommendationScore: Number(recommendationScore.toFixed(4)),
      reviewAnalysisScore: Number(reviewAnalysisScore.toFixed(4)),
      hasReviewAnalysis,
      reviewAnalysisBreakdown,
      bayesianQuality: Number(bayesianQuality.toFixed(4)),
      combinedQuality: Number(combinedQuality.toFixed(4)),
      personalizationScore: Number(personalizationScore.toFixed(4)),
      guestRelevanceScore: Number(guestRelevanceScore.toFixed(4)),
      contentRelevance: Number(contentRelevance.toFixed(4)),
      collaborativeRelevance: Number(collaborativeRelevance.toFixed(4)),
      preferenceRelevance: Number(preferenceRelevance.toFixed(4)),
      passesTrustFloor,
      isColdStart,
      matchReasons,
    };
  });
};

const isPropertyAvailable = (property, context) => {
  const score = computeAvailabilityScore(
    property.availabilityCalendar,
    context.availabilityDate,
  );

  if (context.availabilityDate) {
    return score >= 1;
  }

  return score >= 0.55;
};

const passesQualityFloor = (property) => {
  const reviewOk =
    !property.hasReviewAnalysis ||
    (property.reviewAnalysisScore || 0) >= MIN_REVIEW_ANALYSIS_SCORE;

  return (
    property.passesTrustFloor !== false &&
    property.combinedQuality >= MIN_QUALITY_SCORE &&
    property.bayesianQuality >= MIN_QUALITY_SCORE * 0.88 &&
    reviewOk
  );
};

const mergeSectionReasons = (property, sectionReasons = []) => {
  const merged = [...new Set([...sectionReasons, ...(property.matchReasons || [])])];
  return merged.slice(0, 3);
};

const pickSectionItems = (pool, limit, usedIds, sectionReasons = []) => {
  const picked = [];

  pool.forEach((property) => {
    if (picked.length >= limit) {
      return;
    }

    const propertyId = property._id.toString();
    if (usedIds.has(propertyId)) {
      return;
    }

    usedIds.add(propertyId);
    picked.push({
      ...property,
      matchReasons: mergeSectionReasons(property, sectionReasons),
    });
  });

  return picked;
};

const computeSearchSectionScore = (property, userProfile, context) => {
  const recentSearchCities = userProfile.recentSearchCities?.slice(0, 5) || [];
  const cityScore = computeRecencyCityScore(property, recentSearchCities);

  if (cityScore === 0 && !matchesCity(property, userProfile.latestSearchCity)) {
    return 0;
  }

  const budgetMin = userProfile.latestBudgetMin;
  const budgetMax = userProfile.latestBudgetMax;
  let budgetBoost = 0;

  if (isWithinBudget(property.price, budgetMin, budgetMax)) {
    budgetBoost = 0.25;
  } else if (userProfile.preferredPrice) {
    budgetBoost = priceSimilarityScore(property.price, userProfile.preferredPrice) * 0.2;
  }

  const queryBoost =
    context.cityFromQuery && matchesCity(property, context.city) ? 0.1 : 0;

  return clampScore(
    (cityScore || (matchesCity(property, userProfile.latestSearchCity) ? 0.85 : 0)) *
      0.55 +
      computeSearchFilterMatchScore(property, userProfile) * 0.2 +
      budgetBoost +
      queryBoost +
      property.combinedQuality * 0.25,
  );
};

const computeBookingSectionScore = (property, userProfile, coOccurrenceMatrix) => {
  const bookingScore = computeBookingHistoryScore(
    property,
    userProfile,
    coOccurrenceMatrix,
  );

  if (bookingScore <= 0.15 && !matchesCity(property, userProfile.latestBookedCity)) {
    return 0;
  }

  let typeBoost = 0;
  const propertyType = inferPropertyType(property.title, property.description);
  if (userProfile.preferredPropertyTypes?.includes(propertyType)) {
    typeBoost = 0.12;
  }

  const amenityBoost =
    computeAmenityOverlapScore(
      property.description,
      userProfile.preferredAmenities || [],
    ) * 0.1;

  return clampScore(bookingScore * property.combinedQuality + typeBoost + amenityBoost);
};

const computeViewSectionScore = (property, userProfile) => {
  const viewScore = computeViewSimilarityScore(property, userProfile);

  if (viewScore <= 0.12) {
    return 0;
  }

  return clampScore(viewScore * property.combinedQuality);
};

const computePopularInCityScore = (property, userProfile) => {
  const preferredCity =
    userProfile.preferredCity ||
    userProfile.latestBookedCity ||
    userProfile.recentSearchCities?.[0] ||
    "";

  if (!matchesCity(property, preferredCity)) {
    return 0;
  }

  const summary = property.sentimentSummary || {};
  const positivePercent = summary.positivePercent ?? 0;

  if (positivePercent < 50 && (property.reviewCount || 0) > 0) {
    return 0;
  }

  return clampScore(
    property.bayesianQuality * 0.55 +
      property.combinedQuality * 0.25 +
      positivePercent / 100 * 0.2,
  );
};

const computeBudgetSectionScore = (property, userProfile) => {
  const budgetMin = userProfile.latestBudgetMin;
  const budgetMax = userProfile.latestBudgetMax;

  if (!isWithinBudget(property.price, budgetMin, budgetMax)) {
    if (!userProfile.preferredPrice) {
      return 0;
    }

    const similarity = priceSimilarityScore(property.price, userProfile.preferredPrice);
    if (similarity < 0.62) {
      return 0;
    }

    return clampScore(
      similarity * property.combinedQuality * 0.7 +
        computeRatingSentimentBoost(property) * 0.3,
    );
  }

  return clampScore(
    property.combinedQuality * 0.65 +
      computeRatingSentimentBoost(property) * 0.2 +
      (matchesCity(property, userProfile.preferredCity) ? 0.15 : 0),
  );
};

const computeSectionCompositeScore = (property, sectionMatchScore) =>
  clampScore(
    property.recommendationScore * 0.48 +
      sectionMatchScore * 0.28 +
      property.combinedQuality * 0.14 +
      computeRatingSentimentBoost(property) * 0.1,
  );

const rankSectionCandidates = (pool, getSectionMatch) =>
  [...pool].sort((a, b) => {
    const aScore = computeSectionCompositeScore(a, getSectionMatch(a));
    const bScore = computeSectionCompositeScore(b, getSectionMatch(b));
    return bScore - aScore;
  });

const resolveRankingPool = (availablePool, qualityPool, isPersonalized) => {
  if (qualityPool.length > 0) {
    return qualityPool;
  }

  const scoredPool = availablePool.filter(
    (property) => property.recommendationScore > 0,
  );

  if (scoredPool.length > 0) {
    return scoredPool;
  }

  if (isPersonalized) {
    return sortRecommendations(availablePool);
  }

  return availablePool;
};

export const buildStructuredRecommendations = ({
  properties,
  userProfile,
  context,
  isPersonalized,
  isAuthenticated = false,
  coOccurrenceMatrix = {},
}) => {
  const scored = scoreAllEligibleProperties({
    properties,
    userProfile,
    context,
    isPersonalized,
    isAuthenticated: isAuthenticated || Boolean(userProfile.userId),
    coOccurrenceMatrix,
  });

  const availablePool = scored.filter((property) =>
    isPropertyAvailable(property, context),
  );

  const qualityPool = availablePool.filter(
    (property) =>
      passesQualityFloor(property) && property.recommendationScore > 0,
  );

  const rankingPool = resolveRankingPool(
    availablePool,
    qualityPool,
    isPersonalized,
  );

  const usedIds = new Set();
  const sections = [];

  const hasSearchHistory =
    (userProfile.recentSearchCities?.length || 0) > 0 ||
    Boolean(userProfile.latestSearchCity);

  if (hasSearchHistory) {
    const getSearchMatch = (property) =>
      computeSearchSectionScore(property, userProfile, context);

    const searchPool = rankSectionCandidates(
      rankingPool.filter((property) => getSearchMatch(property) > 0),
      getSearchMatch,
    );

    const items = pickSectionItems(
      searchPool,
      SECTION_LIMIT,
      usedIds,
      ["similar_to_recent_searches", "matches_preferred_city"],
    );

    if (items.length) {
      sections.push({
        id: SECTION_IDS.RECENT_SEARCHES,
        titleKey: "search.recommendationSection.recentSearches",
        items,
      });
    }
  }

  const hasBookingHistory =
    (userProfile.bookedPropertyIds?.length || 0) > 0 ||
    Boolean(userProfile.latestBookedCity);

  if (hasBookingHistory) {
    const getBookingMatch = (property) =>
      computeBookingSectionScore(property, userProfile, coOccurrenceMatrix);

    const bookingPool = rankSectionCandidates(
      rankingPool.filter((property) => getBookingMatch(property) > 0),
      getBookingMatch,
    );

    const items = pickSectionItems(
      bookingPool,
      SECTION_LIMIT,
      usedIds,
      ["similar_to_past_stays", "matches_preferred_city"],
    );

    if (items.length) {
      sections.push({
        id: SECTION_IDS.PREVIOUS_BOOKINGS,
        titleKey: "search.recommendationSection.previousBookings",
        items,
      });
    }
  }

  const hasBudgetSignal =
    userProfile.latestBudgetMin !== null ||
    userProfile.latestBudgetMax !== null ||
    Boolean(userProfile.preferredPrice);

  if (hasBudgetSignal) {
    const getBudgetMatch = (property) =>
      computeBudgetSectionScore(property, userProfile);

    const budgetPool = rankSectionCandidates(
      rankingPool.filter((property) => getBudgetMatch(property) > 0),
      getBudgetMatch,
    );

    const items = pickSectionItems(
      budgetPool,
      SECTION_LIMIT,
      usedIds,
      ["matches_budget"],
    );

    if (items.length) {
      sections.push({
        id: SECTION_IDS.PREFERRED_BUDGET,
        titleKey: "search.recommendationSection.preferredBudget",
        items,
      });
    }
  }

  const hasViewHistory =
    (userProfile.viewedPropertyIds?.length || 0) > 0 ||
    (userProfile.recentViews?.length || 0) > 0;

  if (hasViewHistory) {
    const getViewMatch = (property) =>
      computeViewSectionScore(property, userProfile);

    const viewPool = rankSectionCandidates(
      rankingPool.filter((property) => getViewMatch(property) > 0),
      getViewMatch,
    );

    const items = pickSectionItems(
      viewPool,
      SECTION_LIMIT,
      usedIds,
      ["similar_to_viewed"],
    );

    if (items.length) {
      sections.push({
        id: SECTION_IDS.VIEWED_SIMILAR,
        titleKey: "search.recommendationSection.viewedSimilar",
        items,
      });
    }
  }

  const preferredCity =
    userProfile.preferredCity ||
    userProfile.latestBookedCity ||
    userProfile.recentSearchCities?.[0] ||
    "";

  if (preferredCity) {
    const getCityMatch = (property) =>
      computePopularInCityScore(property, userProfile);

    const cityPool = rankSectionCandidates(
      rankingPool.filter((property) => getCityMatch(property) > 0),
      getCityMatch,
    );

    const items = pickSectionItems(
      cityPool,
      SECTION_LIMIT,
      usedIds,
      ["popular_in_preferred_city", "high_bayesian_quality", "positive_reviews"],
    );

    if (items.length) {
      sections.push({
        id: SECTION_IDS.POPULAR_IN_CITY,
        titleKey: "search.recommendationSection.popularInCity",
        items,
      });
    }
  }

  const hybridPool = sortRecommendations(
    rankingPool.filter((property) => !usedIds.has(property._id.toString())),
  );

  const hybridItems = pickSectionItems(
    hybridPool,
    SECTION_LIMIT,
    usedIds,
    ["recommended_for_you"],
  );

  if (hybridItems.length) {
    sections.push({
      id: SECTION_IDS.RECOMMENDED_FOR_YOU,
      titleKey: "search.recommendationSection.recommendedForYou",
      items: hybridItems,
    });
  }

  const totalCount = sections.reduce(
    (sum, section) => sum + section.items.length,
    0,
  );

  return {
    sections,
    totalCount,
    usedPropertyIds: [...usedIds],
  };
};

export const buildColdStartRecommendations = ({
  properties,
  userProfile,
  context,
  isAuthenticated = false,
  globalBookingCounts = {},
}) => {
  const scored = scoreAllEligibleProperties({
    properties,
    userProfile,
    context,
    isPersonalized: false,
    isAuthenticated: isAuthenticated || Boolean(userProfile.userId),
    coOccurrenceMatrix: {},
  });

  const availablePool = scored.filter((property) =>
    isPropertyAvailable(property, context),
  );

  const qualityPool = availablePool.filter((property) =>
    passesQualityFloor(property),
  );

  const rankingPool = resolveRankingPool(availablePool, qualityPool, false);
  const usedIds = new Set();
  const sections = [];

  const bayesianPool = [...rankingPool].sort(
    (a, b) =>
      (b.reviewAnalysisScore || 0) - (a.reviewAnalysisScore || 0) ||
      b.bayesianQuality - a.bayesianQuality ||
      b.combinedQuality - a.combinedQuality,
  );

  const bayesianItems = pickSectionItems(
    bayesianPool,
    SECTION_LIMIT,
    usedIds,
    ["positive_reviews", "high_bayesian_quality"],
  );

  if (bayesianItems.length) {
    sections.push({
      id: COLD_START_SECTION_IDS.TOP_BAYESIAN,
      titleKey: "search.recommendationSection.topBayesian",
      items: bayesianItems,
    });
  }

  const bestReviewedPool = [...rankingPool].sort((a, b) => {
    const aRating = a.avgRating || 0;
    const bRating = b.avgRating || 0;
    const aPositive = a.sentimentSummary?.positivePercent || 0;
    const bPositive = b.sentimentSummary?.positivePercent || 0;

    if (bRating !== aRating) {
      return bRating - aRating;
    }

    if (bPositive !== aPositive) {
      return bPositive - aPositive;
    }

    return (b.reviewCount || 0) - (a.reviewCount || 0);
  });

  const reviewedItems = pickSectionItems(
    bestReviewedPool.filter(
      (property) => (property.reviewCount || 0) > 0 && (property.avgRating || 0) >= 3.5,
    ),
    SECTION_LIMIT,
    usedIds,
    ["highly_rated", "positive_reviews"],
  );

  if (reviewedItems.length) {
    sections.push({
      id: COLD_START_SECTION_IDS.BEST_REVIEWED,
      titleKey: "search.recommendationSection.bestReviewed",
      items: reviewedItems,
    });
  }

  const trendingPool = [...rankingPool].sort((a, b) => {
    const aBookings = globalBookingCounts[a._id.toString()] || 0;
    const bBookings = globalBookingCounts[b._id.toString()] || 0;

    if (bBookings !== aBookings) {
      return bBookings - aBookings;
    }

    return b.combinedQuality - a.combinedQuality;
  });

  const trendingItems = pickSectionItems(
    trendingPool.filter(
      (property) => (globalBookingCounts[property._id.toString()] || 0) > 0,
    ).length
      ? trendingPool.filter(
          (property) => (globalBookingCounts[property._id.toString()] || 0) > 0,
        )
      : trendingPool,
    SECTION_LIMIT,
    usedIds,
    ["popular_with_guests"],
  );

  if (trendingItems.length) {
    sections.push({
      id: COLD_START_SECTION_IDS.TRENDING,
      titleKey: "search.recommendationSection.trending",
      items: trendingItems,
    });
  }

  const totalCount = sections.reduce(
    (sum, section) => sum + section.items.length,
    0,
  );

  return {
    sections,
    totalCount,
    usedPropertyIds: [...usedIds],
  };
};

export const rankPersonalizedRecommendations = ({
  properties,
  userProfile,
  context,
  isPersonalized,
  globalBookingCounts: _globalBookingCounts = {},
  coOccurrenceMatrix = {},
  limit = RECOMMENDATION_TOTAL,
}) => {
  const scored = scoreAllEligibleProperties({
    properties,
    userProfile,
    context,
    isPersonalized,
    isAuthenticated: Boolean(userProfile.userId),
    coOccurrenceMatrix,
  });

  const seen = new Set();
  const ranked = [];

  sortRecommendations(scored).forEach((property) => {
    if (ranked.length >= limit) {
      return;
    }

    const propertyId = property._id.toString();
    if (seen.has(propertyId)) {
      return;
    }

    seen.add(propertyId);
    ranked.push(property);
  });

  return ranked;
};

/**
 * Finalizes recommendations for API responses.
 * Enriches matchReasons (backward compatible) and attaches transparency
 * metadata required by the research contribution.
 */
export const finalizePersonalizedRecommendations = (
  recommendations,
  { isColdStart = false } = {},
) =>
  recommendations.map((property) => {
    const withReasons = {
      ...property,
      matchReasons: enrichMatchReasons(property, property.matchReasons || []),
    };

    return attachRecommendationTransparency(withReasons, {
      isColdStart: Boolean(property.isColdStart ?? isColdStart),
    });
  });

/**
 * Decides personalized vs cold-start mode for a specific user_id.
 *
 * Cold start is intentional: guests without sufficient interaction history
 * receive the existing Bayesian ranking so personalization is never forced
 * on empty profiles.
 */
export const buildRecommendationMode = (userProfile, isAuthenticated) => {
  const hasViews = (userProfile.viewedCount || 0) > 0;
  const hasBookings = (userProfile.bookedCount || 0) > 0;
  const hasReviews = (userProfile.reviewCount || 0) > 0;
  const hasSearchHistory = (userProfile.recentSearchCities?.length || 0) > 0;
  const hasInteractions = (userProfile.interactions?.length || 0) > 0;
  const hasSufficientHistory =
    userProfile.hasSufficientHistory === true ||
    hasBookings ||
    hasReviews ||
    hasSearchHistory ||
    (userProfile.viewedCount || 0) >= 2 ||
    (userProfile.favouritePropertyIds?.length || 0) > 0;

  if (!isAuthenticated) {
    return {
      personalized: false,
      mode: "bayesian_sentiment_cold_start",
      isColdStart: true,
      trackingEnabled: false,
      userId: null,
      hasSearchHistory: false,
      hasBookings: false,
      hasReviews: false,
      hasViews: false,
      interactionCount: 0,
      preferredCity: "",
      preferredPrice: null,
      preferredSentiment: "neutral",
      bookingFrequency: 0,
      bookedCount: 0,
      avgRatingGiven: null,
      formula: {
        reviewAnalysisWeight: REVIEW_ANALYSIS_WEIGHT,
        qualityWeight: QUALITY_WEIGHT,
        personalizationWeight: PERSONALIZATION_WEIGHT,
        description:
          "Cold start: RecommendationScore = (ReviewAnalysis × 0.55) + (BayesianQuality × 0.45)",
      },
    };
  }

  const personalized = hasSufficientHistory;

  return {
    personalized,
    mode: personalized
      ? "hybrid_personalized"
      : "bayesian_sentiment_cold_start",
    isColdStart: !personalized,
    trackingEnabled: true,
    userId: userProfile.userId || null,
    hasSearchHistory,
    hasBookings,
    hasReviews,
    hasViews,
    hasSufficientHistory,
    interactionCount: userProfile.interactions?.length || 0,
    preferredCity: userProfile.preferredCity || "",
    preferredPrice: userProfile.preferredPrice
      ? Math.round(userProfile.preferredPrice)
      : null,
    preferredSentiment: userProfile.preferredSentiment || "neutral",
    bookingFrequency: userProfile.bookingFrequency || 0,
    bookedCount: userProfile.bookedCount || 0,
    viewedCount: userProfile.viewedCount || 0,
    reviewCount: userProfile.reviewCount || 0,
    avgRatingGiven: userProfile.avgRatingGiven
      ? Number(userProfile.avgRatingGiven.toFixed(1))
      : null,
    relevanceSignals: {
      reviewAnalysisPrimary: true,
      sentimentAnalyzerInput: true,
      contentBased: true,
      collaborativeFiltering: true,
      userPreferenceMatching: true,
      interactionHistoryMatching: true,
      searchHistoryMatching: true,
      bookingHistoryMatching: true,
      viewHistoryMatching: true,
      qualityFloor: "review_analysis_and_bayesian",
    },
    formula: {
      reviewAnalysisWeight: REVIEW_ANALYSIS_WEIGHT,
      qualityWeight: QUALITY_WEIGHT,
      personalizationWeight: PERSONALIZATION_WEIGHT,
      description: personalized
        ? "RecommendationScore = (ReviewAnalysis × 0.42) + (BayesianQuality × 0.28) + (Personalization × 0.30)"
        : "Cold start: RecommendationScore = (ReviewAnalysis × 0.55) + (BayesianQuality × 0.45)",
    },
  };
};
