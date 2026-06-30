/**
 * Remove all listings, reviews, and related booking data from MongoDB.
 *
 * Usage:
 *   npm run clear:listings --prefix server
 *
 * Keeps users (admin, guest, owner accounts).
 */
import dotenv from "dotenv";
import connectDB from "../config/db.js";
import Property from "../models/Property.js";
import Review from "../models/Review.js";
import Booking from "../models/Booking.js";
import OfflineRequest from "../models/OfflineRequest.js";
import SearchHistory from "../models/SearchHistory.js";

dotenv.config();

const clearListings = async () => {
  console.log("Clearing listings and related data...\n");
  console.log(`Database: ${process.env.MONGO_URI}\n`);

  await connectDB();

  const [reviews, bookings, offline, properties, searches] = await Promise.all([
    Review.deleteMany({}),
    Booking.deleteMany({}),
    OfflineRequest.deleteMany({}),
    Property.deleteMany({}),
    SearchHistory.deleteMany({}),
  ]);

  console.log(`  Deleted ${properties.deletedCount} properties`);
  console.log(`  Deleted ${reviews.deletedCount} reviews`);
  console.log(`  Deleted ${bookings.deletedCount} bookings`);
  console.log(`  Deleted ${offline.deletedCount} offline requests`);
  console.log(`  Deleted ${searches.deletedCount} search history entries`);
  console.log("\nUsers were kept (login accounts unchanged).");
  console.log("Done.\n");

  process.exit(0);
};

clearListings().catch((error) => {
  console.error("Clear failed:", error.message);
  process.exit(1);
});
