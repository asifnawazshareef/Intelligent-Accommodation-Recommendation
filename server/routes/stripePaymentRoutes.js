import express from "express";
import {
  createCheckoutSession,
  verifyCheckoutSession,
} from "../controllers/stripePaymentController.js";
import { protect } from "../middleware/authMiddleware.js";
import { authorize } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.use(protect);

router.post(
  "/create-checkout-session",
  authorize("guest"),
  createCheckoutSession,
);
router.get("/verify-session", authorize("guest"), verifyCheckoutSession);

export default router;
