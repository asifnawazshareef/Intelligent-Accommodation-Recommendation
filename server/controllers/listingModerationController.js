import Property from "../models/Property.js";
import {
  hasVerifiedImage,
  refreshPendingImageScores,
  summarizeImageVerification,
} from "../utils/imageVerification.js";

export const getPendingListings = async (req, res, next) => {
  try {
    const properties = await Property.find({ status: "pending" })
      .populate("owner", "name email")
      .sort({ createdAt: -1 });

    for (const property of properties) {
      await refreshPendingImageScores(property);
    }

    res.json({
      success: true,
      count: properties.length,
      data: properties.map((property) => {
        const plain = property.toObject();
        return {
          ...plain,
          imageSummary: summarizeImageVerification(plain.images || []),
        };
      }),
    });
  } catch (error) {
    next(error);
  }
};

export const approveListing = async (req, res, next) => {
  try {
    const property = await Property.findById(req.params.id);

    if (!property) {
      res.status(404);
      throw new Error("Property not found");
    }

    if (property.status !== "pending") {
      res.status(400);
      throw new Error("Only pending listings can be approved");
    }

    if (!hasVerifiedImage(property.images)) {
      res.status(400);
      throw new Error(
        "At least one verified image is required before approving this property.",
      );
    }

    property.status = "approved";
    await property.save();

    const updatedProperty = await Property.findById(property._id).populate(
      "owner",
      "name email",
    );

    res.json({
      success: true,
      message: "Property approved successfully",
      data: {
        ...updatedProperty.toObject(),
        imageSummary: summarizeImageVerification(updatedProperty.images || []),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const rejectListing = async (req, res, next) => {
  try {
    const property = await Property.findById(req.params.id);

    if (!property) {
      res.status(404);
      throw new Error("Property not found");
    }

    if (property.status !== "pending") {
      res.status(400);
      throw new Error("Only pending listings can be rejected");
    }

    property.status = "rejected";
    await property.save();

    const updatedProperty = await Property.findById(property._id).populate(
      "owner",
      "name email",
    );

    res.json({
      success: true,
      message: "Property rejected successfully",
      data: {
        ...updatedProperty.toObject(),
        imageSummary: summarizeImageVerification(updatedProperty.images || []),
      },
    });
  } catch (error) {
    next(error);
  }
};
