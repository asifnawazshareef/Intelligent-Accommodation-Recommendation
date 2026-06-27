import express from "express";
import {
  createOfflineRequest,
  getGuestOfflineRequests,
  getOwnerOfflineRequests,
  respondToOfflineRequest,
} from "../controllers/offlineRequestController.js";
import { optionalProtect, protect } from "../middleware/authMiddleware.js";
import { authorize } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.post("/", optionalProtect, createOfflineRequest);
router.get("/guest", protect, authorize("guest"), getGuestOfflineRequests);
router.get("/owner", protect, authorize("owner"), getOwnerOfflineRequests);
router.put("/:id/respond", protect, authorize("owner"), respondToOfflineRequest);

export default router;
