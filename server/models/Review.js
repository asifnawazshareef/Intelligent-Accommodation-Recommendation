import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    property: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      required: true,
    },
    guestName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comment: {
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
    summary: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

const Review = mongoose.model("Review", reviewSchema);
export default Review;
