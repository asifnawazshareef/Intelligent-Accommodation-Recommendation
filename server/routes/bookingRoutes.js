import express from "express";
import {
  createBooking,
  getMyBookings,
  getOwnerBookings,
  getBookingById,
  confirmDemoPayment,
  cancelBooking,
} from "../controllers/bookingController.js";
import { protect } from "../middleware/authMiddleware.js";
import { authorize } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.use(protect);

router.post("/", authorize("guest"), createBooking);
router.get("/my-bookings", authorize("guest"), getMyBookings);
router.get("/owner-bookings", authorize("owner"), getOwnerBookings);
router.put("/:id/confirm-demo-payment", authorize("guest"), confirmDemoPayment);
router.put("/:id/cancel", authorize("guest"), cancelBooking);
router.get("/:id", getBookingById);

export default router;
