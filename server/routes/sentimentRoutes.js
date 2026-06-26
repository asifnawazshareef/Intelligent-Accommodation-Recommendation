import express from "express";
import { getPropertySentimentSummary } from "../controllers/sentimentController.js";

const router = express.Router();

router.get("/property/:propertyId", getPropertySentimentSummary);

export default router;
