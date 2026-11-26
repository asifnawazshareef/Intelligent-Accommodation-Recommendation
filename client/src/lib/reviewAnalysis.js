export function isPendingReviewAnalysis(review) {
  return review.sentimentAnalysis?.status === "pending" ||
    (!review.sentimentAnalysis && !review.sentimentScore &&
      ["Synthetic demo feedback. Not a model prediction.", "Sentiment service unavailable"].includes(review.summary));
}
