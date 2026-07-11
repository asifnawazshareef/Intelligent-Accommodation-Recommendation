/**
 * Seed dummy bookings + reviews for demo/testing.
 *
 * Usage:
 *   npm run seed:reviews --prefix server
 *   npm run seed:demo:reviews --prefix server   (full demo dataset)
 */
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import connectDB from "../config/db.js";
import User from "../models/User.js";
import Property from "../models/Property.js";
import Booking from "../models/Booking.js";
import Review from "../models/Review.js";
import { syncPropertySentiment } from "../utils/propertySentimentStore.js";

dotenv.config();

const isDemoFlag = process.argv.includes("--demo");
const DEMO_GUEST_COUNT = Number(process.env.SEED_DEMO_GUEST_COUNT || (isDemoFlag ? 10 : 5));
const REVIEWS_MIN = Number(process.env.SEED_REVIEWS_MIN || (isDemoFlag ? 3 : 2));
const REVIEWS_MAX = Number(process.env.SEED_REVIEWS_MAX || (isDemoFlag ? 7 : 5));
const PROPERTY_BATCH = Number(process.env.SEED_PROPERTY_BATCH || 50);
const MAX_PROPERTIES = Number(
  process.env.SEED_REVIEW_PROPERTIES || (isDemoFlag ? 1000 : 200),
);

const REVIEW_TEMPLATES = {
  positive: [
    {
      rating: 5,
      text: "Excellent stay. The room was clean and staff was very helpful throughout our visit.",
      sentiment: "positive",
      sentimentScore: 0.93,
      aspects: ["room", "cleanliness", "staff"],
      aspectInsights: [
        { aspect: "cleanliness", sentiment: "positive", confidence: 0.92, mentions: 1 },
        { aspect: "staff", sentiment: "positive", confidence: 0.9, mentions: 1 },
      ],
      summary: "Guest praised cleanliness and staff service.",
    },
    {
      rating: 5,
      text: "Great location near the city center. Breakfast was good and the bed was comfortable.",
      sentiment: "positive",
      sentimentScore: 0.91,
      aspects: ["location", "food", "room"],
      aspectInsights: [
        { aspect: "location", sentiment: "positive", confidence: 0.9, mentions: 1 },
        { aspect: "food", sentiment: "positive", confidence: 0.86, mentions: 1 },
      ],
      summary: "Guest enjoyed location, food, and comfort.",
    },
    {
      rating: 4,
      text: "Very good value for money. Wi-Fi worked well and the facilities were satisfactory.",
      sentiment: "positive",
      sentimentScore: 0.88,
      aspects: ["value", "wifi", "facilities"],
      aspectInsights: [
        { aspect: "wifi", sentiment: "positive", confidence: 0.87, mentions: 1 },
        { aspect: "value", sentiment: "positive", confidence: 0.85, mentions: 1 },
      ],
      summary: "Guest highlighted value, wifi, and facilities.",
    },
    {
      rating: 4,
      text: "Friendly staff and peaceful surroundings. Would recommend for families.",
      sentiment: "positive",
      sentimentScore: 0.89,
      aspects: ["staff", "noise"],
      aspectInsights: [
        { aspect: "staff", sentiment: "positive", confidence: 0.9, mentions: 1 },
        { aspect: "noise", sentiment: "positive", confidence: 0.82, mentions: 1 },
      ],
      summary: "Guest praised staff and quiet environment.",
    },
  ],
  neutral: [
    {
      rating: 3,
      text: "Average stay overall. Room was acceptable but nothing special for the price.",
      sentiment: "neutral",
      sentimentScore: 0.62,
      aspects: ["room", "value"],
      aspectInsights: [
        { aspect: "room", sentiment: "neutral", confidence: 0.7, mentions: 1 },
        { aspect: "value", sentiment: "neutral", confidence: 0.65, mentions: 1 },
      ],
      summary: "Guest found the stay acceptable but unremarkable.",
    },
    {
      rating: 3,
      text: "Standard accommodation for this price range. Check-in was smooth.",
      sentiment: "neutral",
      sentimentScore: 0.6,
      aspects: ["staff"],
      aspectInsights: [
        { aspect: "staff", sentiment: "neutral", confidence: 0.68, mentions: 1 },
      ],
      summary: "Guest reported a standard experience.",
    },
  ],
  negative: [
    {
      rating: 2,
      text: "Room was not clean and wifi was not working properly during our stay.",
      sentiment: "negative",
      sentimentScore: 0.9,
      aspects: ["cleanliness", "wifi"],
      aspectInsights: [
        { aspect: "cleanliness", sentiment: "negative", confidence: 0.91, mentions: 1 },
        { aspect: "wifi", sentiment: "negative", confidence: 0.88, mentions: 1 },
      ],
      summary: "Guest reported cleanliness and wifi issues.",
    },
    {
      rating: 1,
      text: "Poor service and the room was noisy. Not worth the price at all.",
      sentiment: "negative",
      sentimentScore: 0.92,
      aspects: ["staff", "noise", "value"],
      aspectInsights: [
        { aspect: "staff", sentiment: "negative", confidence: 0.9, mentions: 1 },
        { aspect: "noise", sentiment: "negative", confidence: 0.87, mentions: 1 },
      ],
      summary: "Guest was dissatisfied with service and noise.",
    },
  ],
};

const dateOffset = (days) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

const pickReviewTemplate = (propertyIndex, reviewIndex) => {
  const bucket = propertyIndex % 10;
  if (bucket <= 5) {
    return REVIEW_TEMPLATES.positive[reviewIndex % REVIEW_TEMPLATES.positive.length];
  }
  if (bucket <= 7) {
    return REVIEW_TEMPLATES.neutral[reviewIndex % REVIEW_TEMPLATES.neutral.length];
  }
  return REVIEW_TEMPLATES.negative[reviewIndex % REVIEW_TEMPLATES.negative.length];
};

const reviewCountForProperty = (index) =>
  REVIEWS_MIN + (index % (REVIEWS_MAX - REVIEWS_MIN + 1));

const ensureDemoGuests = async () => {
  const guests = [];
  const primaryEmail = (process.env.GUEST_EMAIL || "guest@iars.com").toLowerCase().trim();

  const seedUsers = [
    {
      name: process.env.GUEST_NAME || "Demo Guest",
      email: primaryEmail,
      password: process.env.GUEST_PASSWORD || "Guest@123456",
    },
    ...Array.from({ length: DEMO_GUEST_COUNT - 1 }, (_, index) => ({
      name: `Demo Guest ${index + 2}`,
      email: `guest.demo${index + 2}@iars.com`,
      password: "Guest@123456",
    })),
  ];

  for (const seedUser of seedUsers) {
    let guest = await User.findOne({ email: seedUser.email });

    if (!guest) {
      const hashedPassword = await bcrypt.hash(seedUser.password, 10);
      guest = await User.create({
        name: seedUser.name,
        email: seedUser.email,
        password: hashedPassword,
        phone: "",
        role: "guest",
        languagePref: "en",
        isVerified: true,
      });
      console.log(`  + Created guest: ${guest.email}`);
    }

    guests.push(guest);
  }

  return guests;
};

const seedReviews = async () => {
  console.log(
    `Seeding demo reviews (demo=${isDemoFlag}, guests=${DEMO_GUEST_COUNT}, reviews/property=${REVIEWS_MIN}-${REVIEWS_MAX})...\n`,
  );

  await connectDB();

  const guests = await ensureDemoGuests();

  const properties = await Property.find({ status: "approved" })
    .select("_id title price sentimentSnapshot.totalReviews")
    .limit(MAX_PROPERTIES)
    .lean();

  const targets = properties.filter(
    (property) => (property.sentimentSnapshot?.totalReviews || 0) < REVIEWS_MIN,
  );

  if (targets.length === 0) {
    console.log("  ✓ All target properties already have enough reviews.");
    process.exit(0);
    return;
  }

  console.log(`  Seeding reviews for ${targets.length} approved properties...\n`);

  let totalBookings = 0;
  let totalReviews = 0;
  let guestCursor = 0;

  for (let batchStart = 0; batchStart < targets.length; batchStart += PROPERTY_BATCH) {
    const batch = targets.slice(batchStart, batchStart + PROPERTY_BATCH);
    const bookingPayloads = [];
    const bookingMeta = [];

    batch.forEach((property, batchIndex) => {
      const propertyIndex = batchStart + batchIndex;
      const reviewTarget = reviewCountForProperty(propertyIndex);
      const existing = property.sentimentSnapshot?.totalReviews || 0;
      const toCreate = Math.max(0, reviewTarget - existing);

      for (let reviewIndex = 0; reviewIndex < toCreate; reviewIndex += 1) {
        const guest = guests[guestCursor % guests.length];
        guestCursor += 1;

        const stayOffset = 40 + propertyIndex * 3 + reviewIndex * 11;
        const startDate = dateOffset(-stayOffset);
        const endDate = dateOffset(-stayOffset + 2);
        const nights = 2;
        const totalAmount = Math.max(property.price || 5000, 5000) * nights;

        bookingPayloads.push({
          guest: guest._id,
          property: property._id,
          startDate,
          endDate,
          guests: 1 + (reviewIndex % 3),
          totalAmount,
          status: "confirmed",
          paymentStatus: "confirmed",
          paymentMethod: "demo",
          paymentConfirmedAt: new Date(Date.now() - stayOffset * 86400000),
        });

        bookingMeta.push({
          propertyId: property._id,
          template: pickReviewTemplate(propertyIndex, reviewIndex),
        });
      }
    });

    if (bookingPayloads.length === 0) {
      continue;
    }

    const createdBookings = await Booking.insertMany(bookingPayloads, {
      ordered: true,
    });

    const reviewPayloads = createdBookings.map((booking, index) => {
      const template = bookingMeta[index].template;
      return {
        guest: booking.guest,
        property: booking.property,
        booking: booking._id,
        rating: template.rating,
        text: template.text,
        sentiment: template.sentiment,
        sentimentScore: template.sentimentScore,
        aspects: template.aspects,
        aspectInsights: template.aspectInsights,
        summary: template.summary,
        createdAt: new Date(Date.now() - (30 + index) * 86400000),
      };
    });

    await Review.insertMany(reviewPayloads, { ordered: true });

    const propertyIds = [...new Set(batch.map((property) => property._id.toString()))];
    for (const propertyId of propertyIds) {
      await syncPropertySentiment(propertyId);
    }

    totalBookings += createdBookings.length;
    totalReviews += reviewPayloads.length;
    process.stdout.write(
      `\r  Progress: ${Math.min(batchStart + batch.length, targets.length)}/${targets.length} properties, ${totalReviews} reviews`,
    );
  }

  process.stdout.write("\n");

  const [reviewCount, approvedWithReviews] = await Promise.all([
    Review.countDocuments({}),
    Property.countDocuments({
      status: "approved",
      "sentimentSnapshot.totalReviews": { $gte: REVIEWS_MIN },
    }),
  ]);

  console.log(`\n  + Bookings created: ${totalBookings}`);
  console.log(`  + Reviews created:  ${totalReviews}`);
  console.log(`  Total reviews in database: ${reviewCount}`);
  console.log(`  Approved properties with ${REVIEWS_MIN}+ reviews: ${approvedWithReviews}`);
  console.log("\nDemo guest logins (password: Guest@123456):");
  guests.slice(0, 5).forEach((guest) => console.log(`  • ${guest.email}`));
  console.log("\nDone.\n");

  process.exit(0);
};

seedReviews().catch((error) => {
  console.error("Review seed failed:", error.message);
  process.exit(1);
});
