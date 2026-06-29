import Review from "../models/Review.js";
import {
  aggregateAspectSentiments,
  buildPropertyInsight,
} from "./sentimentAggregation.js";

const SENTIMENT_REASON_KEYS = {
  positive_reviews: "positive_reviews",
  praised_sentiment: "praised_sentiment",
  highly_rated: "highly_rated",
};

export const buildSentimentSummaryForReviews = (reviews = []) => {
  if (!reviews.length) {
    return {
      totalReviews: 0,
      positiveCount: 0,
      negativeCount: 0,
      positivePercent: 0,
      averageRating: null,
      topPraisedAspect: null,
      insightType: "none",
    };
  }

  const positiveCount = reviews.filter(
    (review) => review.sentiment === "positive",
  ).length;
  const negativeCount = reviews.filter(
    (review) => review.sentiment === "negative",
  ).length;
  const averageRating = Number(
    (
      reviews.reduce((sum, review) => sum + (review.rating || 0), 0) /
      reviews.length
    ).toFixed(1),
  );

  const aspectMap = aggregateAspectSentiments(reviews);
  const insight = buildPropertyInsight(reviews, aspectMap);
  const topPraisedAspect = insight.praisedAspects[0]?.aspect || null;

  return {
    totalReviews: reviews.length,
    positiveCount,
    negativeCount,
    positivePercent: Math.round((positiveCount / reviews.length) * 100),
    averageRating,
    topPraisedAspect,
    insightType: insight.insightType,
  };
};

export const attachSentimentSummaries = async (properties = []) => {
  if (!properties.length) {
    return [];
  }

  const ids = properties.map((property) => property._id);
  const reviews = await Review.find({ property: { $in: ids } }).lean();

  const reviewsByProperty = new Map();
  reviews.forEach((review) => {
    const key = review.property.toString();
    if (!reviewsByProperty.has(key)) {
      reviewsByProperty.set(key, []);
    }
    reviewsByProperty.get(key).push(review);
  });

  return properties.map((property) => {
    const propertyReviews =
      reviewsByProperty.get(property._id.toString()) || [];
    const sentimentSummary = buildSentimentSummaryForReviews(propertyReviews);

    return {
      ...property,
      sentimentSummary,
    };
  });
};

const clampScore = (value) => Math.max(0, Math.min(1, value));

const logNorm = (value, cap = 8) =>
  Math.min(Math.log1p(Math.max(0, value)) / Math.log1p(cap), 1);

export const computePropertyQualityScore = (property) => {
  const sentiment = property.sentimentSummary || {};
  const reviewCount = property.reviewCount || sentiment.totalReviews || 0;

  if (reviewCount === 0) {
    return 0.05;
  }

  const avgRating = property.avgRating || sentiment.averageRating || 0;
  const positivePercent = sentiment.positivePercent ?? 0;
  const negativeCount = sentiment.negativeCount || 0;
  const negativeShare = negativeCount / reviewCount;

  const ratingScore = avgRating / 5;
  const sentimentScore = positivePercent / 100;
  const credibility = logNorm(reviewCount);

  let quality =
    ratingScore * 0.3 +
    sentimentScore * 0.5 +
    credibility * 0.2 -
    negativeShare * 0.2;

  if (avgRating >= 4 && positivePercent < 50) {
    quality -= 0.12;
  }

  if (avgRating < 3) {
    quality -= 0.15;
  }

  return clampScore(quality);
};

export const computeRulePersonalizationScore = (property, userProfile, context) => {
  let score = 0;

  const propertyCity = property.location?.city?.trim().toLowerCase() || "";
  const preferredCities = (userProfile.preferredCities || [])
    .map((city) => city?.trim().toLowerCase())
    .filter(Boolean);

  if (context.city && propertyCity === context.city.trim().toLowerCase()) {
    score += 0.28;
  } else if (preferredCities.includes(propertyCity)) {
    score += 0.22;
  }

  const preferredPrice = context.price ?? userProfile.preferredPrice ?? null;

  if (preferredPrice && property.price) {
    const difference =
      Math.abs(property.price - preferredPrice) / preferredPrice;

    if (difference <= 0.15) {
      score += 0.24;
    } else if (difference <= 0.3) {
      score += 0.14;
    } else if (difference <= 0.5) {
      score += 0.06;
    }
  }

  const bookedCities = (userProfile.bookedCities || [])
    .map((city) => city?.trim().toLowerCase())
    .filter(Boolean);

  if (bookedCities.includes(propertyCity)) {
    score += 0.18;
  }

  return clampScore(score);
};

export const computeFinalRecommendationScore = ({
  qualityScore,
  personalizationScore,
  isPersonalized,
}) => {
  if (!isPersonalized) {
    return clampScore(qualityScore * 0.88 + personalizationScore * 0.12);
  }

  return clampScore(qualityScore * 0.62 + personalizationScore * 0.38);
};

export const rankRecommendedProperties = ({
  properties,
  mlRecommendations = [],
  userProfile,
  context,
  isPersonalized,
  limit,
}) => {
  const mlMap = new Map(
    mlRecommendations.map((item) => [item.propertyId, item]),
  );

  const eligible = properties.filter(
    (property) =>
      !userProfile.excludePropertyIds.includes(property._id.toString()),
  );

  return eligible
    .map((property) => {
      const propertyId = property._id.toString();
      const mlItem = mlMap.get(propertyId);
      const personalizationScore =
        mlItem?.score ??
        computeRulePersonalizationScore(property, userProfile, context);
      const qualityScore = computePropertyQualityScore(property);
      const recommendationScore = computeFinalRecommendationScore({
        qualityScore,
        personalizationScore,
        isPersonalized,
      });

      return {
        ...property,
        recommendationScore: Number(recommendationScore.toFixed(4)),
        qualityScore: Number(qualityScore.toFixed(4)),
        matchReasons: mlItem?.matchReasons || [],
      };
    })
    .sort((a, b) => {
      if (b.recommendationScore !== a.recommendationScore) {
        return b.recommendationScore - a.recommendationScore;
      }

      const bPositive = b.sentimentSummary?.positivePercent || 0;
      const aPositive = a.sentimentSummary?.positivePercent || 0;

      if (bPositive !== aPositive) {
        return bPositive - aPositive;
      }

      if ((b.avgRating || 0) !== (a.avgRating || 0)) {
        return (b.avgRating || 0) - (a.avgRating || 0);
      }

      return (b.reviewCount || 0) - (a.reviewCount || 0);
    })
    .slice(0, limit);
};

export const enrichMatchReasons = (property, existingReasons = []) => {
  const reasons = [...existingReasons];
  const summary = property.sentimentSummary;

  const addReason = (key) => {
    if (!reasons.includes(key)) {
      reasons.push(key);
    }
  };

  if (summary?.positivePercent >= 55) {
    reasons.unshift(SENTIMENT_REASON_KEYS.positive_reviews);
  }

  if (summary?.topPraisedAspect) {
    addReason(SENTIMENT_REASON_KEYS.praised_sentiment);
  }

  const avgRating = property.avgRating || summary?.averageRating || 0;

  if (avgRating >= 4 && (summary?.positivePercent ?? 100) >= 50) {
    addReason(SENTIMENT_REASON_KEYS.highly_rated);
  }

  if (!reasons.length) {
    addReason("recommended_for_you");
  }

  return reasons.slice(0, 3);
};

export const buildProfileSignals = (userProfile, isAuthenticated) => {
  if (!isAuthenticated) {
    return {
      personalized: false,
      mode: "popular",
      hasSearchHistory: false,
      hasBookings: false,
      hasReviews: false,
      preferredCity: "",
      preferredPrice: null,
      bookedCount: 0,
      avgRatingGiven: null,
    };
  }

  const hasSearchHistory = (userProfile.preferredCities?.length || 0) > 0;
  const hasBookings = (userProfile.bookedCount || 0) > 0;
  const hasReviews = (userProfile.avgRatingGiven || 0) > 0;
  const hasPersonalData = hasSearchHistory || hasBookings || hasReviews;

  return {
    personalized: hasPersonalData,
    mode: hasPersonalData ? "personalized" : "popular",
    hasSearchHistory,
    hasBookings,
    hasReviews,
    preferredCity: userProfile.preferredCities?.[0] || "",
    preferredPrice: userProfile.preferredPrice
      ? Math.round(userProfile.preferredPrice)
      : null,
    bookedCount: userProfile.bookedCount || 0,
    avgRatingGiven: userProfile.avgRatingGiven
      ? Number(userProfile.avgRatingGiven.toFixed(1))
      : null,
  };
};
