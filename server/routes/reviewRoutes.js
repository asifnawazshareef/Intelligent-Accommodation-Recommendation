import express from "express";
import {
  createReview,
  getEligibleBookings,
  getPropertyReviews,
} from "../controllers/reviewController.js";
import { protect } from "../middleware/authMiddleware.js";
import { authorize } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.post("/", protect, authorize("guest"), createReview);
router.get("/property/:propertyId", getPropertyReviews);
router.get(
  "/eligible/:propertyId",
  protect,
  authorize("guest"),
  getEligibleBookings,
);

export default router;
