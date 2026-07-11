/**
 * Recommendation transparency helpers.
 *
 * These functions turn internal match-reason keys into human-readable
 * matchedSignals and a single recommendationReason sentence. They do not
 * change ranking — they only explain why a property was recommended.
 */

const SIGNAL_LABELS = {
  matches_preferred_city: "Preferred City",
  popular_in_preferred_city: "Preferred City",
  matches_budget: "Budget Match",
  within_last_budget: "Budget Match",
  similar_to_past_stays: "Booking History",
  similar_to_booked: "Booking History",
  similar_to_viewed: "View History",
  similar_to_recent_searches: "Search History",
  from_recent_history: "Interaction History",
  from_booking_city_search: "Booking History",
  from_latest_search_city: "Search History",
  from_latest_booking_city: "Booking History",
  liked_by_similar_guests: "Similar Guests",
  popular_with_guests: "Frequently Booked",
  positive_reviews: "Positive Reviews",
  praised_sentiment: "Positive Sentiment",
  highly_rated: "High Ratings",
  high_bayesian_quality: "High Bayesian Quality",
  good_amenities: "Amenity Match",
  available_for_dates: "Availability",
  matches_your_taste: "User Preference Match",
  recommended_for_you: "Personalized Match",
};

const REASON_SENTENCES = {
  matches_preferred_city: "Located in your preferred city",
  popular_in_preferred_city: "Popular in your preferred city",
  matches_budget: "Matches your preferred budget",
  within_last_budget: "Matches your preferred budget",
  similar_to_past_stays: "Similar to your previous bookings",
  similar_to_booked: "Similar to your previous bookings",
  similar_to_viewed: "Similar to properties you viewed",
  similar_to_recent_searches: "Matches your recent searches",
  liked_by_similar_guests: "Frequently booked by similar guests",
  popular_with_guests: "Frequently booked by similar guests",
  positive_reviews: "Positive guest sentiment",
  praised_sentiment: "Positive guest sentiment",
  highly_rated: "Highly rated by guests",
  high_bayesian_quality: "High Bayesian quality",
  good_amenities: "Matches your preferred amenities",
  available_for_dates: "Available for your dates",
  matches_your_taste: "Matches your past preferences",
  recommended_for_you: "Recommended for you",
};

/**
 * Maps internal reason keys to unique human-readable signal labels.
 */
export const buildMatchedSignals = (matchReasons = []) => {
  const signals = [];

  matchReasons.forEach((reason) => {
    const label = SIGNAL_LABELS[reason];
    if (label && !signals.includes(label)) {
      signals.push(label);
    }
  });

  return signals;
};

/**
 * Builds a short dynamic explanation from the strongest match reasons.
 * Example: "Recommended because similar to your previous bookings and
 * matches your preferred budget."
 */
export const buildRecommendationReason = (matchReasons = [], isColdStart = false) => {
  if (isColdStart) {
    const coldSignals = matchReasons
      .map((reason) => REASON_SENTENCES[reason])
      .filter(Boolean)
      .slice(0, 2);

    if (!coldSignals.length) {
      return "Recommended because of high Bayesian quality";
    }

    return `Recommended because ${coldSignals.join(" and ")}`;
  }

  const sentences = matchReasons
    .map((reason) => REASON_SENTENCES[reason])
    .filter(Boolean)
    .slice(0, 3);

  if (!sentences.length) {
    return "Recommended because it matches your preference profile";
  }

  if (sentences.length === 1) {
    return `Recommended because ${sentences[0].toLowerCase()}`;
  }

  const head = sentences.slice(0, -1).map((s) => s.toLowerCase());
  const tail = sentences[sentences.length - 1].toLowerCase();
  return `Recommended because ${head.join(", ")} and ${tail}`;
};

/**
 * Attaches transparency metadata expected by the research contribution.
 * Preserves existing matchReasons for the frontend.
 */
export const attachRecommendationTransparency = (
  property,
  { isColdStart = false } = {},
) => {
  const matchReasons = Array.isArray(property.matchReasons)
    ? property.matchReasons
    : [];
  const matchedSignals = buildMatchedSignals(matchReasons);
  const recommendationReason = buildRecommendationReason(
    matchReasons,
    isColdStart,
  );

  return {
    ...property,
    matchedSignals,
    recommendationReason,
    isColdStart: Boolean(isColdStart),
    recommendationScore: property.recommendationScore ?? 0,
    reviewAnalysisScore: property.reviewAnalysisScore ?? 0,
    bayesianQuality: property.bayesianQuality ?? 0,
    personalizationScore: property.personalizationScore ?? 0,
  };
};
