import express from "express";
import {
  createProperty,
  getProperties,
  getMyProperties,
  getPropertyById,
  updateProperty,
  moderateProperty,
  trackPropertyView,
} from "../controllers/propertyController.js";
import { protect, optionalProtect } from "../middleware/authMiddleware.js";
import { authorize } from "../middleware/roleMiddleware.js";
import {
  handleMulterError,
  propertyUpload,
} from "../middleware/uploadMiddleware.js";

const router = express.Router();

const uploadPropertyImages = (req, res, next) => {
  propertyUpload(req, res, (error) => {
    if (error) {
      return handleMulterError(error, req, res, next);
    }
    next();
  });
};

// Static/specific routes first
router.get("/", getProperties);
router.get(
  "/owner/my-properties",
  protect,
  authorize("owner"),
  getMyProperties,
);
router.post(
  "/",
  protect,
  authorize("owner"),
  uploadPropertyImages,
  createProperty,
);
router.put(
  "/:id/moderate",
  protect,
  authorize("admin"),
  moderateProperty,
);
router.post(
  "/:id/view",
  protect,
  authorize("guest"),
  trackPropertyView,
);

// Dynamic routes last
router.get("/:id", optionalProtect, getPropertyById);
router.put(
  "/:id",
  protect,
  authorize("owner"),
  uploadPropertyImages,
  updateProperty,
);

export default router;
