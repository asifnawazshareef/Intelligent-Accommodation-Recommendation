import dotenv from "dotenv";
import connectDB from "../config/db.js";
import User from "../models/User.js";
import Property from "../models/Property.js";

dotenv.config();

const SEED_USERS = [
  {
    envPrefix: "ADMIN",
    defaults: {
      name: "System Admin",
      email: "admin@gmail.com",
      password: "admin123",
      phone: "",
      role: "admin",
      languagePref: "en",
      isVerified: true,
    },
  },
  {
    envPrefix: "GUEST",
    defaults: {
      name: "Demo Guest",
      email: "guest@iars.com",
      password: "Guest@123456",
      phone: "03001234567",
      role: "guest",
      languagePref: "en",
      isVerified: true,
    },
  },
  {
    envPrefix: "OWNER",
    defaults: {
      name: "Demo Owner",
      email: "owner@iars.com",
      password: "Owner@123456",
      phone: "03007654321",
      role: "owner",
      languagePref: "en",
      isVerified: true,
    },
  },
];

const resolveUserConfig = ({ envPrefix, defaults }) => ({
  name: process.env[`${envPrefix}_NAME`] || defaults.name,
  email: (process.env[`${envPrefix}_EMAIL`] || defaults.email).toLowerCase().trim(),
  password: process.env[`${envPrefix}_PASSWORD`] || defaults.password,
  phone: process.env[`${envPrefix}_PHONE`] || defaults.phone,
  role: defaults.role,
  languagePref: process.env[`${envPrefix}_LANGUAGE`] || defaults.languagePref,
  isVerified: defaults.isVerified,
});

const upsertUser = async (config) => {
  const existing = await User.findOne({ email: config.email });

  if (existing) {
    console.log(`  ✓ ${config.role} already exists: ${existing.email}`);
    return existing;
  }

  if (config.role === "admin") {
    const existingAdmin = await User.findOne({ role: "admin" });

    if (existingAdmin) {
      existingAdmin.name = config.name;
      existingAdmin.email = config.email;
      existingAdmin.password = config.password;
      existingAdmin.phone = config.phone;
      existingAdmin.languagePref = config.languagePref;
      existingAdmin.isVerified = config.isVerified;
      await existingAdmin.save();
      console.log(`  ↻ Updated admin account: ${config.email}`);
      return existingAdmin;
    }
  }

  const user = await User.create(config);
  console.log(`  + Created ${config.role}: ${user.email}`);
  return user;
};

const seedSampleProperty = async (owner) => {
  const existing = await Property.findOne({ owner: owner._id });

  if (existing) {
    console.log(`  ✓ Property already exists for owner: ${existing.title}`);
    return existing;
  }

  const property = await Property.create({
    title: "Pearl Continental Demo Hotel",
    description:
      "A comfortable demo listing in Islamabad for testing search, booking, reviews, and sentiment analysis.",
    location: {
      address: "Club Road, G-5",
      city: "Islamabad",
      country: "Pakistan",
    },
    price: 15000,
    owner: owner._id,
    images: [
      {
        url: "https://picsum.photos/seed/iars-demo-hotel/800/600",
        verificationStatus: "verified",
        aiScore: 0.92,
      },
    ],
    availabilityCalendar: [
      {
        startDate: new Date().toISOString().slice(0, 10),
        endDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10),
      },
    ],
    status: "approved",
  });

  console.log(`  + Created approved property: ${property.title}`);
  return property;
};

const printCredentials = (users) => {
  console.log("\nLogin credentials (change passwords after first login):\n");
  console.log("┌─────────┬─────────────────────┬────────────────┐");
  console.log("│ Role    │ Email               │ Password       │");
  console.log("├─────────┼─────────────────────┼────────────────┤");

  users.forEach(({ role, email, password }) => {
    const roleCol = role.padEnd(7);
    const emailCol = email.padEnd(19);
    const passCol = password.padEnd(14);
    console.log(`│ ${roleCol} │ ${emailCol} │ ${passCol} │`);
  });

  console.log("└─────────┴─────────────────────┴────────────────┘\n");
  console.log("Login at: http://localhost:5173/login\n");
};

const seed = async () => {
  console.log("Starting database seed...\n");

  await connectDB();

  const createdUsers = [];

  console.log("Users:");
  for (const seedUser of SEED_USERS) {
    const config = resolveUserConfig(seedUser);
    const user = await upsertUser(config);
    createdUsers.push({
      role: config.role,
      email: config.email,
      password: config.password,
    });
  }

  const owner = await User.findOne({ email: resolveUserConfig(SEED_USERS[2]).email });

  if (owner) {
    console.log("\nSample property:");
    await seedSampleProperty(owner);
  }

  printCredentials(createdUsers);

  process.exit(0);
};

seed().catch((error) => {
  console.error("Seed failed:", error.message);
  process.exit(1);
});
