import mongoose from "mongoose";
import Review from "../models/Review.js";

const countAspects = (reviews) => {
  const counts = {};

  reviews.forEach((review) => {
    review.aspects.forEach((aspect) => {
      counts[aspect] = (counts[aspect] || 0) + 1;
    });
  });

  return counts;
};

export const getPropertySentimentSummary = async (req, res) => {
  try {
    const { propertyId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(propertyId)) {
      return res.status(400).json({ success: false, message: "Valid propertyId is required." });
    }

    const reviews = await Review.find({ property: propertyId }).sort({ createdAt: -1 });

    const totalReviews = reviews.length;
    const positiveCount = reviews.filter((review) => review.sentiment === "positive").length;
    const negativeCount = reviews.filter((review) => review.sentiment === "negative").length;
    const neutralCount = reviews.filter((review) => review.sentiment === "neutral").length;
    const mixedCount = reviews.filter((review) => review.sentiment === "mixed").length;
    const averageRating = totalReviews
      ? Number((reviews.reduce((sum, review) => sum + review.rating, 0) / totalReviews).toFixed(1))
      : 0;

    return res.json({
      success: true,
      data: {
        totalReviews,
        positiveCount,
        negativeCount,
        neutralCount,
        mixedCount,
        averageRating,
        aspectCounts: countAspects(reviews),
        recentReviews: reviews.slice(0, 5),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
