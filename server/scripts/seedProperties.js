import dotenv from "dotenv";
import connectDB from "../config/db.js";
import User from "../models/User.js";
import Property from "../models/Property.js";

dotenv.config();

const isDemoFlag = process.argv.includes("--demo");

const TARGET_COUNT = Number(
  process.env.SEED_PROPERTY_COUNT || (isDemoFlag ? 1000 : 50),
);
const BATCH_SIZE = Number(process.env.SEED_BATCH_SIZE || 100);
const OWNER_EMAIL = (process.env.OWNER_EMAIL || "owner@iars.com").toLowerCase().trim();
const DEMO_MODE =
  isDemoFlag ||
  process.env.SEED_DEMO_MODE === "1" ||
  process.env.SEED_DEMO_MODE === "true" ||
  TARGET_COUNT >= 100;

const CITIES = [
  { city: "Islamabad", country: "Pakistan", addresses: ["F-7 Markaz", "Blue Area", "DHA Phase 2", "Bahria Town", "E-11"] },
  { city: "Lahore", country: "Pakistan", addresses: ["Gulberg III", "DHA Phase 5", "Model Town", "Johar Town", "MM Alam Road"] },
  { city: "Karachi", country: "Pakistan", addresses: ["Clifton Block 2", "DHA Phase 6", "Bahria Town", "PECHS", "Saddar"] },
  { city: "Murree", country: "Pakistan", addresses: ["Mall Road", "Patriata", "Bhurban", "Lower Topa", "Kashmir Point"] },
  { city: "Hunza", country: "Pakistan", addresses: ["Karimabad", "Aliabad", "Gulmit", "Passu", "Attabad Lake"] },
  { city: "Skardu", country: "Pakistan", addresses: ["K2 Road", "Satpara Lake", "Shangrila", "Khaplu", "Kharpocho Fort"] },
  { city: "Swat", country: "Pakistan", addresses: ["Mingora", "Malam Jabba", "Kalam", "Bahrain", "Mahodand Lake"] },
  { city: "Multan", country: "Pakistan", addresses: ["Cantt", "Gulgasht", "Bosan Road", "Shah Rukn-e-Alam", "Abdali Road"] },
  { city: "Faisalabad", country: "Pakistan", addresses: ["D Ground", "Susan Road", "Canal Road", "Jinnah Colony", "Kohinoor City"] },
  { city: "Rawalpindi", country: "Pakistan", addresses: ["Saddar", "Bahria Town", "DHA Phase 1", "Satellite Town", "Peshawar Road"] },
  { city: "Peshawar", country: "Pakistan", addresses: ["University Town", "Hayatabad", "Saddar Road", "Ring Road", "Warsak Road"] },
  { city: "Quetta", country: "Pakistan", addresses: ["Jinnah Town", "Samungli Road", "Airport Road", "Brewery Road", "Hanna Lake"] },
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
  "Resort",
  "Serviced Apartment",
  "Backpacker Hostel",
  "Luxury Villa",
  "Seaside Inn",
];

const AMENITY_SNIPPETS = [
  "Free Wi-Fi, breakfast included, and parking on site.",
  "Air conditioning, room service, and 24-hour front desk.",
  "Kitchen access, laundry, and elevator available.",
  "Pool, restaurant, and gym for guest use.",
  "Balcony views, garden seating, and heater in winter.",
];

const DESCRIPTIONS = [
  "Spacious rooms with easy access to local attractions and transport links.",
  "Ideal for families and business travelers in a quiet neighborhood.",
  "Modern amenities, clean interiors, and a helpful on-site host.",
  "Perfect base for sightseeing near markets, cafes, and landmarks.",
  "Comfortable beds, hot water, and scenic surroundings for any stay length.",
  "Recently renovated with secure access and flexible check-in support.",
  "Cozy stay with local hospitality and peaceful surroundings.",
  "Central location suitable for couples, solo travelers, and small groups.",
];

const dateOffset = (days) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

const buildPropertyPayload = (sequence, ownerId) => {
  const cityMeta = CITIES[sequence % CITIES.length];
  const type = PROPERTY_TYPES[sequence % PROPERTY_TYPES.length];
  const address = cityMeta.addresses[sequence % cityMeta.addresses.length];
  const label = String(sequence + 1).padStart(4, "0");
  const title = `IARS Demo #${label} — ${type}, ${cityMeta.city}`;
  const amenity = AMENITY_SNIPPETS[sequence % AMENITY_SNIPPETS.length];
  const description = `${DESCRIPTIONS[sequence % DESCRIPTIONS.length]} ${amenity}`;
  const price = 4500 + (sequence % 40) * 1750 + (sequence % 7) * 350;
  const verificationStatus = sequence % 11 === 0 ? "pending" : "verified";
  const aiScore = verificationStatus === "verified" ? 0.86 + (sequence % 8) * 0.01 : 0.58;

  let status = "approved";
  if (!DEMO_MODE && sequence % 17 === 0) {
    status = "pending";
  } else if (DEMO_MODE && sequence % 50 === 0) {
    status = "pending";
  }

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
        url: `https://picsum.photos/seed/iars-demo-${sequence + 1}/800/600`,
        verificationStatus,
        aiScore: Math.min(aiScore, 0.99),
      },
      {
        url: `https://picsum.photos/seed/iars-demo-${sequence + 1}-b/800/600`,
        verificationStatus: sequence % 9 === 0 ? "pending" : "verified",
        aiScore: 0.9,
      },
    ],
    availabilityCalendar: [
      {
        startDate: dateOffset(sequence % 14),
        endDate: dateOffset(90 + (sequence % 120)),
      },
    ],
    status,
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

const insertInBatches = async (payloads) => {
  let inserted = 0;
  let approved = 0;
  let pending = 0;

  for (let start = 0; start < payloads.length; start += BATCH_SIZE) {
    const batch = payloads.slice(start, start + BATCH_SIZE);
    const created = await Property.insertMany(batch, { ordered: false });
    inserted += created.length;
    approved += created.filter((property) => property.status === "approved").length;
    pending += created.filter((property) => property.status === "pending").length;
    process.stdout.write(`\r  Inserted ${inserted}/${payloads.length}...`);
  }

  process.stdout.write("\n");
  return { inserted, approved, pending };
};

const seedProperties = async () => {
  console.log(`Seeding up to ${TARGET_COUNT} properties (demo mode: ${DEMO_MODE})...\n`);

  await connectDB();

  const owner = await ensureOwner();
  const existingCount = await Property.countDocuments({ owner: owner._id });
  const existingTitles = new Set(
    (await Property.find({ owner: owner._id }).select("title").lean()).map(
      (property) => property.title,
    ),
  );

  const payloads = [];
  let sequence = existingCount;

  while (payloads.length < TARGET_COUNT) {
    const payload = buildPropertyPayload(sequence, owner._id);
    sequence += 1;

    if (!existingTitles.has(payload.title)) {
      payloads.push(payload);
      existingTitles.add(payload.title);
    }

    if (sequence - existingCount > TARGET_COUNT * 3) {
      break;
    }
  }

  if (payloads.length === 0) {
    const total = await Property.countDocuments({ owner: owner._id });
    console.log(`  ✓ No new properties needed. Owner already has ${total} listing(s).`);
    process.exit(0);
    return;
  }

  const { inserted, approved, pending } = await insertInBatches(payloads);

  console.log(`  + Inserted ${inserted} properties for ${owner.email}`);
  console.log(`    • Approved: ${approved}`);
  console.log(`    • Pending:  ${pending}`);

  const totalApproved = await Property.countDocuments({ status: "approved" });
  const totalAll = await Property.countDocuments({});
  console.log(`\nTotal properties in database: ${totalAll}`);
  console.log(`Total approved properties: ${totalApproved}`);
  console.log("Done.\n");

  process.exit(0);
};

seedProperties().catch((error) => {
  console.error("Property seed failed:", error.message);
  process.exit(1);
});
