import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import express from "express";
import jwt from "jsonwebtoken";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import {
  initialize,
  models,
  transaction,
  saveRecord,
  validateDataset,
} from "../services/seed/store.js";
import {
  createDataset,
  previewGeneration,
  startJob,
  previewBulk,
  executeBulk,
  queryRecords,
  previewCleanup,
  startCleanup,
} from "../services/seed/management.js";
import { runNextJob, controlJob } from "../services/seed/jobs.js";
import { SeedRecord, SeedJob, SeedDataset } from "../services/seed/models.js";
import { seedAppGuard } from "../services/seed/appGuard.js";
import seedRoutes from "../routes/seedRoutes.js";
import authRoutes from "../routes/authRoutes.js";
import propertyRoutes from "../routes/propertyRoutes.js";
import bookingRoutes from "../routes/bookingRoutes.js";
import reviewRoutes from "../routes/reviewRoutes.js";
import searchRoutes from "../routes/searchRoutes.js";
import adminRoutes from "../routes/adminRoutes.js";
import { errorHandler } from "../middleware/errorMiddleware.js";
let repl, http, sentimentHttp, url, admin, ordinary, ds;
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
  Object.assign(process.env, {
    NODE_ENV: "test",
    SEED_DASHBOARD_ENABLED: "true",
    SEED_DATABASE_NAME: "seed_app_tests",
    SEED_DEMO_PASSWORD: "OnlyForDemo123!",
    JWT_SECRET: "local_test_secret_only",
  });
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
  await mongoose.connect(repl.getUri("seed_app_tests"));
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
  const sentiment = express();
  sentiment.get("/health", (req, res) => res.json({ status: "running", model: "Test classifier", modelVersion: "test-v1" }));
  sentiment.post("/predict", (req, res) =>
    res.json({
      sentiment: "positive",
      confidence: 0.8,
      aspects: [],
      aspectInsights: [],
      summary: "Test service result",
    }),
  );
  sentimentHttp = sentiment.listen(0, "127.0.0.1");
  await new Promise((r) => sentimentHttp.once("listening", r));
  process.env.SENTIMENT_API_URL = `http://127.0.0.1:${sentimentHttp.address().port}`;
  const app = express();
  app.use(express.json());
  app.use(seedAppGuard);
  app.use("/api/admin/seed", seedRoutes);
  app.use("/api/auth", authRoutes);
  app.use("/api/properties", propertyRoutes);
  app.use("/api/bookings", bookingRoutes);
  app.use("/api/reviews", reviewRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api", searchRoutes);
  app.use(errorHandler);
  http = app.listen(0, "127.0.0.1");
  await new Promise((r) => http.once("listening", r));
  url = `http://127.0.0.1:${http.address().port}/api`;
  ds = await createDataset(
    { name: "App tests", namespace: "app_tests", recipe: config },
    admin._id,
  );
  const preview = await previewGeneration(
    ds._id,
    { recipe: config },
    admin._id,
  );
  const job = await startJob(
    ds._id,
    {
      kind: "generate",
      recipe: config,
      confirmation: preview.confirmation,
      requestKey: crypto.randomUUID(),
    },
    admin._id,
  );
  const result = await runNextJob({ jobId: job._id });
  assert.equal(result.state, "completed", result.error);
});
after(async () => {
  if (http) await new Promise((r) => http.close(r));
  if (sentimentHttp) await new Promise((r) => sentimentHttp.close(r));
  await mongoose.disconnect();
  if (repl) await repl.stop();
});
const api = async (path, who = admin, method = "GET", body) => {
  const response = await fetch(url + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(who && {
        Authorization: `Bearer ${jwt.sign({ id: who._id }, process.env.JWT_SECRET)}`,
      }),
    },
    ...(body && { body: JSON.stringify(body) }),
  });
  return { status: response.status, body: await response.json() };
};
const ok = (r, status = 200) => {
  assert.equal(r.status, status, JSON.stringify(r.body));
  return r.body;
};

test("sentiment dashboard reports model health and pending counts only to super admins", async () => {
  const path = `/admin/seed/datasets/${ds._id}/sentiment`;
  assert.equal((await api(path, null)).status, 401);
  assert.equal((await api(path, ordinary)).status, 403);
  const status = ok(await api(path));
  assert.equal(status.service.available, true);
  assert.equal(status.service.modelVersion, "test-v1");
  assert.equal(status.total, 8); assert.equal(status.pending, 8); assert.equal(status.analyzed, 0);
  assert.equal(ok(await api("/admin/seed/sentiment")).service.available, true);
});

test("existing login, search, recommendations, owner lists, booking, payment and review work with seed records", async () => {
  const guest = (await queryRecords(ds._id, "users", { role: "guest" }))
    .records[0];
  const property = (await queryRecords(ds._id, "properties")).records[0];
  const login = ok(
    await api("/auth/login", null, "POST", {
      email: guest.email,
      password: process.env.SEED_DEMO_PASSWORD,
    }),
  );
  assert.ok(login.token);
  assert.equal(login.user.isSuperAdmin, false);
  const owner = await models.users.findById(property.owner);
  assert.ok(ok(await api("/properties/owner/my-properties", owner)).count > 0);
  assert.ok(
    ok(
      await api(
        "/search?city=" + encodeURIComponent(property.location.city),
        guest,
      ),
    ).count > 0,
  );
  assert.equal(
    await SeedRecord.countDocuments({
      dataset: ds._id,
      entity: "searches",
      state: "active",
    }),
    1,
  );
  ok(await api("/recommendations", guest));
  const start = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10),
    end = new Date(Date.now() + 13 * 86400000).toISOString().slice(0, 10);
  const booking = ok(
    await api("/bookings", guest, "POST", {
      property: property._id,
      startDate: start,
      endDate: end,
      guests: 2,
    }),
    201,
  ).data;
  const meta = await SeedRecord.findOne({
    entity: "bookings",
    documentId: booking._id,
  });
  assert.equal(meta.origin, "interaction");
  assert.equal(meta.rate, property.price);
  const duplicate = await api("/bookings", guest, "POST", {
    property: property._id,
    startDate: start,
    endDate: end,
    guests: 2,
  });
  assert.equal(duplicate.status, 400);
  assert.equal(duplicate.body.code, "BOOKING_ALREADY_EXISTS");
  ok(
    await api(
      `/bookings/${booking._id}/confirm-demo-payment`,
      guest,
      "PUT",
      {},
    ),
  );
  const priorService = process.env.SENTIMENT_API_URL;
  try {
    process.env.SENTIMENT_API_URL = "http://127.0.0.1:1";
    const failed = await api("/reviews", guest, "POST", { property: property._id, booking: booking._id, rating: 5, text: "A clean and comfortable stay." });
    assert.equal(failed.status, 503);
    assert.equal(await models.reviews.exists({ booking: booking._id }), null);
  } finally { process.env.SENTIMENT_API_URL = priorService; }
  const review = ok(
    await api("/reviews", guest, "POST", {
      property: property._id,
      booking: booking._id,
      rating: 5,
      text: "A clean and comfortable stay.",
    }),
    201,
  ).data;
  assert.equal(review.sentimentAnalysis.source, "model");
  assert.equal(review.sentimentAnalysis.status, "completed");
  assert.ok(
    await SeedRecord.exists({
      entity: "reviews",
      documentId: review._id,
      origin: "interaction",
    }),
  );
  const report = await validateDataset(ds._id);
  assert.equal(report.valid, true, JSON.stringify(report));
  assert.equal(
    (
      await api(`/admin/users/${guest._id}/role`, ordinary, "PUT", {
        role: "admin",
      })
    ).status,
    403,
  );
});
test("search remains available while a seed job runs and resumes tracking afterward", async () => {
  const guest = (await queryRecords(ds._id, "users", { role: "guest" })).records[0];
  const before = await models.searches.countDocuments({ user: guest._id });
  const queued = await new SeedJob({ dataset: ds._id, actor: admin._id, kind: "generate", state: "running", requestKey: crypto.randomUUID(), total: 1 }).save();
  try {
    const result = await api("/search?city=Gilgit", guest);
    assert.equal(result.status, 200, JSON.stringify(result.body));
    assert.ok(Array.isArray(result.body.data));
    assert.equal(await models.searches.countDocuments({ user: guest._id }), before);
  } finally { await SeedJob.deleteOne({ _id: queued._id }); }
  ok(await api("/search?city=Gilgit", guest));
  assert.equal(await models.searches.countDocuments({ user: guest._id }), before + 1);
});
test("ordinary search history pruning preserves valid seed tracking", async () => {
  const guest = (await queryRecords(ds._id, "users", { role: "guest" }))
    .records[0];
  for (let i = 0; i < 21; i++)
    ok(await api(`/search?city=Islamabad&maxPrice=${10000 + i}`, guest));
  assert.equal(await models.searches.countDocuments({ user: guest._id }), 20);
  const report = await validateDataset(ds._id);
  assert.equal(report.valid, true, JSON.stringify(report));
});
test("all entity CRUD and related deletion are available through the API", async () => {
  const data = ok(
    await api("/admin/seed/datasets", admin, "POST", {
      name: "CRUD demo",
      namespace: "crud_demo",
      recipe: config,
    }),
    201,
  );
  const base = `/admin/seed/datasets/${data._id}`;
  const owner = ok(
    await api(base + "/users", admin, "POST", {
      name: "New owner",
      email: "crud.owner@example.test",
      role: "owner",
    }),
    201,
  );
  const guest = ok(
    await api(base + "/users", admin, "POST", {
      name: "New guest",
      email: "crud.guest@example.test",
      role: "guest",
    }),
    201,
  );
  ok(
    await api(base + `/users/${guest._id}`, admin, "PATCH", {
      revision: guest.seedRevision,
      patch: { name: "Updated guest" },
    }),
  );
  const property = ok(
    await api(base + "/properties", admin, "POST", {
      title: "Demo house",
      description: "A comfortable test property",
      owner: owner._id,
      price: 3000,
      location: {
        city: "Lahore",
        address: "Example street",
        country: "Pakistan",
      },
      images: [{ url: "/seed/property.svg", verificationStatus: "verified" }],
      availabilityCalendar: [],
      status: "approved",
    }),
    201,
  );
  ok(
    await api(base + `/properties/${property._id}`, admin, "PATCH", {
      revision: property.seedRevision,
      patch: { price: 4000 },
    }),
  );
  const booking = ok(
    await api(base + "/bookings", admin, "POST", {
      guest: guest._id,
      property: property._id,
      startDate: "2026-09-01",
      endDate: "2026-09-03",
      guests: 2,
      status: "confirmed",
      paymentStatus: "confirmed",
    }),
    201,
  );
  assert.equal(booking.totalAmount, 8000);
  const review = ok(
    await api(base + "/reviews", admin, "POST", {
      booking: booking._id,
      rating: 4,
      text: "A comfortable room",
      sentiment: "positive",
    }),
    201,
  );
  ok(
    await api(base + `/bookings/${booking._id}`, admin, "PATCH", {
      revision: booking.seedRevision,
      patch: { guests: 3 },
    }),
  );
  const loaded = ok(await api(base + `/reviews/${review._id}`));
  ok(
    await api(base + `/reviews/${review._id}`, admin, "PATCH", {
      revision: loaded.seedRevision,
      patch: { rating: 5 },
    }),
  );
  const savedGuest = ok(await api(base + `/users/${guest._id}`));
  ok(
    await api(base + `/users/${guest._id}/password`, admin, "POST", {
      revision: savedGuest.seedRevision,
      password: "NewDemoPass123!",
    }),
  );
  assert.ok(
    ok(
      await api("/auth/login", null, "POST", {
        email: guest.email,
        password: "NewDemoPass123!",
      }),
    ).token,
  );
  const exported = ok(
    await api(base + "/export", admin, "POST", {
      entity: "all",
      format: "json",
    }),
  );
  assert.equal(exported.reviews.length, 1);
  assert.ok(!JSON.stringify(exported).includes("password"));
  const plan = ok(
    await api(base + "/bulk/preview", admin, "POST", {
      entity: "all",
      action: "delete",
      selection: { all: true },
      cascade: true,
    }),
  );
  assert.equal(plan.count, 5);
  assert.equal(
    (
      await api(base + "/bulk/execute", admin, "POST", {
        planId: plan._id,
        confirmName: "wrong",
      })
    ).status,
    400,
  );
  const job = ok(
    await api(base + "/bulk/execute", admin, "POST", {
      planId: plan._id,
      confirmName: data.name,
    }),
    202,
  );
  const result = await runNextJob({ jobId: job._id, batchSize: 2 });
  assert.equal(result.state, "completed", result.error);
  assert.equal(
    await SeedRecord.countDocuments({ dataset: data._id, state: "active" }),
    0,
  );
  assert.ok(await models.users.findById(ordinary._id));
});
test("bulk create, regeneration and analysis retain valid relationships", async () => {
  const plan = await previewBulk(
    ds._id,
    {
      entity: "users",
      action: "create",
      records: [
        { name: "Bulk guest", email: "bulk.guest@example.test", role: "guest" },
      ],
    },
    admin._id,
  );
  await executeBulk(ds._id, { planId: plan._id }, admin._id);
  assert.equal((await runNextJob()).state, "completed");
  const review = (await queryRecords(ds._id, "reviews")).records[0];
  for (const action of ["regenerate", "analyze"]) {
    const p = await previewBulk(
      ds._id,
      { entity: "reviews", action, selection: { ids: [String(review._id)] } },
      admin._id,
    );
    await executeBulk(ds._id, { planId: p._id }, admin._id);
    const result = await runNextJob();
    assert.equal(result.state, "completed", result.error);
  }
  assert.equal(
    (await models.reviews.findById(review._id)).summary,
    "Test service result",
  );
  assert.equal((await validateDataset(ds._id)).valid, true);
});
test("stale plans and privilege revocation prevent changes", async () => {
  const user = (await queryRecords(ds._id, "users")).records[0];
  const plan = await previewBulk(
    ds._id,
    {
      entity: "users",
      action: "update",
      patch: { isVerified: true },
      selection: { ids: [String(user._id)] },
    },
    admin._id,
  );
  await transaction(() =>
    saveRecord(
      ds._id,
      "users",
      { name: "Changed after preview" },
      { id: user._id, revision: user.seedRevision, actor: admin._id },
    ),
  );
  await assert.rejects(
    () => executeBulk(ds._id, { planId: plan._id }, admin._id),
    /dataset changed/,
  );
  const job = await startJob(
    ds._id,
    { kind: "validate", requestKey: crypto.randomUUID() },
    admin._id,
  );
  await models.users.updateOne(
    { _id: admin._id },
    { $set: { isSuperAdmin: false } },
  );
  assert.equal((await api("/admin/seed/datasets")).status, 403);
  const result = await runNextJob({ jobId: job._id });
  assert.equal(result.state, "failed");
  assert.equal(result.cursor, 0);
  await models.users.updateOne(
    { _id: admin._id },
    { $set: { isSuperAdmin: true } },
  );
});
test("expired leases preserve cancellation and competing workers claim only once", async () => {
  const cancelled = await startJob(
    ds._id,
    { kind: "validate", requestKey: crypto.randomUUID() },
    admin._id,
  );
  await SeedJob.updateOne(
    { _id: cancelled._id },
    {
      $set: {
        state: "cancel_requested",
        leaseUntil: new Date(0),
        leaseOwner: "dead_worker",
      },
    },
  );
  const stopped = await runNextJob({ jobId: cancelled._id });
  assert.equal(stopped.state, "cancelled");
  assert.equal(stopped.cursor, 0);
  const job = await startJob(
    ds._id,
    { kind: "validate", requestKey: crypto.randomUUID() },
    admin._id,
  );
  const results = await Promise.all([
    runNextJob({ jobId: job._id, batchSize: 4 }),
    runNextJob({ jobId: job._id, batchSize: 4 }),
  ]);
  assert.equal(results.filter(Boolean).length, 1);
  const result = results.find(Boolean);
  assert.equal(result.state, "completed", result.error);
  assert.equal(result.report.valid, true, JSON.stringify(result.report));
  assert.equal(result.cursor, result.total);
});
test("production and database mismatches disable writes", async () => {
  const name = process.env.SEED_DATABASE_NAME;
  process.env.SEED_DATABASE_NAME = "other_database";
  assert.equal((await api("/admin/seed/datasets")).status, 403);
  await assert.rejects(() => transaction(() => Promise.resolve()));
  process.env.SEED_DATABASE_NAME = name;
  process.env.NODE_ENV = "production";
  assert.equal((await api("/admin/seed/datasets")).status, 403);
  process.env.NODE_ENV = "test";
  process.env.SEED_DASHBOARD_ENABLED = "false";
  assert.equal((await api("/admin/seed/datasets")).status, 403);
  ok(await api("/properties", null));
  process.env.SEED_DASHBOARD_ENABLED = "true";
});
test("removing an old seed dataset deletes its tracked records and hides its name", async () => {
  const old = await createDataset(
    { name: "Old demo", namespace: `old_demo_${crypto.randomUUID().slice(0, 8)}`, recipe: config },
    admin._id,
  );
  const generation = await previewGeneration(old._id, { recipe: config }, admin._id);
  const job = await startJob(old._id, {
    kind: "generate", recipe: config, confirmation: generation.confirmation,
    requestKey: crypto.randomUUID(),
  }, admin._id);
  assert.equal((await runNextJob({ jobId: job._id })).state, "completed");
  const ids = await SeedRecord.find({ dataset: old._id, state: "active" }).lean();
  assert.ok(ids.length > 0);
  const deletion = ok(await api(`/admin/seed/datasets/${old._id}/cleanup/preview`, admin, "POST"));
  assert.equal(deletion.count, ids.length);
  const cleanup = ok(await api(`/admin/seed/datasets/${old._id}/cleanup/execute`, admin, "POST", {
    confirmation: deletion.confirmation, confirmName: old.name, requestKey: crypto.randomUUID(),
  }), 202);
  const result = await runNextJob({ jobId: cleanup._id, batchSize: 4 });
  assert.equal(result.state, "completed", result.error);
  assert.equal(await SeedRecord.countDocuments({ dataset: old._id, state: "active" }), 0);
  for (const item of ids) assert.equal(await models[item.entity].findById(item.documentId), null);
  assert.ok((await SeedDataset.findById(old._id)).archivedAt);
  assert.ok(!ok(await api("/admin/seed/datasets")).some(d => d._id === String(old._id)));
  assert.equal((await api(`/admin/seed/datasets/${old._id}/users`)).status, 404);
  assert.ok(await models.users.findById(admin._id));
  assert.ok(await SeedRecord.exists({ dataset: ds._id, state: "active" }));
});
test("cleanup preflight blocks outside activity before deleting any records and can be retried", async () => {
  const old = await createDataset({ name: "Old with activity", namespace: `old_${crypto.randomUUID().slice(0, 8)}`, recipe: config }, admin._id);
  const generation = await previewGeneration(old._id, { recipe: config }, admin._id);
  const job = await startJob(old._id, { kind: "generate", recipe: config, confirmation: generation.confirmation, requestKey: crypto.randomUUID() }, admin._id);
  assert.equal((await runNextJob({ jobId: job._id })).state, "completed");
  const property = await SeedRecord.findOne({ dataset: old._id, entity: "properties", state: "active" });
  const outside = await models.views.create({ user: admin._id, property: property.documentId });
  const before = await SeedRecord.countDocuments({ dataset: old._id, state: "active" });
  const preview = await previewCleanup(old._id, admin._id);
  await assert.rejects(() => startCleanup(old._id, {
    confirmation: "invalid", confirmName: old.name, requestKey: crypto.randomUUID(),
  }, admin._id), /changed/);
  const cleanup = await startCleanup(old._id, { confirmation: preview.confirmation, confirmName: old.name, requestKey: crypto.randomUUID() }, admin._id);
  assert.equal(String((await startCleanup(old._id, {
    confirmation: preview.confirmation, confirmName: old.name, requestKey: cleanup.requestKey,
  }, admin._id))._id), String(cleanup._id));
  const blocked = await runNextJob({ jobId: cleanup._id, batchSize: 3 });
  assert.equal(blocked.state, "failed");
  assert.match(blocked.error, /outside this seed dataset/);
  assert.equal(await SeedRecord.countDocuments({ dataset: old._id, state: "active" }), before);
  await models.views.deleteOne({ _id: outside._id });
  await controlJob(cleanup._id, "retry", admin._id);
  const result = await runNextJob({ jobId: cleanup._id, batchSize: 5 });
  assert.equal(result.state, "completed", result.error);
  assert.equal(await SeedRecord.countDocuments({ dataset: old._id, state: "active" }), 0);
});
test("cancelled cleanup retains its checkpoint and retry finishes the remaining records", async () => {
  const old = await createDataset({ name: "Interrupted cleanup", namespace: `cancel_${crypto.randomUUID().slice(0, 8)}`, recipe: config }, admin._id);
  const preview = await previewGeneration(old._id, { recipe: config }, admin._id);
  const generation = await startJob(old._id, { kind: "generate", recipe: config, confirmation: preview.confirmation, requestKey: crypto.randomUUID() }, admin._id);
  assert.equal((await runNextJob({ jobId: generation._id })).state, "completed");
  const cleanupPreview = await previewCleanup(old._id, admin._id);
  const cleanup = await startCleanup(old._id, {
    confirmation: cleanupPreview.confirmation, confirmName: old.name, requestKey: crypto.randomUUID(),
  }, admin._id);
  const stopped = await runNextJob({ jobId: cleanup._id, batchSize: 4,
    afterBatch: async j => {
      if (j.succeeded === 4) await controlJob(j._id, "cancel", admin._id);
    },
  });
  assert.equal(stopped.state, "cancelled");
  assert.equal(stopped.succeeded, 4);
  assert.equal(await SeedRecord.countDocuments({ dataset: old._id, state: "active" }), cleanupPreview.count - 4);
  assert.equal((await SeedDataset.findById(old._id)).archivedAt, undefined);
  await controlJob(cleanup._id, "retry", admin._id);
  const result = await runNextJob({ jobId: cleanup._id, batchSize: 5 });
  assert.equal(result.state, "completed", result.error);
  assert.equal(result.succeeded, cleanupPreview.count);
  assert.ok((await SeedDataset.findById(old._id)).archivedAt);
});
test(
  "standard 11500 record dataset generates and validates",
  { skip: process.env.RUN_SEED_LOAD_TEST !== "true", timeout: 1800000 },
  async () => {
    const recipe = {
      owners: 50,
      guests: 450,
      properties: 1000,
      reviews: 5000,
      seed: 42,
      referenceDate: "2026-10-01",
    };
    const large = await createDataset(
      { name: "Standard load test", namespace: "standard_load", recipe },
      admin._id,
    );
    const preview = await previewGeneration(large._id, { recipe }, admin._id);
    const job = await startJob(
      large._id,
      {
        kind: "generate",
        recipe,
        confirmation: preview.confirmation,
        requestKey: crypto.randomUUID(),
      },
      admin._id,
    );
    const result = await runNextJob({
      jobId: job._id,
      afterBatch: async (j) => {
        if (j.cursor % 500 === 0)
          console.log(`Load test generation: ${j.cursor}/${j.total}`);
      },
    });
    assert.equal(result.state, "completed", result.error);
    assert.equal(result.succeeded, 11500);
    const validation = await startJob(
      large._id,
      { kind: "validate", requestKey: crypto.randomUUID() },
      admin._id,
    );
    const report = await runNextJob({ jobId: validation._id });
    assert.equal(report.state, "completed", report.error);
    assert.equal(report.report.valid, true, JSON.stringify(report.report));
    const cleanupPreview = await previewCleanup(large._id, admin._id);
    assert.equal(cleanupPreview.count, 11500);
    const cleanup = await startCleanup(large._id, {
      confirmation: cleanupPreview.confirmation, confirmName: large.name,
      requestKey: crypto.randomUUID(),
    }, admin._id);
    const removed = await runNextJob({ jobId: cleanup._id, batchSize: 50,
      afterBatch: async j => {
        if (j.cursor % 1000 === 0)
          console.log(`Load test cleanup: ${j.cursor}/${j.total}`);
      },
    });
    assert.equal(removed.state, "completed", removed.error);
    assert.equal(removed.succeeded, 11500);
    assert.equal(await SeedRecord.countDocuments({ dataset: large._id, state: "active" }), 0);
  },
);
