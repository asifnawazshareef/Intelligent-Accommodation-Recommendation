import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { authorize } from "../middleware/roleMiddleware.js";
import {
  getImageAuditList,
  updateImageAudit,
} from "../controllers/imageAuditController.js";
import {
  getPendingListings,
  approveListing,
  rejectListing,
} from "../controllers/listingModerationController.js";
import {
  getAllUsers,
  updateUserRole,
  updateUserVerification,
} from "../controllers/userManagementController.js";

const router = express.Router();

router.use(protect, authorize("admin"));

router.get("/users", getAllUsers);
router.put("/users/:id/verify", updateUserVerification);
router.put("/users/:id/role", updateUserRole);

router.get("/image-audit", getImageAuditList);
router.put("/image-audit/:id", updateImageAudit);

router.get("/listings/pending", getPendingListings);
router.put("/listings/:id/approve", approveListing);
router.put("/listings/:id/reject", rejectListing);

export default router;
