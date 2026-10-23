import "dotenv/config";
import mongoose from "mongoose";
import { requireWrite } from "../services/seed/store.js";
import User from "../models/User.js";
import { SeedRecord } from "../services/seed/models.js";
import { assert, safeError } from "../services/seed/config.js";
try {
  const id = process.argv[2];
  assert(
    mongoose.isValidObjectId(id),
    "Usage: npm run seed:grant ID_OF_EXISTING_ADMIN",
  );
  assert(process.env.MONGO_URI, "MONGO_URI is required.");
  await mongoose.connect(process.env.MONGO_URI);
  await requireWrite();
  const user = await User.findById(id);
  assert(user?.role === "admin", "Select an existing admin account.");
  assert(
    !(await SeedRecord.exists({ entity: "users", documentId: id })),
    "Seed accounts cannot receive this permission.",
  );
  user.isSuperAdmin = true;
  await user.save();
  console.log(
    `Super admin permission granted to account ${id}. Sign in again.`,
  );
} catch (e) {
  console.error(safeError(e));
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
