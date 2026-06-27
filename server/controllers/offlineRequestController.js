import mongoose from "mongoose";
import OfflineRequest from "../models/OfflineRequest.js";
import Property from "../models/Property.js";

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const serializeOfflineRequest = (request) => ({
  ...request,
  _id: request._id.toString(),
  property: request.property
    ? {
        ...request.property,
        _id: request.property._id?.toString(),
      }
    : null,
  guest: request.guest?.toString?.() || request.guest || null,
});

const isValidDateString = (value) => {
  if (!value || typeof value !== "string") {
    return false;
  }

  return !Number.isNaN(Date.parse(value));
};

const validateOfflineRequestInput = (body) => {
  const {
    guestName,
    phone,
    location,
    startDate,
    endDate,
    roomType,
    property,
  } = body;

  if (!guestName?.trim()) return "Guest name is required";
  if (!phone?.trim()) return "Phone number is required";
  if (!location?.trim()) return "Location is required";
  if (!startDate?.trim()) return "Start date is required";
  if (!endDate?.trim()) return "End date is required";
  if (!roomType?.trim()) return "Room type is required";

  if (
    !isValidDateString(startDate.trim()) ||
    !isValidDateString(endDate.trim())
  ) {
    return "Start date and end date must be valid dates";
  }

  if (startDate.trim() > endDate.trim()) {
    return "End date must be after start date";
  }

  if (property && !isValidObjectId(property)) {
    return "Property must be a valid id when provided";
  }

  return null;
};

export const createOfflineRequest = async (req, res, next) => {
  try {
    const validationError = validateOfflineRequestInput(req.body);

    if (validationError) {
      res.status(400);
      throw new Error(validationError);
    }

    const {
      guestName,
      phone,
      location,
      startDate,
      endDate,
      roomType,
      property,
    } = req.body;

    if (property) {
      const propertyDoc = await Property.findById(property);

      if (!propertyDoc) {
        res.status(404);
        throw new Error("Selected property not found");
      }

      if (propertyDoc.status !== "approved") {
        res.status(400);
        throw new Error("Offline requests can only target approved properties");
      }
    }

    const offlineRequest = await OfflineRequest.create({
      guestName: guestName.trim(),
      phone: phone.trim(),
      location: location.trim(),
      startDate: startDate.trim(),
      endDate: endDate.trim(),
      roomType: roomType.trim(),
      property: property ? new mongoose.Types.ObjectId(property) : null,
      guest:
        req.user?.role === "guest"
          ? req.user._id
          : null,
      responseMessage: "",
      status: "pending",
    });

    const populatedRequest = await OfflineRequest.findById(offlineRequest._id)
      .populate("property", "title location status owner")
      .lean();

    res.status(201).json({
      success: true,
      message: "Offline booking request submitted successfully",
      data: serializeOfflineRequest(populatedRequest),
    });
  } catch (error) {
    next(error);
  }
};

export const getOwnerOfflineRequests = async (req, res, next) => {
  try {
    const properties = await Property.find({ owner: req.user._id }).select("_id");
    const propertyIds = properties.map((item) => item._id);

    const requests = await OfflineRequest.find({
      property: { $in: propertyIds },
    })
      .populate("property", "title location status owner")
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      count: requests.length,
      data: requests.map(serializeOfflineRequest),
    });
  } catch (error) {
    next(error);
  }
};

export const getGuestOfflineRequests = async (req, res, next) => {
  try {
    const matchConditions = [{ guest: req.user._id }];

    if (req.user.phone?.trim()) {
      matchConditions.push({
        guest: null,
        phone: req.user.phone.trim(),
      });
    }

    const requests = await OfflineRequest.find({
      $or: matchConditions,
    })
      .populate("property", "title location status")
      .sort({ createdAt: -1 })
      .lean();

    const uniqueRequests = [];
    const seenIds = new Set();

    requests.forEach((request) => {
      const id = request._id.toString();
      if (seenIds.has(id)) return;
      seenIds.add(id);
      uniqueRequests.push(request);
    });

    if (req.user.phone?.trim()) {
      await OfflineRequest.updateMany(
        {
          guest: null,
          phone: req.user.phone.trim(),
        },
        { guest: req.user._id },
      );
    }

    res.json({
      success: true,
      count: uniqueRequests.length,
      data: uniqueRequests.map(serializeOfflineRequest),
    });
  } catch (error) {
    next(error);
  }
};

export const respondToOfflineRequest = async (req, res, next) => {
  try {
    const { responseMessage, status } = req.body;

    if (!responseMessage?.trim()) {
      res.status(400);
      throw new Error("Response message is required");
    }

    const allowedStatuses = ["responded", "closed"];
    const nextStatus = status && allowedStatuses.includes(status) ? status : "responded";

    const offlineRequest = await OfflineRequest.findById(req.params.id).populate(
      "property",
      "title owner",
    );

    if (!offlineRequest) {
      res.status(404);
      throw new Error("Offline request not found");
    }

    if (!offlineRequest.property) {
      res.status(400);
      throw new Error("This request is not linked to a property");
    }

    if (offlineRequest.property.owner.toString() !== req.user._id.toString()) {
      res.status(403);
      throw new Error("Not authorized to respond to this request");
    }

    offlineRequest.responseMessage = responseMessage.trim();
    offlineRequest.status = nextStatus;
    await offlineRequest.save();

    const updatedRequest = await OfflineRequest.findById(offlineRequest._id)
      .populate("property", "title location status owner")
      .lean();

    res.json({
      success: true,
      message: "Response saved successfully",
      data: serializeOfflineRequest(updatedRequest),
    });
  } catch (error) {
    next(error);
  }
};
