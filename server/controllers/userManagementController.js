import mongoose from "mongoose";
import User from "../models/User.js";

const VALID_ROLES = ["guest", "owner", "admin"];
const USER_FIELDS = "name email phone role isVerified languagePref createdAt updatedAt";

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

export const getAllUsers = async (req, res, next) => {
  try {
    const { role } = req.query;
    const filter = {};

    if (role) {
      if (!VALID_ROLES.includes(role)) {
        res.status(400);
        throw new Error("Invalid role filter. Use guest, owner, or admin.");
      }
      filter.role = role;
    }

    const users = await User.find(filter)
      .select(USER_FIELDS)
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (error) {
    next(error);
  }
};

export const updateUserVerification = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isVerified } = req.body;

    if (!isValidObjectId(id)) {
      res.status(400);
      throw new Error("Valid user id is required");
    }

    const user = await User.findById(id).select(USER_FIELDS);

    if (!user) {
      res.status(404);
      throw new Error("User not found");
    }

    if (typeof isVerified === "boolean") {
      user.isVerified = isVerified;
    } else {
      user.isVerified = !user.isVerified;
    }

    await user.save();

    res.json({
      success: true,
      message: user.isVerified
        ? "User verified successfully"
        : "User unverified successfully",
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

export const updateUserRole = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!isValidObjectId(id)) {
      res.status(400);
      throw new Error("Valid user id is required");
    }

    if (!role || !VALID_ROLES.includes(role)) {
      res.status(400);
      throw new Error("Valid role is required: guest, owner, or admin");
    }

    const user = await User.findById(id).select(USER_FIELDS);

    if (!user) {
      res.status(404);
      throw new Error("User not found");
    }

    if (user._id.toString() === req.user._id.toString()) {
      res.status(400);
      throw new Error("You cannot change your own role");
    }

    if (user.role === "admin" && role !== "admin") {
      const adminCount = await User.countDocuments({ role: "admin" });
      if (adminCount <= 1) {
        res.status(400);
        throw new Error("Cannot change role of the only admin account");
      }
    }

    user.role = role;
    await user.save();

    res.json({
      success: true,
      message: "User role updated successfully",
      data: user,
    });
  } catch (error) {
    next(error);
  }
};
