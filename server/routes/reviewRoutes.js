import express from "express";
import { createReview, getPropertyReviews } from "../controllers/reviewController.js";

const router = express.Router();

router.post("/", createReview);
router.get("/property/:propertyId", getPropertyReviews);

export default router;
