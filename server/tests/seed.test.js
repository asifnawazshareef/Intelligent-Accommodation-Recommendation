import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import express from "express";
import jwt from "jsonwebtoken";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { recipe } from "../services/seed/config.js";
import { buildDataset } from "../services/seed/generator.js";
import {
  initialize,
  models,
  transaction,
  saveRecord,
  validateDataset,
  saveGeneratedBatch,
} from "../services/seed/store.js";
import {
  createDataset,
  previewGeneration,
  startJob,
  previewBulk,
  executeBulk,
  queryRecords,
  csv,
} from "../services/seed/management.js";
import { runNextJob, controlJob } from "../services/seed/jobs.js";
import { SeedRecord } from "../services/seed/models.js";
import seedRoutes from "../routes/seedRoutes.js";
let repl, http, url, admin, ordinary, ds;
const config = {
  owners: 2,
  guests: 4,
  properties: 4,
  reviews: 8,
  seed: 99,
  referenceDate: "2026-10-01",
  approvedPercent: 100,
};
before(async () => {
  process.env.NODE_ENV = "test";
  process.env.SEED_DASHBOARD_ENABLED = "true";
  process.env.SEED_DATABASE_NAME = "seed_tests";
  process.env.SEED_DEMO_PASSWORD = "OnlyForDemo123!";
  process.env.JWT_SECRET = "local_test_secret_only";
  repl = await MongoMemoryReplSet.create({
    binary: { version: "7.0.14" },
    instanceOpts: [{ launchTimeout: 60000 }],
    replSet: {
      count: 1,
      args: [
        "--nounixsocket",
        "--setParameter",
        "diagnosticDataCollectionEnabled=false",
      ],
    },
  });
  await mongoose.connect(repl.getUri("seed_tests"));
  await initialize();
  admin = await models.users.create({
    name: "Operator",
    email: "operator@example.test",
    password: "OperatorPass123!",
    role: "admin",
    isSuperAdmin: true,
  });
  ordinary = await models.users.create({
    name: "Ordinary",
    email: "ordinary@example.test",
    password: "OperatorPass123!",
    role: "admin",
  });
  const app = express();
  app.use(express.json());
  app.use("/api/admin/seed", seedRoutes);
  app.use((e, req, res, next) =>
    res
      .status(res.statusCode >= 400 ? res.statusCode : 500)
      .json({ message: e.message }),
  );
  http = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => http.once("listening", resolve));
  url = `http://127.0.0.1:${http.address().port}/api/admin/seed`;
});
after(async () => {
  if (http) await new Promise((resolve) => http.close(resolve));
  await mongoose.disconnect();
  if (repl) await repl.stop();
});
const generate = async (kind = "generate") => {
  const p = await previewGeneration(ds._id, { recipe: config }, admin._id);
  const j = await startJob(
    ds._id,
    {
      kind,
      recipe: config,
      confirmation: p.confirmation,
      requestKey: crypto.randomUUID(),
    },
    admin._id,
  );
  const result = await runNextJob({ batchSize: 5 });
  assert.equal(String(result._id), String(j._id));
  assert.equal(result.state, "completed", result.error);
  return result;
};
test("fixed seed and date reproduce data; invalid configuration fails", () => {
  assert.deepEqual(
    buildDataset("test_set", config),
    buildDataset("test_set", config),
  );
  assert.throws(() => recipe({ ...config, owners: 0 }));
  assert.throws(() => recipe({ ...config, reviews: -1 }));
});
test("API rejects anonymous and ordinary admins", async () => {
  for (const who of [null, ordinary]) {
    const response = await fetch(`${url}/datasets`, {
      headers: who
        ? {
            Authorization: `Bearer ${jwt.sign({ id: who._id }, process.env.JWT_SECRET)}`,
          }
        : {},
    });
    assert.equal(response.status, who ? 403 : 401);
  }
  const response = await fetch(`${url}/capabilities`, {
    headers: {
      Authorization: `Bearer ${jwt.sign({ id: admin._id }, process.env.JWT_SECRET)}`,
    },
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).transactions, true);
});
test("generation creates valid relationships and passwords, preserving existing records", async () => {
  const before = await models.users.findById(ordinary._id).lean();
  ds = await createDataset(
    { name: "Test dataset", namespace: "test_dataset", recipe: config },
    admin._id,
  );
  await generate();
  const report = await validateDataset(ds._id);
  assert.equal(report.valid, true, JSON.stringify(report));
  assert.deepEqual(report.counts, {
    users: 6,
    properties: 4,
    bookings: 8,
    reviews: 8,
  });
  const booking = (await queryRecords(ds._id, "bookings")).records[0];
  const found = await queryRecords(ds._id, "bookings", {
    q: String(booking._id),
  });
  assert.equal(found.total, 1);
  assert.equal(String(found.records[0]._id), String(booking._id));
  const seed = await SeedRecord.findOne({ dataset: ds._id, entity: "users" });
  const user = await models.users.findById(seed.documentId).select("+password");
  assert.equal(await user.matchPassword(process.env.SEED_DEMO_PASSWORD), true);
  assert.deepEqual(await models.users.findById(ordinary._id).lean(), before);
});
test("repeated generation creates zero duplicates", async () => {
  const result = await generate();
  assert.equal(result.succeeded, 0);
  assert.equal(result.skipped, 26);
});
test("CRUD updates snapshots and rejects stale or unrelated IDs", async () => {
  const r = (await queryRecords(ds._id, "reviews")).records[0];
  const out = await transaction(() =>
    saveRecord(
      ds._id,
      "reviews",
      { rating: 1, text: "The room was dirty.", sentiment: "negative" },
      { id: r._id, revision: r.seedRevision, actor: admin._id },
    ),
  );
  assert.equal(out.rating, 1);
  assert.equal((await validateDataset(ds._id)).valid, true);
  await assert.rejects(() =>
    transaction(() =>
      saveRecord(
        ds._id,
        "reviews",
        { rating: 2 },
        { id: r._id, revision: r.seedRevision, actor: admin._id },
      ),
    ),
  );
  await assert.rejects(() =>
    transaction(() =>
      saveRecord(
        ds._id,
        "users",
        { name: "Bad" },
        { id: ordinary._id, revision: 0, actor: admin._id },
      ),
    ),
  );
});
test("bulk price preview is frozen and execution is idempotent", async () => {
  const p = (await queryRecords(ds._id, "properties")).records[0];
  const plan = await previewBulk(
    ds._id,
    {
      entity: "properties",
      action: "update",
      pricePercent: 10,
      selection: { ids: [String(p._id)] },
    },
    admin._id,
  );
  const job = await executeBulk(ds._id, { planId: plan._id }, admin._id);
  assert.equal(
    String((await executeBulk(ds._id, { planId: plan._id }, admin._id))._id),
    String(job._id),
  );
  assert.equal((await runNextJob()).state, "completed");
  assert.equal(
    (await models.properties.findById(p._id)).price,
    Math.round(p.price * 1.1),
  );
  assert.equal((await validateDataset(ds._id)).valid, true);
});
test("tombstones survive reruns and unrelated activity blocks deletion", async () => {
  const r = (await queryRecords(ds._id, "reviews")).records[0];
  const plan = await previewBulk(
    ds._id,
    {
      entity: "reviews",
      action: "delete",
      selection: { ids: [String(r._id)] },
    },
    admin._id,
  );
  await executeBulk(
    ds._id,
    { planId: plan._id, confirmName: ds.name },
    admin._id,
  );
  assert.equal((await runNextJob()).state, "completed");
  await generate();
  assert.equal(await models.reviews.findById(r._id), null);
  const p = (await queryRecords(ds._id, "properties")).records[0];
  const view = await models.views.create({
    user: ordinary._id,
    property: p._id,
  });
  await assert.rejects(
    () =>
      previewBulk(
        ds._id,
        {
          entity: "properties",
          action: "delete",
          cascade: true,
          selection: { ids: [String(p._id)] },
        },
        admin._id,
      ),
    /outside this seed dataset/,
  );
  await models.views.deleteOne({ _id: view._id });
});
test("cancellation and retry resume from a committed checkpoint", async () => {
  const p = await previewGeneration(ds._id, { recipe: config }, admin._id);
  const j = await startJob(
    ds._id,
    {
      kind: "append",
      recipe: config,
      confirmation: p.confirmation,
      requestKey: crypto.randomUUID(),
    },
    admin._id,
  );
  let requested = false;
  const stopped = await runNextJob({
    batchSize: 3,
    afterBatch: async () => {
      if (!requested) {
        requested = true;
        await controlJob(j._id, "cancel", admin._id);
      }
    },
  });
  assert.equal(stopped.state, "cancelled");
  assert.equal(stopped.cursor, 3);
  await controlJob(j._id, "retry", admin._id);
  const done = await runNextJob();
  assert.equal(done.state, "completed", done.error);
  assert.equal(done.succeeded, 26);
  assert.equal((await validateDataset(ds._id)).valid, true);
});
test("CSV escapes spreadsheet formulas and excludes passwords", () => {
  const output = csv([{ name: "=SUM(1,2)", password: "hidden" }]);
  assert.ok(output.includes("'=SUM"));
  assert.ok(!output.includes("hidden"));
});

test("batched generation rejects within-batch booking overlaps atomically", async () => {
  const property = (await queryRecords(ds._id, "properties")).records[0];
  const guest = (await queryRecords(ds._id, "users", { role: "guest" }))
    .records[0];
  const before = await SeedRecord.countDocuments({ dataset: ds._id });
  const ids = [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()];
  const items = ids.map((id, i) => ({
    entity: "bookings",
    key: `overlap_test:${i}`,
    rate: property.price,
    payload: {
      _id: id,
      guest: guest._id,
      property: property._id,
      startDate: "2026-12-01",
      endDate: "2026-12-03",
      guests: 1,
      status: "confirmed",
      paymentStatus: "confirmed",
    },
  }));
  await assert.rejects(
    () =>
      transaction(() =>
        saveGeneratedBatch(ds._id, items, { actor: admin._id }),
      ),
    /already has a booking/,
  );
  assert.equal(await models.bookings.countDocuments({ _id: { $in: ids } }), 0);
  assert.equal(await SeedRecord.countDocuments({ dataset: ds._id }), before);
});

test("cancelled historical bookings remain valid after a property is rejected", async () => {
  const owner = (await queryRecords(ds._id, "users", { role: "owner" }))
    .records[0];
  const guest = (await queryRecords(ds._id, "users", { role: "guest" }))
    .records[0];
  const property = await transaction(() =>
    saveRecord(
      ds._id,
      "properties",
      {
        title: "Cancelled stay example",
        description: "A demo property with a historical cancelled booking",
        location: {
          address: "Example street",
          city: "Lahore",
          country: "Pakistan",
        },
        price: 5000,
        owner: String(owner._id),
        images: [{ url: "/seed/property.svg", verificationStatus: "verified" }],
        availabilityCalendar: [],
        status: "approved",
      },
      { actor: admin._id },
    ),
  );
  const booking = await transaction(() =>
    saveRecord(
      ds._id,
      "bookings",
      {
        guest: String(guest._id),
        property: String(property._id),
        startDate: "2026-09-01",
        endDate: "2026-09-03",
        guests: 1,
        status: "cancelled",
        paymentStatus: "pending",
      },
      { actor: admin._id },
    ),
  );
  await transaction(() =>
    saveRecord(
      ds._id,
      "properties",
      { status: "rejected", availabilityCalendar: [] },
      { id: property._id, revision: property.seedRevision, actor: admin._id },
    ),
  );
  const report = await validateDataset(ds._id);
  assert.equal(report.valid, true, JSON.stringify(report));
  await assert.rejects(
    () =>
      transaction(() =>
        saveRecord(
          ds._id,
          "bookings",
          { status: "pending" },
          { id: booking._id, revision: booking.seedRevision, actor: admin._id },
        ),
      ),
    /approved property/,
  );
});

test("bulk create rejects duplicate users and overlapping bookings in preview", async () => {
  const email = "duplicate.bulk@example.test";
  await assert.rejects(
    () =>
      previewBulk(
        ds._id,
        {
          entity: "users",
          action: "create",
          records: [
            { name: "First", email, role: "guest" },
            { name: "Second", email: email.toUpperCase(), role: "guest" },
          ],
        },
        admin._id,
      ),
    /Duplicate email/,
  );
  assert.equal(await models.users.countDocuments({ email }), 0);
  const guest = (await queryRecords(ds._id, "users", { role: "guest" }))
    .records[0];
  await assert.rejects(
    () =>
      previewBulk(
        ds._id,
        {
          entity: "users",
          action: "create",
          records: [
            {
              name: "Unused guest",
              email: "unused.bulk@example.test",
              role: "guest",
            },
            { name: "Already exists", email: guest.email, role: "guest" },
          ],
        },
        admin._id,
      ),
    /already uses an email/,
  );
  assert.equal(
    await models.users.countDocuments({ email: "unused.bulk@example.test" }),
    0,
  );
  const property = (
    await queryRecords(ds._id, "properties", { status: "approved" })
  ).records[0];
  await assert.rejects(
    () =>
      previewBulk(
        ds._id,
        {
          entity: "bookings",
          action: "create",
          records: [
            {
              guest: String(guest._id),
              property: String(property._id),
              startDate: "2026-12-01",
              endDate: "2026-12-04",
              guests: 1,
              status: "pending",
              paymentStatus: "pending",
            },
            {
              guest: String(guest._id),
              property: String(property._id),
              startDate: "2026-12-03",
              endDate: "2026-12-05",
              guests: 1,
              status: "pending",
              paymentStatus: "pending",
            },
          ],
        },
        admin._id,
      ),
    /overlapping bookings/,
  );
  assert.equal(
    await models.bookings.countDocuments({
      property: property._id,
      startDate: "2026-12-01",
    }),
    0,
  );
});

test("default pending bookings cannot overlap an existing stay", async () => {
  const guest = (await queryRecords(ds._id, "users", { role: "guest" }))
    .records[0];
  const property = (
    await queryRecords(ds._id, "properties", { status: "approved" })
  ).records[0];
  const first = await transaction(() =>
    saveRecord(
      ds._id,
      "bookings",
      {
        guest: String(guest._id),
        property: String(property._id),
        startDate: "2026-12-01",
        endDate: "2026-12-04",
        guests: 1,
      },
      { actor: admin._id },
    ),
  );
  assert.equal(first.status, "pending");
  assert.equal(first.paymentStatus, "pending");
  await assert.rejects(
    () =>
      transaction(() =>
        saveRecord(
          ds._id,
          "bookings",
          {
            guest: String(guest._id),
            property: String(property._id),
            startDate: "2026-12-03",
            endDate: "2026-12-05",
            guests: 1,
          },
          { actor: admin._id },
        ),
      ),
    /already has a booking/,
  );
  assert.equal((await validateDataset(ds._id)).valid, true);
});

test("bulk review preview rejects two reviews for the same booking", async () => {
  const guest = (await queryRecords(ds._id, "users", { role: "guest" }))
    .records[0];
  const property = (await queryRecords(ds._id, "properties", { status: "approved" }))
    .records[0];
  const booking = await transaction(() =>
    saveRecord(
      ds._id,
      "bookings",
      {
        guest: String(guest._id),
        property: String(property._id),
        startDate: "2026-12-10",
        endDate: "2026-12-12",
        guests: 1,
        status: "confirmed",
        paymentStatus: "confirmed",
      },
      { actor: admin._id },
    ),
  );
  await assert.rejects(
    () =>
      previewBulk(
        ds._id,
        {
          entity: "reviews",
          action: "create",
          records: [
            {
              booking: String(booking._id),
              text: "A pleasant stay",
              rating: 4,
              sentiment: "positive",
            },
            {
              booking: String(booking._id),
              text: "A good visit",
              rating: 4,
              sentiment: "positive",
            },
          ],
        },
        admin._id,
      ),
    /only one review/,
  );
  assert.equal(
    await models.reviews.countDocuments({ booking: booking._id }),
    0,
  );
  assert.equal((await validateDataset(ds._id)).valid, true);
});

test('Pakistani catalog persists credits, supports edits and reruns, and blocks duplicate appends', async () => {
  const { presets } = await import('../services/seed/config.js');
  const catalog = await createDataset({ name: 'Real Pakistani demo', namespace: 'pakistan_demo', recipe: presets.pakistan }, admin._id);
  const preview = await previewGeneration(catalog._id, {}, admin._id);
  const enqueue = async (kind, confirmation) => startJob(catalog._id, {
    kind, recipe: preview.recipe, confirmation, requestKey: crypto.randomUUID(),
  }, admin._id);
  const job = await enqueue('generate', preview.confirmation);
  assert.equal((await runNextJob({ jobId: job._id, batchSize: 10 })).state, 'completed');
  const list = await queryRecords(catalog._id, 'properties', {});
  assert.equal(list.total, 6);
  for (const property of list.records) {
    assert.ok(property.seedCatalog.sourceUrl.startsWith('https://'));
    assert.ok(property.images.length >= 2 && property.images.length <= 5);
    assert.ok(property.images.every(image => image.credit.author && image.credit.licenseUrl));
  }
  const property = list.records[0];
  await transaction(() => saveRecord(catalog._id, 'properties', { price: property.price + 100 },
    { id: property._id, revision: property.seedRevision, actor: admin._id }));
  assert.equal((await validateDataset(catalog._id)).valid, true);
  // Initial generation is still idempotent and preserves manual edits.
  const rerun = await previewGeneration(catalog._id, {}, admin._id);
  const repeat = await enqueue('generate', rerun.confirmation);
  assert.equal((await runNextJob({ jobId: repeat._id, batchSize: 10 })).state, 'completed');
  assert.equal((await models.properties.findById(property._id)).price, property.price + 100);
  await assert.rejects(() => previewGeneration(catalog._id, { kind: 'append' }, admin._id), /already exist/);
  // A caller cannot bypass the duplicate check with a preview for initial generation.
  await assert.rejects(() => enqueue('append', rerun.confirmation), /already exist/);
});
