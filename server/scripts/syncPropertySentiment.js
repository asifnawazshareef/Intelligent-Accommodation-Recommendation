/**
 * Sync stored sentiment snapshots on all properties from their reviews.
 *
 * Usage: npm run sync:sentiment --prefix server
 */
import dotenv from "dotenv";
import connectDB from "../config/db.js";
import Property from "../models/Property.js";
import { syncPropertySentiment } from "../utils/propertySentimentStore.js";

dotenv.config();

const syncAll = async () => {
  await connectDB();

  const properties = await Property.find().select("_id title").lean();
  console.log(`Syncing sentiment for ${properties.length} propert(ies)...\n`);

  for (const property of properties) {
    const snapshot = await syncPropertySentiment(property._id);
    console.log(
      `  ✓ ${property.title} -> ${snapshot.totalReviews} review(s), ${snapshot.positivePercent}% positive`,
    );
  }

  console.log("\nDone.");
  process.exit(0);
};

syncAll().catch((error) => {
  console.error("Sentiment sync failed:", error.message);
  process.exit(1);
});
