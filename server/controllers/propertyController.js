import Property from "../models/Property.js";
import { buildVerifiedImages } from "../utils/imageVerification.js";

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

const validateImages = (images) => {
  if (images === undefined) {
    return null;
  }

  if (!Array.isArray(images)) {
    return "Images must be an array";
  }

  for (const image of images) {
    if (!image?.url?.trim()) {
      return "Each image must include a URL";
    }
  }

  return null;
};

const validatePropertyInput = (body, isUpdate = false) => {
  const { title, description, location, price, images, availabilityCalendar } =
    body;

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

  const imagesError = validateImages(images);
  if (imagesError) return imagesError;

  if (
    availabilityCalendar !== undefined &&
    !Array.isArray(availabilityCalendar)
  ) {
    return "Availability calendar must be an array";
  }

  return null;
};

export const createProperty = async (req, res, next) => {
  try {
    const validationError = validatePropertyInput(req.body);

    if (validationError) {
      res.status(400);
      throw new Error(validationError);
    }

    const { title, description, location, price, images, availabilityCalendar } =
      req.body;

    const verifiedImages = await buildVerifiedImages(images || []);

    const property = await Property.create({
      title: title.trim(),
      description: description.trim(),
      location: {
        address: location.address.trim(),
        city: location.city.trim(),
        country: location.country.trim(),
      },
      price: Number(price),
      owner: req.user._id,
      images: verifiedImages,
      availabilityCalendar: availabilityCalendar || [],
      status: "pending",
    });

    res.status(201).json({
      success: true,
      message: "Property created successfully",
      data: property,
    });
  } catch (error) {
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
      data: properties,
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

    if (property.status === "approved") {
      return res.json({
        success: true,
        data: property,
      });
    }

    const ownerId = property.owner._id?.toString() || property.owner.toString();
    const isOwner = req.user && req.user._id.toString() === ownerId;
    const isAdmin = req.user && req.user.role === "admin";

    if (!isOwner && !isAdmin) {
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
      res.status(404);
      throw new Error("Property not found");
    }

    if (property.owner.toString() !== req.user._id.toString()) {
      res.status(403);
      throw new Error("Not authorized to update this property");
    }

    const validationError = validatePropertyInput(req.body, true);

    if (validationError) {
      res.status(400);
      throw new Error(validationError);
    }

    const { title, description, location, price, images, availabilityCalendar } =
      req.body;

    if (title !== undefined) property.title = title.trim();
    if (description !== undefined) property.description = description.trim();
    if (price !== undefined) property.price = Number(price);
    if (location !== undefined) {
      property.location = {
        address: location.address.trim(),
        city: location.city.trim(),
        country: location.country.trim(),
      };
    }
    if (images !== undefined) {
      property.images = await buildVerifiedImages(
        images,
        property._id,
        property.images,
      );
    }
    if (availabilityCalendar !== undefined) {
      property.availabilityCalendar = availabilityCalendar;
    }

    const updatedProperty = await property.save();

    res.json({
      success: true,
      message: "Property updated successfully",
      data: updatedProperty,
    });
  } catch (error) {
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
