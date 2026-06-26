import User from "../models/User.js";
import generateToken from "../utils/generateToken.js";

const formatUser = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  role: user.role,
  languagePref: user.languagePref,
  isVerified: user.isVerified,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

export const registerUser = async (req, res, next) => {
  try {
    const { name, email, phone, password, role, languagePref } = req.body;

    if (!name || !email || !password) {
      res.status(400);
      throw new Error("Name, email, and password are required");
    }

    const requestedRole = role || "guest";

    if (!["guest", "owner"].includes(requestedRole)) {
      res.status(400);
      throw new Error("Registration is only allowed for guest or owner roles");
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });

    if (existingUser) {
      res.status(400);
      throw new Error("User already exists with this email");
    }

    const user = await User.create({
      name,
      email,
      phone,
      password,
      role: requestedRole,
      languagePref: languagePref || "en",
    });

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      token: generateToken(user._id),
      user: formatUser(user),
    });
  } catch (error) {
    next(error);
  }
};

export const loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400);
      throw new Error("Email and password are required");
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select(
      "+password",
    );

    if (!user || !(await user.matchPassword(password))) {
      res.status(401);
      throw new Error("Invalid email or password");
    }

    res.json({
      success: true,
      message: "Login successful",
      token: generateToken(user._id),
      user: formatUser(user),
    });
  } catch (error) {
    next(error);
  }
};

export const getMe = async (req, res, next) => {
  try {
    res.json({
      success: true,
      user: formatUser(req.user),
    });
  } catch (error) {
    next(error);
  }
};
