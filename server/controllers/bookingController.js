import mongoose from "mongoose";
import Booking from "../models/Booking.js";
import Property from "../models/Property.js";

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const isValidDateString = (value) => {
  if (!value || typeof value !== "string") {
    return false;
  }

  const parsed = Date.parse(value);
  return !Number.isNaN(parsed);
};

const isWithinAvailability = (startDate, endDate, availabilityCalendar) => {
  if (!availabilityCalendar?.length) {
    return true;
  }

  return availabilityCalendar.some(
    (range) =>
      range?.startDate &&
      range?.endDate &&
      startDate >= range.startDate &&
      endDate <= range.endDate,
  );
};

const validateBookingInput = (body) => {
  const { property, startDate, endDate, guests } = body;

  if (!property || !isValidObjectId(property)) {
    return "Valid property is required";
  }

  if (!startDate?.trim()) {
    return "Start date is required";
  }

  if (!endDate?.trim()) {
    return "End date is required";
  }

  if (!isValidDateString(startDate.trim()) || !isValidDateString(endDate.trim())) {
    return "Start date and end date must be valid dates";
  }

  const normalizedStart = startDate.trim();
  const normalizedEnd = endDate.trim();

  if (normalizedStart > normalizedEnd) {
    return "End date must be after start date";
  }

  const today = new Date().toISOString().slice(0, 10);
  if (normalizedStart < today) {
    return "Start date cannot be in the past";
  }

  if (guests === undefined || guests === null || Number.isNaN(Number(guests))) {
    return "Number of guests is required";
  }

  if (Number(guests) < 1) {
    return "At least one guest is required";
  }

  return null;
};

const populateBookingQuery = (query) =>
  query
    .populate("guest", "name email")
    .populate({
      path: "property",
      select: "title price location status owner",
      populate: { path: "owner", select: "name email" },
    })
    .sort({ createdAt: -1 });

export const createBooking = async (req, res, next) => {
  try {
    const validationError = validateBookingInput(req.body);

    if (validationError) {
      res.status(400);
      throw new Error(validationError);
    }

    const { property: propertyId, startDate, endDate, guests } = req.body;
    const normalizedStart = startDate.trim();
    const normalizedEnd = endDate.trim();

    const property = await Property.findById(propertyId);

    if (!property) {
      res.status(404);
      throw new Error("Property not found");
    }

    if (property.status !== "approved") {
      res.status(400);
      throw new Error("Bookings are only allowed for approved properties");
    }

    if (
      !isWithinAvailability(
        normalizedStart,
        normalizedEnd,
        property.availabilityCalendar,
      )
    ) {
      res.status(400);
      throw new Error("Selected dates are not available for this property");
    }

    const conflictingBooking = await Booking.findOne({
      property: propertyId,
      status: { $in: ["pending", "confirmed"] },
      startDate: { $lte: normalizedEnd },
      endDate: { $gte: normalizedStart },
    });

    if (conflictingBooking) {
      res.status(400);
      throw new Error("Property is already booked for the selected dates");
    }

    const booking = await Booking.create({
      guest: req.user._id,
      property: propertyId,
      startDate: normalizedStart,
      endDate: normalizedEnd,
      guests: Number(guests),
      status: "pending",
      paymentStatus: "pending",
    });

    const populatedBooking = await populateBookingQuery(
      Booking.findById(booking._id),
    );

    res.status(201).json({
      success: true,
      message: "Booking created successfully",
      data: populatedBooking,
    });
  } catch (error) {
    next(error);
  }
};

export const getMyBookings = async (req, res, next) => {
  try {
    const bookings = await populateBookingQuery(
      Booking.find({ guest: req.user._id }),
    );

    res.json({
      success: true,
      count: bookings.length,
      data: bookings,
    });
  } catch (error) {
    next(error);
  }
};

export const getOwnerBookings = async (req, res, next) => {
  try {
    const properties = await Property.find({ owner: req.user._id }).select("_id");
    const propertyIds = properties.map((property) => property._id);

    const bookings = await populateBookingQuery(
      Booking.find({ property: { $in: propertyIds } }),
    );

    res.json({
      success: true,
      count: bookings.length,
      data: bookings,
    });
  } catch (error) {
    next(error);
  }
};

export const getBookingById = async (req, res, next) => {
  try {
    const booking = await populateBookingQuery(
      Booking.findById(req.params.id),
    );

    if (!booking) {
      res.status(404);
      throw new Error("Booking not found");
    }

    const guestId = booking.guest._id?.toString() || booking.guest.toString();
    const ownerId =
      booking.property?.owner?._id?.toString() ||
      booking.property?.owner?.toString();

    const isGuest = req.user._id.toString() === guestId;
    const isOwner = ownerId && req.user._id.toString() === ownerId;
    const isAdmin = req.user.role === "admin";

    if (!isGuest && !isOwner && !isAdmin) {
      res.status(403);
      throw new Error("Not authorized to view this booking");
    }

    res.json({
      success: true,
      data: booking,
    });
  } catch (error) {
    next(error);
  }
};

export const confirmPayment = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      res.status(404);
      throw new Error("Booking not found");
    }

    if (booking.guest.toString() !== req.user._id.toString()) {
      res.status(403);
      throw new Error("Not authorized to confirm payment for this booking");
    }

    if (booking.status === "cancelled") {
      res.status(400);
      throw new Error("Cancelled bookings cannot be confirmed");
    }

    if (booking.paymentStatus === "confirmed") {
      res.status(400);
      throw new Error("Payment is already confirmed");
    }

    booking.status = "confirmed";
    booking.paymentStatus = "confirmed";
    await booking.save();

    const populatedBooking = await populateBookingQuery(
      Booking.findById(booking._id),
    );

    res.json({
      success: true,
      message: "Payment confirmed and booking updated successfully",
      data: populatedBooking,
    });
  } catch (error) {
    next(error);
  }
};

export const cancelBooking = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      res.status(404);
      throw new Error("Booking not found");
    }

    if (booking.guest.toString() !== req.user._id.toString()) {
      res.status(403);
      throw new Error("Not authorized to cancel this booking");
    }

    if (booking.status === "cancelled") {
      res.status(400);
      throw new Error("Booking is already cancelled");
    }

    booking.status = "cancelled";
    await booking.save();

    const populatedBooking = await populateBookingQuery(
      Booking.findById(booking._id),
    );

    res.json({
      success: true,
      message: "Booking cancelled successfully",
      data: populatedBooking,
    });
  } catch (error) {
    next(error);
  }
};
