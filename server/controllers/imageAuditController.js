import Property from "../models/Property.js";
import { VERIFICATION_STATUSES } from "../utils/imageVerification.js";

export const getImageAuditList = async (req, res, next) => {
  try {
    const { status } = req.query;

    const properties = await Property.find()
      .populate("owner", "name email")
      .sort({ updatedAt: -1 });

    const auditItems = [];

    properties.forEach((property) => {
      property.images.forEach((image) => {
        if (status && image.verificationStatus !== status) {
          return;
        }

        auditItems.push({
          id: `${property._id}:${image._id}`,
          propertyId: property._id,
          imageId: image._id,
          propertyTitle: property.title,
          ownerName: property.owner?.name || "Unknown",
          ownerEmail: property.owner?.email || "",
          url: image.url,
          verificationStatus: image.verificationStatus,
          aiScore: image.aiScore,
          propertyStatus: property.status,
          updatedAt: property.updatedAt,
        });
      });
    });

    res.json({
      success: true,
      count: auditItems.length,
      data: auditItems,
    });
  } catch (error) {
    next(error);
  }
};

export const updateImageAudit = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { verificationStatus, aiScore } = req.body;

    const [propertyId, imageId] = id.split(":");
    if (!propertyId || !imageId) {
      res.status(400);
      throw new Error("Invalid audit item id");
    }

    if (
      verificationStatus &&
      !VERIFICATION_STATUSES.includes(verificationStatus)
    ) {
      res.status(400);
      throw new Error("Invalid verification status");
    }

    if (aiScore !== undefined) {
      const score = Number(aiScore);
      if (Number.isNaN(score) || score < 0 || score > 1) {
        res.status(400);
        throw new Error("AI score must be between 0 and 1");
      }
    }

    if (verificationStatus === undefined && aiScore === undefined) {
      res.status(400);
      throw new Error("Provide verificationStatus or aiScore to update");
    }

    const property = await Property.findById(propertyId);

    if (!property) {
      res.status(404);
      throw new Error("Property not found");
    }

    const image = property.images.id(imageId);

    if (!image) {
      res.status(404);
      throw new Error("Image not found");
    }

    if (verificationStatus) {
      image.verificationStatus = verificationStatus;
    }

    if (aiScore !== undefined) {
      image.aiScore = Number(aiScore);
    }

    await property.save();

    res.json({
      success: true,
      message: "Image audit updated successfully",
      data: {
        id: `${property._id}:${image._id}`,
        propertyId: property._id,
        imageId: image._id,
        propertyTitle: property.title,
        url: image.url,
        verificationStatus: image.verificationStatus,
        aiScore: image.aiScore,
      },
    });
  } catch (error) {
    next(error);
  }
};
