import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema(
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
    startDate: {
      type: String,
      required: [true, "Start date is required"],
      trim: true,
    },
    endDate: {
      type: String,
      required: [true, "End date is required"],
      trim: true,
    },
    guests: {
      type: Number,
      required: [true, "Number of guests is required"],
      min: [1, "At least one guest is required"],
    },
    totalAmount: {
      type: Number,
      required: [true, "Total amount is required"],
      min: [0, "Total amount cannot be negative"],
    },
    status: {
      type: String,
      enum: ["pending", "confirmed", "cancelled"],
      default: "pending",
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "confirmed", "failed"],
      default: "pending",
    },
    paymentMethod: {
      type: String,
      enum: ["demo", "stripe_test"],
      default: null,
    },
    stripeSessionId: {
      type: String,
      default: null,
      trim: true,
    },
    stripePaymentIntentId: {
      type: String,
      default: null,
      trim: true,
    },
    paymentConfirmedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

const Booking = mongoose.model("Booking", bookingSchema);

export default Booking;
