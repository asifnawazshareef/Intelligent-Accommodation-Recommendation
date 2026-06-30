import dotenv from "dotenv";
import connectDB from "../config/db.js";
import User from "../models/User.js";
import Property from "../models/Property.js";

dotenv.config();

const TARGET_COUNT = Number(process.env.SEED_PROPERTY_COUNT || 50);
const OWNER_EMAIL = (process.env.OWNER_EMAIL || "owner@iars.com").toLowerCase().trim();

const CITIES = [
  { city: "Islamabad", country: "Pakistan", addresses: ["F-7 Markaz", "Blue Area", "DHA Phase 2", "Bahria Town"] },
  { city: "Lahore", country: "Pakistan", addresses: ["Gulberg III", "DHA Phase 5", "Model Town", "Johar Town"] },
  { city: "Karachi", country: "Pakistan", addresses: ["Clifton Block 2", "DHA Phase 6", "Bahria Town", "PECHS"] },
  { city: "Murree", country: "Pakistan", addresses: ["Mall Road", "Patriata", "Bhurban", "Lower Topa"] },
  { city: "Hunza", country: "Pakistan", addresses: ["Karimabad", "Aliabad", "Gulmit", "Passu"] },
  { city: "Skardu", country: "Pakistan", addresses: ["K2 Road", "Satpara Lake", "Shangrila", "Khaplu"] },
  { city: "Swat", country: "Pakistan", addresses: ["Mingora", "Malam Jabba", "Kalam", "Bahrain"] },
  { city: "Multan", country: "Pakistan", addresses: ["Cantt", "Gulgasht", "Bosan Road", "Shah Rukn-e-Alam"] },
];

const PROPERTY_TYPES = [
  "Guest House",
  "Boutique Hotel",
  "Mountain Lodge",
  "City Apartment",
  "Heritage Stay",
  "Lake View Retreat",
  "Family Suite",
  "Business Inn",
  "Eco Lodge",
  "Hilltop Cottage",
];

const DESCRIPTIONS = [
  "Spacious rooms with free Wi-Fi, breakfast, and easy access to local attractions.",
  "Ideal for families and business travelers. Quiet neighborhood with parking available.",
  "Modern amenities, clean interiors, and a helpful on-site host for a smooth stay.",
  "Perfect base for sightseeing. Walking distance to markets, cafes, and transport.",
  "Comfortable beds, hot water, and scenic views. Great value for short and long stays.",
  "Recently renovated property with air conditioning and 24-hour check-in support.",
  "Cozy stay with local hospitality. Popular with guests who enjoy peaceful surroundings.",
  "Central location with secure access. Suitable for couples, solo travelers, and groups.",
];

const verificationStatuses = ["verified", "verified", "verified", "pending", "verified"];

const dateOffset = (days) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

const buildPropertyPayload = (index, ownerId) => {
  const cityMeta = CITIES[index % CITIES.length];
  const type = PROPERTY_TYPES[index % PROPERTY_TYPES.length];
  const address = cityMeta.addresses[index % cityMeta.addresses.length];
  const title = `${type} — ${cityMeta.city} ${index + 1}`;
  const description = DESCRIPTIONS[index % DESCRIPTIONS.length];
  const price = 6000 + (index % 20) * 2500 + (index % 3) * 500;
  const verificationStatus = verificationStatuses[index % verificationStatuses.length];
  const aiScore = verificationStatus === "verified" ? 0.85 + (index % 10) * 0.01 : 0.55;

  return {
    title,
    description,
    location: {
      address,
      city: cityMeta.city,
      country: cityMeta.country,
    },
    price,
    owner: ownerId,
    images: [
      {
        url: `https://picsum.photos/seed/iars-property-${index + 1}/800/600`,
        verificationStatus,
        aiScore: Math.min(aiScore, 0.99),
      },
      {
        url: `https://picsum.photos/seed/iars-property-${index + 1}-b/800/600`,
        verificationStatus: index % 5 === 0 ? "pending" : "verified",
        aiScore: 0.88,
      },
    ],
    availabilityCalendar: [
      {
        startDate: dateOffset(0),
        endDate: dateOffset(120 + (index % 60)),
      },
    ],
    status: index % 17 === 0 ? "pending" : "approved",
  };
};

const ensureOwner = async () => {
  let owner = await User.findOne({ email: OWNER_EMAIL });

  if (owner) {
    return owner;
  }

  owner = await User.create({
    name: process.env.OWNER_NAME || "Demo Owner",
    email: OWNER_EMAIL,
    password: process.env.OWNER_PASSWORD || "Owner@123456",
    phone: process.env.OWNER_PHONE || "03007654321",
    role: "owner",
    languagePref: "en",
    isVerified: true,
  });

  console.log(`  + Created owner: ${owner.email}`);
  return owner;
};

const seedProperties = async () => {
  console.log(`Seeding up to ${TARGET_COUNT} properties...\n`);

  await connectDB();

  const owner = await ensureOwner();
  const existingTitles = new Set(
    (await Property.find({ owner: owner._id }).select("title").lean()).map(
      (property) => property.title,
    ),
  );

  const payloads = [];
  for (let index = 0; index < TARGET_COUNT; index += 1) {
    const payload = buildPropertyPayload(index, owner._id);
    if (!existingTitles.has(payload.title)) {
      payloads.push(payload);
    }
  }

  if (payloads.length === 0) {
    const total = await Property.countDocuments({ owner: owner._id });
    console.log(`  ✓ No new properties needed. Owner already has ${total} listing(s).`);
    process.exit(0);
    return;
  }

  const created = await Property.insertMany(payloads);
  const approved = created.filter((property) => property.status === "approved").length;
  const pending = created.filter((property) => property.status === "pending").length;

  console.log(`  + Inserted ${created.length} properties for ${owner.email}`);
  console.log(`    • Approved: ${approved}`);
  console.log(`    • Pending:  ${pending}`);

  const totalApproved = await Property.countDocuments({ status: "approved" });
  console.log(`\nTotal approved properties in database: ${totalApproved}`);
  console.log("Done.\n");

  process.exit(0);
};

seedProperties().catch((error) => {
  console.error("Property seed failed:", error.message);
  process.exit(1);
});
