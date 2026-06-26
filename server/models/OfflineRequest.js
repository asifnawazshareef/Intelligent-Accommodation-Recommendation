import mongoose from "mongoose";

const offlineRequestSchema = new mongoose.Schema(
  {
    guestName: {
      type: String,
      required: [true, "Guest name is required"],
      trim: true,
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true,
    },
    location: {
      type: String,
      required: [true, "Location is required"],
      trim: true,
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
    roomType: {
      type: String,
      required: [true, "Room type is required"],
      trim: true,
    },
    property: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      default: null,
    },
    responseMessage: {
      type: String,
      trim: true,
      default: "",
    },
    status: {
      type: String,
      enum: ["pending", "responded", "closed"],
      default: "pending",
    },
  },
  {
    timestamps: true,
  },
);

const OfflineRequest = mongoose.model("OfflineRequest", offlineRequestSchema);

export default OfflineRequest;
