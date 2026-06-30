import mongoose from "mongoose";
import Review from "../models/Review.js";
import Booking from "../models/Booking.js";
import Property from "../models/Property.js";
import { analyzeSentiment } from "../services/sentimentService.js";
import { syncPropertySentiment } from "../utils/propertySentimentStore.js";

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

export const createReview = async (req, res) => {
  try {
    const { property, booking, rating, text } = req.body;

    if (!property || !isValidObjectId(property)) {
      return res.status(400).json({ success: false, message: "Valid property is required." });
    }

    if (!booking || !isValidObjectId(booking)) {
      return res.status(400).json({ success: false, message: "Valid booking is required." });
    }

    if (!rating || Number(rating) < 1 || Number(rating) > 5) {
      return res.status(400).json({ success: false, message: "Rating must be between 1 and 5." });
    }

    if (!text?.trim()) {
      return res.status(400).json({ success: false, message: "Review text is required." });
    }

    const trimmedText = text.trim();

    if (trimmedText.length > 1000) {
      return res.status(400).json({ success: false, message: "Review text cannot exceed 1000 characters." });
    }

    const propertyDoc = await Property.findById(property);
    if (!propertyDoc) {
      return res.status(404).json({ success: false, message: "Property not found." });
    }

    const bookingDoc = await Booking.findById(booking);
    if (!bookingDoc) {
      return res.status(404).json({ success: false, message: "Booking not found." });
    }

    if (bookingDoc.guest.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "You can only review your own bookings." });
    }

    if (bookingDoc.property.toString() !== property) {
      return res.status(400).json({ success: false, message: "Booking does not belong to this property." });
    }

    if (bookingDoc.status !== "confirmed") {
      return res.status(400).json({
        success: false,
        message: "Reviews are only allowed after booking is confirmed.",
      });
    }

    const existingReview = await Review.findOne({ booking });
    if (existingReview) {
      return res.status(400).json({ success: false, message: "A review already exists for this booking." });
    }

    const sentimentResult = await analyzeSentiment(trimmedText);

    const aspectInsights =
      sentimentResult.aspectInsights?.length > 0
        ? sentimentResult.aspectInsights
        : (sentimentResult.aspects || []).map((aspect) => ({
            aspect,
            sentiment: sentimentResult.sentiment,
            confidence: sentimentResult.confidence,
            mentions: 1,
          }));

    const review = await Review.create({
      guest: req.user._id,
      property,
      booking,
      rating: Number(rating),
      text: trimmedText,
      sentiment: sentimentResult.sentiment,
      sentimentScore: sentimentResult.confidence,
      aspects: sentimentResult.aspects,
      aspectInsights,
      summary: sentimentResult.summary,
    });

    await syncPropertySentiment(property);

    const populatedReview = await Review.findById(review._id)
      .populate("guest", "name")
      .populate("booking", "startDate endDate");

    return res.status(201).json({
      success: true,
      message: "Review submitted and analyzed successfully.",
      data: populatedReview,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: "A review already exists for this booking." });
    }

    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getPropertyReviews = async (req, res) => {
  try {
    const { propertyId } = req.params;

    if (!isValidObjectId(propertyId)) {
      return res.status(400).json({ success: false, message: "Valid propertyId is required." });
    }

    const reviews = await Review.find({ property: propertyId })
      .populate("guest", "name")
      .sort({ createdAt: -1 });

    return res.json({ success: true, count: reviews.length, data: reviews });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getEligibleBookings = async (req, res) => {
  try {
    const { propertyId } = req.params;

    if (!isValidObjectId(propertyId)) {
      return res.status(400).json({ success: false, message: "Valid propertyId is required." });
    }

    const confirmedBookings = await Booking.find({
      guest: req.user._id,
      property: propertyId,
      status: "confirmed",
    }).sort({ createdAt: -1 });

    const reviewedBookingIds = await Review.find({
      guest: req.user._id,
      property: propertyId,
    }).distinct("booking");

    const reviewedSet = new Set(reviewedBookingIds.map((id) => id.toString()));

    const eligible = confirmedBookings.filter(
      (booking) => !reviewedSet.has(booking._id.toString()),
    );

    return res.json({
      success: true,
      count: eligible.length,
      data: eligible.map((booking) => ({
        _id: booking._id.toString(),
        startDate: booking.startDate,
        endDate: booking.endDate,
        guests: booking.guests,
        status: booking.status,
        paymentStatus: booking.paymentStatus,
        createdAt: booking.createdAt,
      })),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
