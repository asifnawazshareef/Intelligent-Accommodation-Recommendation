const AMENITY_KEYWORDS = [
  "wifi",
  "wi-fi",
  "internet",
  "parking",
  "pool",
  "breakfast",
  "kitchen",
  "ac",
  "air condition",
  "heater",
  "elevator",
  "lift",
  "restaurant",
  "gym",
  "spa",
  "balcony",
  "garden",
  "laundry",
];

export const computeAmenityScore = (description = "") => {
  const lower = description.toLowerCase();
  const matches = AMENITY_KEYWORDS.filter((keyword) => lower.includes(keyword));
  return Math.min(matches.length / 5, 1);
};

export const computeAvailabilityScore = (
  availabilityCalendar = [],
  targetDate = null,
) => {
  if (!Array.isArray(availabilityCalendar) || availabilityCalendar.length === 0) {
    return 0.15;
  }

  const today = new Date().toISOString().slice(0, 10);
  const checkDate = targetDate || today;

  const coversTarget = availabilityCalendar.some(
    (range) => range.startDate <= checkDate && range.endDate >= checkDate,
  );

  if (coversTarget) {
    return 1;
  }

  const hasFutureWindow = availabilityCalendar.some(
    (range) => range.endDate >= today,
  );

  return hasFutureWindow ? 0.55 : 0.25;
};

export const computeAspectSatisfaction = (sentimentSnapshot = null) => {
  if (!sentimentSnapshot?.aspectBreakdown?.length) {
    return 0.5;
  }

  let positiveMentions = 0;
  let negativeMentions = 0;

  sentimentSnapshot.aspectBreakdown.forEach((entry) => {
    positiveMentions += entry.positive || 0;
    negativeMentions += entry.negative || 0;
  });

  const total = positiveMentions + negativeMentions;

  if (total === 0) {
    return 0.5;
  }

  return positiveMentions / total;
};

export const buildRecommendationSignals = (property, context = {}) => {
  const snapshot = property.sentimentSnapshot || {};
  const totalReviews = snapshot.totalReviews || property.reviewCount || 0;

  const positivePercent =
    snapshot.positivePercent ??
    property.sentimentSummary?.positivePercent ??
    0;

  const negativePercent =
    totalReviews > 0
      ? Math.round(
          ((snapshot.negativeCount || 0) / totalReviews) * 100,
        )
      : 0;

  return {
    positivePercent,
    negativePercent,
    aspectSatisfaction: computeAspectSatisfaction(snapshot),
    availabilityScore: computeAvailabilityScore(
      property.availabilityCalendar,
      context.availabilityDate,
    ),
    amenityScore: computeAmenityScore(property.description),
  };
};
