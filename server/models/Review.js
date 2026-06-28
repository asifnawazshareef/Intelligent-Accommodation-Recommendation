import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    guest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    property: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      required: true,
    },
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
      unique: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    sentiment: {
      type: String,
      enum: ["positive", "negative", "neutral", "mixed"],
      default: "neutral",
    },
    sentimentScore: {
      type: Number,
      default: 0,
    },
    aspects: {
      type: [String],
      default: [],
    },
    aspectInsights: {
      type: [
        {
          aspect: { type: String, trim: true },
          sentiment: {
            type: String,
            enum: ["positive", "negative", "neutral", "mixed"],
          },
          confidence: { type: Number, default: 0, min: 0, max: 1 },
          mentions: { type: Number, default: 1, min: 1 },
        },
      ],
      default: [],
    },
    summary: {
      type: String,
      default: "",
    },
  },
  { timestamps: true },
);

reviewSchema.index({ property: 1, createdAt: -1 });

const Review = mongoose.model("Review", reviewSchema);
export default Review;
