import express from "express";
import dotenv from "dotenv";
import cors from "cors";

import connectDB from "./config/db.js";
import { notFound, errorHandler } from "./middleware/errorMiddleware.js";
import authRoutes from "./routes/authRoutes.js";
import propertyRoutes from "./routes/propertyRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import searchRoutes from "./routes/searchRoutes.js";
import reviewRoutes from "./routes/reviewRoutes.js";
import sentimentRoutes from "./routes/sentimentRoutes.js";
import bookingRoutes from "./routes/bookingRoutes.js";
import offlineRequestRoutes from "./routes/offlineRequestRoutes.js";

dotenv.config();

connectDB();

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  }),
);

app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    status: "OK",
    message: "Backend server is healthy",
  });
});

// Feature routes
app.use("/api/auth", authRoutes);
app.use("/api/properties", propertyRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api", searchRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/sentiment", sentimentRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/offline-requests", offlineRequestRoutes);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
