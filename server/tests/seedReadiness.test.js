import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { devNull } from "node:os";
import { fileURLToPath } from "node:url";
import { checkSeedSetup } from "../services/seed/readiness.js";

const env = { NODE_ENV: "test", SEED_DASHBOARD_ENABLED: "true", SEED_DATABASE_NAME: "demo_test", SEED_DEMO_PASSWORD: "LocalDemoOnly123!", SEED_BATCH_SIZE: "25" };
const connection = { readyState: 1, name: "demo_test", db: { admin: () => ({ command: async () => ({ setName: "rs0" }) }) } };
const users = { exists: async () => ({ _id: "operator" }) };

test("setup readiness reports each blocking condition and never exposes secrets", async () => {
  assert.equal((await checkSeedSetup({ env, connection, users })).ready, true);
  const bad = await checkSeedSetup({ env: { ...env, NODE_ENV: "production", SEED_DASHBOARD_ENABLED: "false", SEED_DATABASE_NAME: "other", SEED_DEMO_PASSWORD: "short", SEED_BATCH_SIZE: "101", MONGO_URI: "mongodb://user:TOP_SECRET@host/db" }, connection: { ...connection, db: { admin: () => ({ command: async () => { throw new Error("TOP_SECRET"); } }) } }, users: { exists: async () => null } });
  assert.equal(bad.ready, false);
  assert.deepEqual(bad.checks.filter(c => !c.ok).map(c => c.code), ["environment", "enabled", "database", "transactions", "demoPassword", "batchSize", "superAdmin"]);
  assert.equal(JSON.stringify(bad).includes("TOP_SECRET"), false);
  const disconnected = await checkSeedSetup({ env, connection: { readyState: 0 }, users: { exists: async () => { throw new Error("Must not query"); } } });
  assert.equal(disconnected.ready, false);
  assert.equal(disconnected.checks.find(c => c.code === "connection").ok, false);
});

test("Windows setup command returns a useful report and exit code without printing an invalid URI", async () => {
  let result;
  try { await promisify(execFile)(process.execPath, [fileURLToPath(new URL("../scripts/checkSeedSetup.js", import.meta.url))], {
    env: { ...process.env, ...env, DOTENV_CONFIG_PATH: devNull, MONGO_URI: "invalid://username:TOP_SECRET@host/db" }, timeout: 15000,
  }); } catch (error) { result = error; }
  assert.equal(result?.code, 1);
  assert.equal(result.stderr, "");
  const report = JSON.parse(result.stdout);
  assert.equal(report.ready, false);
  assert.equal(report.checks.find(c => c.code === "connection").ok, false);
  assert.equal(result.stdout.includes("TOP_SECRET"), false);
});
