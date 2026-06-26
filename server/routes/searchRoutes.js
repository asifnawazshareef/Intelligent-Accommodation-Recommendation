import express from "express";
import { optionalProtect } from "../middleware/authMiddleware.js";
import {
  searchProperties,
  getRecommendations,
} from "../controllers/searchController.js";

const router = express.Router();

router.get("/search", optionalProtect, searchProperties);
router.get("/recommendations", optionalProtect, getRecommendations);

export default router;
