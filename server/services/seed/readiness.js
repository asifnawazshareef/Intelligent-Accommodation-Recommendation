import mongoose from "mongoose";
import User from "../../models/User.js";
import { collectedCatalogStatus } from "./pakistanCatalog.js";

// Read only. Never initialize collections, grant privileges or print connection strings.
export async function checkSeedSetup({ env = process.env, connection = mongoose.connection, users = User } = {}) {
  const checks = [];
  const add = (code, ok, message) => checks.push({ code, ok: Boolean(ok), message });
  add("environment", env.NODE_ENV !== "production", "Seeding requires a nonproduction environment.");
  add("enabled", env.SEED_DASHBOARD_ENABLED === "true", "Set SEED_DASHBOARD_ENABLED=true in server/.env.");
  const connected = connection.readyState === 1;
  add("connection", connected, connected ? "MongoDB is connected." : "Cannot connect. Check MONGO_URI and start MongoDB.");
  add("database", connected && Boolean(env.SEED_DATABASE_NAME) && env.SEED_DATABASE_NAME === connection.name,
    "The database in MONGO_URI must exactly match SEED_DATABASE_NAME.");
  let transactions = false;
  if (connected) {
    try { const hello = await connection.db.admin().command({ hello: 1 }); transactions = Boolean(hello.setName || hello.msg === "isdbgrid"); }
    catch { /* Report the failed check without exposing driver credentials or host details. */ }
  }
  add("transactions", transactions, "MongoDB transactions require an initialized replica set, such as rs0, or a sharded cluster.");
  const password = env.SEED_DEMO_PASSWORD;
  add("demoPassword", typeof password === "string" && password.length >= 10 && Buffer.byteLength(password, "utf8") <= 72,
    "Set SEED_DEMO_PASSWORD to at least 10 characters and at most 72 UTF8 bytes.");
  const batch = Number(env.SEED_BATCH_SIZE || 25);
  add("batchSize", Number.isInteger(batch) && batch >= 1 && batch <= 100, "SEED_BATCH_SIZE must be an integer from 1 to 100.");
  let admin = false;
  if (connected) {
    try { admin = Boolean(await users.exists({ role: "admin", isSuperAdmin: true })); }
    catch { /* A failed read is not evidence of readiness. */ }
  }
  add("superAdmin", admin, "An admin must have isSuperAdmin=true. Use seed:admin, then seed:grant with the existing admin ID.");
  const catalog = collectedCatalogStatus();
  return { ready: checks.every(c => c.ok), checks, catalog: {
    available: catalog.available, target: catalog.target, remaining: Math.max(0, catalog.target - catalog.available),
    images: catalog.images, sources: catalog.sources, ready: catalog.ready,
  },
    worker: "Run npm.cmd run seed:worker in a separate server terminal. This check does not verify a live worker." };
}
