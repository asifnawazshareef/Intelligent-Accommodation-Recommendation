import dotenv from "dotenv";
import mongoose from "mongoose";
import { checkSeedSetup } from "../services/seed/readiness.js";

dotenv.config({ quiet: true, ...(process.env.DOTENV_CONFIG_PATH && { path: process.env.DOTENV_CONFIG_PATH }) });
try {
  if (process.env.MONGO_URI) {
    try {
      await mongoose.connect(process.env.MONGO_URI, {
        serverSelectionTimeoutMS: 5000, connectTimeoutMS: 5000, autoIndex: false, autoCreate: false,
      });
    } catch { /* The structured report explains the failed connection without printing its URI. */ }
  }
  const report = await checkSeedSetup();
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = report.ready ? 0 : 1;
} finally { await mongoose.disconnect(); }
