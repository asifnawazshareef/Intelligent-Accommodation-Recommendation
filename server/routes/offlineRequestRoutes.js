import express from "express";
import {
  createOfflineRequest,
  getOwnerOfflineRequests,
  respondToOfflineRequest,
} from "../controllers/offlineRequestController.js";
import { protect } from "../middleware/authMiddleware.js";
import { authorize } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.post("/", createOfflineRequest);
router.get("/owner", protect, authorize("owner"), getOwnerOfflineRequests);
router.put("/:id/respond", protect, authorize("owner"), respondToOfflineRequest);

export default router;
