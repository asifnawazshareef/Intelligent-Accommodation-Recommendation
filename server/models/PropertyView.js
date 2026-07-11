import mongoose from "mongoose";

const propertyViewSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    property: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Property",
      required: true,
      index: true,
    },
    viewedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

propertyViewSchema.index({ user: 1, property: 1 }, { unique: true });
propertyViewSchema.index({ user: 1, viewedAt: -1 });

const PropertyView = mongoose.model("PropertyView", propertyViewSchema);

export default PropertyView;
