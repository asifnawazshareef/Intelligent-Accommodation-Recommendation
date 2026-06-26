import dotenv from "dotenv";
import connectDB from "../config/db.js";
import User from "../models/User.js";

dotenv.config();

const seedAdmin = async () => {
  const name = process.env.ADMIN_NAME || "System Admin";
  const email = process.env.ADMIN_EMAIL || "admin@iars.com";
  const password = process.env.ADMIN_PASSWORD || "Admin@123456";
  const phone = process.env.ADMIN_PHONE || "";

  await connectDB();

  const existingAdmin = await User.findOne({ role: "admin" });

  if (existingAdmin) {
    console.log(`Admin already exists: ${existingAdmin.email}`);
    process.exit(0);
  }

  const emailTaken = await User.findOne({ email: email.toLowerCase() });

  if (emailTaken) {
    console.error(
      `Cannot seed admin. Email ${email} is already used by a ${emailTaken.role} account.`,
    );
    process.exit(1);
  }

  await User.create({
    name,
    email,
    password,
    phone,
    role: "admin",
    languagePref: "en",
    isVerified: true,
  });

  console.log("Admin user created successfully");
  console.log(`Email: ${email}`);
  console.log("Change the default password after first login.");

  process.exit(0);
};

seedAdmin().catch((error) => {
  console.error("Admin seed failed:", error.message);
  process.exit(1);
});
