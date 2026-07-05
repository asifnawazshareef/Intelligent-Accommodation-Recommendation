export const normalizeAspectInsights = (review) => {
  if (Array.isArray(review?.aspectInsights) && review.aspectInsights.length) {
    return review.aspectInsights;
  }

  return (review?.aspects || []).map((aspect) => ({
    aspect,
    sentiment: review?.sentiment || "neutral",
  }));
};
