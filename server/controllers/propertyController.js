import Property from "../models/Property.js";
import PropertyView from "../models/PropertyView.js";
import {
  MAX_IMAGES_PER_PROPERTY,
  buildVerifiedImagesFromFiles,
  deleteUploadedImage,
  sanitizePropertyImages,
} from "../utils/imageVerification.js";

const parseJsonField = (value, fallback) => {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  if (typeof value === "object") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const parseMultipartBody = (body) => {
  const location =
    body.location && typeof body.location === "object"
      ? body.location
      : {
          address: body.address,
          city: body.city,
          country: body.country,
        };

  return {
    title: body.title,
    description: body.description,
    price: body.price,
    location,
    availabilityCalendar: parseJsonField(body.availabilityCalendar, []),
    retainedImageIds: parseJsonField(body.retainedImageIds, []),
  };
};

const validateLocation = (location) => {
  if (!location || typeof location !== "object") {
    return "Location is required";
  }

  if (!location.address?.trim()) {
    return "Address is required";
  }

  if (!location.city?.trim()) {
    return "City is required";
  }

  if (!location.country?.trim()) {
    return "Country is required";
  }

  return null;
};

const validatePropertyInput = (body, isUpdate = false) => {
  const { title, description, location, price, availabilityCalendar } = body;

  if (!isUpdate) {
    if (!title?.trim()) return "Title is required";
    if (!description?.trim()) return "Description is required";
    if (price === undefined || price === null || Number.isNaN(Number(price))) {
      return "Price is required";
    }
    if (Number(price) < 0) return "Price cannot be negative";

    const locationError = validateLocation(location);
    if (locationError) return locationError;
  } else {
    if (title !== undefined && !title?.trim()) return "Title cannot be empty";
    if (description !== undefined && !description?.trim()) {
      return "Description cannot be empty";
    }
    if (price !== undefined) {
      if (price === null || Number.isNaN(Number(price))) {
        return "Price must be a valid number";
      }
      if (Number(price) < 0) return "Price cannot be negative";
    }
    if (location !== undefined) {
      const locationError = validateLocation(location);
      if (locationError) return locationError;
    }
  }

  if (
    availabilityCalendar !== undefined &&
    !Array.isArray(availabilityCalendar)
  ) {
    return "Availability calendar must be an array";
  }

  return null;
};

const cleanupUploadedFiles = (files = []) => {
  files.forEach((file) => {
    deleteUploadedImage(`/uploads/properties/${file.filename}`);
  });
};

const mergePropertyImages = async ({
  propertyId,
  previousImages = [],
  retainedImageIds = [],
  uploadedFiles = [],
}) => {
  const retainedSet = new Set(
    Array.isArray(retainedImageIds)
      ? retainedImageIds.map((id) => id.toString())
      : [],
  );

  const retainedImages = previousImages.filter((image) =>
    retainedSet.has(image._id.toString()),
  );

  const removedImages = previousImages.filter(
    (image) => !retainedSet.has(image._id.toString()),
  );

  const newImages = await buildVerifiedImagesFromFiles(
    uploadedFiles,
    propertyId,
  );

  const combined = [...retainedImages, ...newImages];

  if (combined.length > MAX_IMAGES_PER_PROPERTY) {
    const error = new Error(
      `A property can have at most ${MAX_IMAGES_PER_PROPERTY} images.`,
    );
    error.statusCode = 400;
    throw error;
  }

  removedImages.forEach((image) => {
    if (image.url?.startsWith("/uploads/properties/")) {
      deleteUploadedImage(image.url);
    }
  });

  return combined.map((image) => ({
    url: image.url,
    verificationStatus: image.verificationStatus,
    aiScore: image.aiScore,
    hash: image.hash || "",
    uploadedAt: image.uploadedAt || new Date(),
  }));
};

const canViewAllImages = (property, user) => {
  if (!user) {
    return false;
  }

  const ownerId = property.owner._id?.toString() || property.owner.toString();
  return user.role === "admin" || user._id.toString() === ownerId;
};

export const createProperty = async (req, res, next) => {
  try {
    const body = parseMultipartBody(req.body);
    const validationError = validatePropertyInput(body);

    if (validationError) {
      cleanupUploadedFiles(req.files);
      res.status(400);
      throw new Error(validationError);
    }

    const uploadedFiles = req.files || [];

    if (uploadedFiles.length > MAX_IMAGES_PER_PROPERTY) {
      cleanupUploadedFiles(uploadedFiles);
      res.status(400);
      throw new Error(
        `You can upload up to ${MAX_IMAGES_PER_PROPERTY} images per property.`,
      );
    }

    const verifiedImages = await buildVerifiedImagesFromFiles(uploadedFiles);

    const property = await Property.create({
      title: body.title.trim(),
      description: body.description.trim(),
      location: {
        address: body.location.address.trim(),
        city: body.location.city.trim(),
        country: body.location.country.trim(),
      },
      price: Number(body.price),
      owner: req.user._id,
      images: verifiedImages,
      availabilityCalendar: body.availabilityCalendar || [],
      status: "pending",
    });

    res.status(201).json({
      success: true,
      message: "Property created successfully",
      data: property,
    });
  } catch (error) {
    cleanupUploadedFiles(req.files);
    next(error);
  }
};

export const getProperties = async (req, res, next) => {
  try {
    const properties = await Property.find({ status: "approved" })
      .populate("owner", "name email")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: properties.length,
      data: properties.map((property) =>
        sanitizePropertyImages(property, { verifiedOnly: true }),
      ),
    });
  } catch (error) {
    next(error);
  }
};

export const getMyProperties = async (req, res, next) => {
  try {
    const properties = await Property.find({ owner: req.user._id }).sort({
      createdAt: -1,
    });

    res.json({
      success: true,
      count: properties.length,
      data: properties,
    });
  } catch (error) {
    next(error);
  }
};

export const getPropertyById = async (req, res, next) => {
  try {
    const property = await Property.findById(req.params.id).populate(
      "owner",
      "name email",
    );

    if (!property) {
      res.status(404);
      throw new Error("Property not found");
    }

    const includeAllImages = canViewAllImages(property, req.user);
    const payload = sanitizePropertyImages(property, {
      includeRejected: includeAllImages,
      verifiedOnly: property.status === "approved" && !includeAllImages,
    });

    if (property.status === "approved") {
      return res.json({
        success: true,
        data: payload,
      });
    }

    if (!includeAllImages) {
      res.status(404);
      throw new Error("Property not found");
    }

    res.json({
      success: true,
      data: property,
    });
  } catch (error) {
    next(error);
  }
};

export const updateProperty = async (req, res, next) => {
  try {
    const property = await Property.findById(req.params.id);

    if (!property) {
      cleanupUploadedFiles(req.files);
      res.status(404);
      throw new Error("Property not found");
    }

    if (property.owner.toString() !== req.user._id.toString()) {
      cleanupUploadedFiles(req.files);
      res.status(403);
      throw new Error("Not authorized to update this property");
    }

    const body = parseMultipartBody(req.body);
    const validationError = validatePropertyInput(body, true);

    if (validationError) {
      cleanupUploadedFiles(req.files);
      res.status(400);
      throw new Error(validationError);
    }

    if (body.title !== undefined) property.title = body.title.trim();
    if (body.description !== undefined) {
      property.description = body.description.trim();
    }
    if (body.price !== undefined) property.price = Number(body.price);
    if (body.location !== undefined) {
      property.location = {
        address: body.location.address.trim(),
        city: body.location.city.trim(),
        country: body.location.country.trim(),
      };
    }

    const hasImageChanges =
      (req.files && req.files.length > 0) ||
      body.retainedImageIds !== undefined;

    if (hasImageChanges) {
      const retainedImageIds =
        body.retainedImageIds !== undefined
          ? body.retainedImageIds
          : property.images.map((image) => image._id.toString());

      property.images = await mergePropertyImages({
        propertyId: property._id,
        previousImages: property.images,
        retainedImageIds,
        uploadedFiles: req.files || [],
      });
    }

    if (body.availabilityCalendar !== undefined) {
      property.availabilityCalendar = body.availabilityCalendar;
    }

    const updatedProperty = await property.save();

    res.json({
      success: true,
      message: "Property updated successfully",
      data: updatedProperty,
    });
  } catch (error) {
    cleanupUploadedFiles(req.files);
    if (error.statusCode) {
      res.status(error.statusCode);
    }
    next(error);
  }
};

export const moderateProperty = async (req, res, next) => {
  try {
    const { status } = req.body;

    if (!status || !["approved", "rejected"].includes(status)) {
      res.status(400);
      throw new Error("Status must be approved or rejected");
    }

    const property = await Property.findById(req.params.id);

    if (!property) {
      res.status(404);
      throw new Error("Property not found");
    }

    property.status = status;
    const updatedProperty = await property.save();

    res.json({
      success: true,
      message: `Property ${status} successfully`,
      data: updatedProperty,
    });
  } catch (error) {
    next(error);
  }
};

const MAX_PROPERTY_VIEWS_PER_USER = 50;

export const trackPropertyView = async (req, res, next) => {
  try {
    const propertyId = req.params.id;
    const userId = req.user?._id;

    if (!userId) {
      res.status(401);
      throw new Error("Login required to track property views");
    }

    const property = await Property.findOne({
      _id: propertyId,
      status: "approved",
    }).select("_id");

    if (!property) {
      res.status(404);
      throw new Error("Property not found");
    }

    await PropertyView.findOneAndUpdate(
      { user: userId, property: propertyId },
      { viewedAt: new Date() },
      { upsert: true, setDefaultsOnInsert: true },
    );

    const totalViews = await PropertyView.countDocuments({ user: userId });

    if (totalViews > MAX_PROPERTY_VIEWS_PER_USER) {
      const excess = totalViews - MAX_PROPERTY_VIEWS_PER_USER;
      const oldestViews = await PropertyView.find({ user: userId })
        .sort({ viewedAt: 1 })
        .limit(excess)
        .select("_id");

      await PropertyView.deleteMany({
        _id: { $in: oldestViews.map((entry) => entry._id) },
      });
    }

    res.json({ success: true, message: "Property view recorded" });
  } catch (error) {
    next(error);
  }
};
