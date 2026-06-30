/**
 * Re-run sentiment analysis on all stored reviews (after model retraining).
 *
 * Usage: npm run reanalyze:reviews --prefix server
 */
import dotenv from "dotenv";
import connectDB from "../config/db.js";
import Review from "../models/Review.js";
import { analyzeSentiment } from "../services/sentimentService.js";
import { syncPropertySentiment } from "../utils/propertySentimentStore.js";

dotenv.config();

const buildAspectInsights = (sentimentResult) => {
  if (sentimentResult.aspectInsights?.length > 0) {
    return sentimentResult.aspectInsights;
  }

  return (sentimentResult.aspects || []).map((aspect) => ({
    aspect,
    sentiment: sentimentResult.sentiment,
    confidence: sentimentResult.confidence,
    mentions: 1,
  }));
};

const reanalyze = async () => {
  await connectDB();

  const reviews = await Review.find().sort({ createdAt: 1 });
  let updated = 0;
  const propertyIds = new Set();

  console.log(`Re-analyzing ${reviews.length} review(s)...\n`);

  for (const review of reviews) {
    const result = await analyzeSentiment(review.text);

    review.sentiment = result.sentiment;
    review.sentimentScore = result.confidence;
    review.aspects = result.aspects;
    review.aspectInsights = buildAspectInsights(result);
    review.summary = result.summary;

    await review.save();
    propertyIds.add(review.property.toString());
    updated += 1;

    console.log(
      `  ✓ ${review._id} -> ${result.sentiment} (${Math.round(result.confidence * 100)}%)`,
    );
  }

  console.log(`\nSyncing sentiment on ${propertyIds.size} propert(ies)...`);

  for (const propertyId of propertyIds) {
    await syncPropertySentiment(propertyId);
  }

  console.log(`\nDone. Updated ${updated} review(s).`);
  process.exit(0);
};

reanalyze().catch((error) => {
  console.error("Re-analysis failed:", error.message);
  process.exit(1);
});
