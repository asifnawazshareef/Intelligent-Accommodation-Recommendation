import Review from "../models/Review.js";
import Property from "../models/Property.js";
import {
  aggregateAspectSentiments,
  buildAspectBreakdown,
  buildPropertyInsight,
} from "./sentimentAggregation.js";

export const buildPropertySentimentSnapshot = (reviews = []) => {
  if (!reviews.length) {
    return {
      totalReviews: 0,
      positiveCount: 0,
      negativeCount: 0,
      neutralCount: 0,
      mixedCount: 0,
      positivePercent: 0,
      averageRating: 0,
      aspectBreakdown: [],
      praisedAspects: [],
      concernAspects: [],
      insightType: "none",
      topPraisedAspect: null,
      updatedAt: new Date(),
    };
  }

  const positiveCount = reviews.filter((r) => r.sentiment === "positive").length;
  const negativeCount = reviews.filter((r) => r.sentiment === "negative").length;
  const neutralCount = reviews.filter((r) => r.sentiment === "neutral").length;
  const mixedCount = reviews.filter((r) => r.sentiment === "mixed").length;
  const averageRating = Number(
    (
      reviews.reduce((sum, review) => sum + (review.rating || 0), 0) /
      reviews.length
    ).toFixed(1),
  );

  const aspectMap = aggregateAspectSentiments(reviews);
  const aspectBreakdown = buildAspectBreakdown(aspectMap);
  const insight = buildPropertyInsight(reviews, aspectMap);

  return {
    totalReviews: reviews.length,
    positiveCount,
    negativeCount,
    neutralCount,
    mixedCount,
    positivePercent: Math.round((positiveCount / reviews.length) * 100),
    averageRating,
    aspectBreakdown,
    praisedAspects: insight.praisedAspects,
    concernAspects: insight.concernAspects,
    insightType: insight.insightType,
    topPraisedAspect: insight.praisedAspects[0]?.aspect || null,
    updatedAt: new Date(),
  };
};

export const syncPropertySentiment = async (propertyId) => {
  const reviews = await Review.find({ property: propertyId }).lean();
  const sentimentSnapshot = buildPropertySentimentSnapshot(reviews);

  await Property.findByIdAndUpdate(propertyId, { sentimentSnapshot });
  return sentimentSnapshot;
};

export const snapshotToSummary = (snapshot) => {
  if (!snapshot || !snapshot.totalReviews) {
    return null;
  }

  return {
    totalReviews: snapshot.totalReviews,
    positiveCount: snapshot.positiveCount,
    negativeCount: snapshot.negativeCount,
    positivePercent: snapshot.positivePercent,
    averageRating: snapshot.averageRating,
    topPraisedAspect: snapshot.topPraisedAspect,
    insightType: snapshot.insightType,
  };
};
