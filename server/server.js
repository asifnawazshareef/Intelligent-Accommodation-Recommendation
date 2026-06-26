import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import mongoose from "mongoose";

import reviewRoutes from "./routes/reviewRoutes.js";
import sentimentRoutes from "./routes/sentimentRoutes.js";
import propertyRoutes from "./routes/propertyRoutes.js";

dotenv.config();

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Sentiment MERN backend is running",
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    status: "OK",
    message: "Backend server is healthy",
  });
});

app.use("/api/reviews", reviewRoutes);
app.use("/api/sentiment", sentimentRoutes);
app.use("/api/properties", propertyRoutes);

const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB connected successfully");

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  });
