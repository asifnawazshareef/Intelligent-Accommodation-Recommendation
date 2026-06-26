import mongoose from "mongoose";
import Review from "../models/Review.js";
import Property from "../models/Property.js";
import { analyzeSentiment } from "../services/sentimentService.js";

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const updatePropertyRating = async (propertyId) => {
  const result = await Review.aggregate([
    { $match: { property: new mongoose.Types.ObjectId(propertyId) } },
    {
      $group: {
        _id: "$property",
        averageRating: { $avg: "$rating" },
        reviewCount: { $sum: 1 },
      },
    },
  ]);

  const stats = result[0];

  await Property.findByIdAndUpdate(propertyId, {
    averageRating: stats ? Number(stats.averageRating.toFixed(1)) : 0,
    reviewCount: stats ? stats.reviewCount : 0,
  });
};

export const createReview = async (req, res) => {
  try {
    const { propertyId, guestName, rating, comment } = req.body;

    if (!propertyId || !isValidObjectId(propertyId)) {
      return res.status(400).json({ success: false, message: "Valid propertyId is required." });
    }

    if (!guestName || !rating || !comment) {
      return res.status(400).json({ success: false, message: "guestName, rating and comment are required." });
    }

    const property = await Property.findById(propertyId);
    if (!property) {
      return res.status(404).json({ success: false, message: "Property not found." });
    }

    const sentimentResult = await analyzeSentiment(comment);

    const review = await Review.create({
      property: propertyId,
      guestName,
      rating: Number(rating),
      comment,
      sentiment: sentimentResult.sentiment,
      sentimentScore: sentimentResult.confidence,
      aspects: sentimentResult.aspects,
      summary: sentimentResult.summary,
    });

    await updatePropertyRating(propertyId);

    return res.status(201).json({
      success: true,
      message: "Review submitted and analyzed successfully.",
      data: review,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getPropertyReviews = async (req, res) => {
  try {
    const { propertyId } = req.params;

    if (!isValidObjectId(propertyId)) {
      return res.status(400).json({ success: false, message: "Valid propertyId is required." });
    }

    const reviews = await Review.find({ property: propertyId }).sort({ createdAt: -1 });

    return res.json({ success: true, count: reviews.length, data: reviews });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
