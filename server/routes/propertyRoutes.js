import express from "express";
import {
  createProperty,
  getProperties,
  getMyProperties,
  getPropertyById,
  updateProperty,
  moderateProperty,
} from "../controllers/propertyController.js";
import { protect, optionalProtect } from "../middleware/authMiddleware.js";
import { authorize } from "../middleware/roleMiddleware.js";

const router = express.Router();

// Static/specific routes first
router.get("/", getProperties);
router.get(
  "/owner/my-properties",
  protect,
  authorize("owner"),
  getMyProperties,
);
router.post("/", protect, authorize("owner"), createProperty);
router.put(
  "/:id/moderate",
  protect,
  authorize("admin"),
  moderateProperty,
);

// Dynamic routes last
router.get("/:id", optionalProtect, getPropertyById);
router.put("/:id", protect, authorize("owner"), updateProperty);

export default router;
