import express from "express";
import { createTestProperty, getTestProperties } from "../controllers/propertyController.js";

const router = express.Router();

router.post("/", createTestProperty);
router.get("/", getTestProperties);

export default router;
