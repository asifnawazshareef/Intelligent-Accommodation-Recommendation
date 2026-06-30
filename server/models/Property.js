import mongoose from "mongoose";

const imageMetaSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: [true, "Image URL is required"],
      trim: true,
    },
    verificationStatus: {
      type: String,
      enum: ["pending", "verified", "suspicious", "rejected"],
      default: "pending",
      trim: true,
    },
    aiScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 1,
    },
    hash: {
      type: String,
      default: "",
      trim: true,
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true },
);

const locationSchema = new mongoose.Schema(
  {
    address: {
      type: String,
      required: [true, "Address is required"],
      trim: true,
    },
    city: {
      type: String,
      required: [true, "City is required"],
      trim: true,
    },
    country: {
      type: String,
      required: [true, "Country is required"],
      trim: true,
    },
  },
  { _id: false },
);

const propertySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
    },
    description: {
      type: String,
      required: [true, "Description is required"],
      trim: true,
    },
    location: {
      type: locationSchema,
      required: [true, "Location is required"],
    },
    price: {
      type: Number,
      required: [true, "Price is required"],
      min: [0, "Price cannot be negative"],
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    images: {
      type: [imageMetaSchema],
      default: [],
    },
    availabilityCalendar: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    sentimentSnapshot: {
      totalReviews: { type: Number, default: 0 },
      positiveCount: { type: Number, default: 0 },
      negativeCount: { type: Number, default: 0 },
      neutralCount: { type: Number, default: 0 },
      mixedCount: { type: Number, default: 0 },
      positivePercent: { type: Number, default: 0 },
      averageRating: { type: Number, default: 0 },
      aspectBreakdown: {
        type: [
          {
            aspect: String,
            positive: Number,
            negative: Number,
            neutral: Number,
            mixed: Number,
            total: Number,
            dominantSentiment: String,
          },
        ],
        default: [],
      },
      praisedAspects: {
        type: [{ aspect: String, count: Number, total: Number }],
        default: [],
      },
      concernAspects: {
        type: [{ aspect: String, count: Number, total: Number }],
        default: [],
      },
      insightType: { type: String, default: "none" },
      topPraisedAspect: { type: String, default: null },
      updatedAt: { type: Date, default: null },
    },
  },
  {
    timestamps: true,
  },
);

const Property = mongoose.model("Property", propertySchema);

export default Property;
