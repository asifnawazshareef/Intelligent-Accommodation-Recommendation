import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import express from "express";
import mongoose from "mongoose";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { initialize, models, validateDataset, saveRecord, transaction } from "../services/seed/store.js";
import { SeedItem, SeedRecord, SeedJob, SeedWorker } from "../services/seed/models.js";
import { createDataset, previewGeneration, startJob } from "../services/seed/management.js";
import { runNextJob, controlJob } from "../services/seed/jobs.js";
import { analyzeSentiment, sentimentHealth, reviewTextHash } from "../services/sentimentService.js";
import { reviewAnalysisCounts } from "../services/seed/sentimentJobs.js";
import { queueLegacyReviewRecovery, heartbeat, workerStatus } from "../services/seed/recovery.js";
import { fingerprint } from "../services/seed/config.js";

let repl, http, actor, serviceUrl, mode = "ok", calls = 0;
const config = { owners: 1, guests: 2, properties: 2, reviews: 7, approvedPercent: 100 };
before(async () => {
  Object.assign(process.env, { NODE_ENV: "test", SEED_DASHBOARD_ENABLED: "true", SEED_DATABASE_NAME: "sentiment_jobs", SEED_DEMO_PASSWORD: "OnlyDemoAccounts123!" });
  repl = await MongoMemoryReplSet.create({ binary: { version: "7.0.14" }, instanceOpts: [{ launchTimeout: 60000 }], replSet: { count: 1, args: ["--nounixsocket", "--setParameter", "diagnosticDataCollectionEnabled=false"] } });
  await mongoose.connect(repl.getUri("sentiment_jobs")); await initialize();
  actor = await models.users.create({ name: "Test operator", email: "operator@example.test", password: "TestOperator123!", role: "admin", isSuperAdmin: true });
  const app = express(); app.use(express.json());
  app.get("/health", (req, res) => res.status(mode === "offline" ? 503 : 200).json({ status: "running", model: "Mock classifier", modelVersion: "mock-v1" }));
  app.post("/predict", (req, res) => {
    calls++;
    if (mode === "offline") return res.status(503).json({ detail: "Unavailable" });
    if (mode === "malformed") return res.json({ sentiment: "positive", confidence: "invalid" });
    assert.equal(typeof req.body.review, "string");
    res.json({ sentiment: "positive", confidence: 0.91, aspects: ["room"], aspectInsights: [{ aspect: "room", sentiment: "positive", confidence: 0.91, mentions: 1 }], summary: "Model test summary", model: "Mock classifier", modelVersion: "mock-v1" });
  });
  http = app.listen(0, "127.0.0.1"); await new Promise(r => http.once("listening", r));
  serviceUrl = `http://127.0.0.1:${http.address().port}`; process.env.SENTIMENT_API_URL = serviceUrl;
});
after(async () => { if (http) await new Promise(r => http.close(r)); await mongoose.disconnect(); if (repl) await repl.stop(); });
async function generated(namespace, analyzeReviews = false, overrides = {}) {
  const dataset = await createDataset({ name: namespace, namespace, recipe: { ...config, ...overrides } }, actor._id);
  const preview = await previewGeneration(dataset._id, {}, actor._id);
  const job = await startJob(dataset._id, { kind: "generate", requestKey: crypto.randomUUID(), confirmation: preview.confirmation, recipe: preview.recipe, analyzeReviews }, actor._id);
  const done = await runNextJob({ jobId: job._id }); assert.equal(done.state, "completed", done.error);
  return { dataset, job: done };
}

test("strict sentiment rejects unavailable and malformed responses without inventing predictions", async () => {
  for (const value of ["offline", "malformed"]) {
    mode = value;
    await assert.rejects(() => analyzeSentiment("The room was clean", { strict: true }), e => e.code === "SENTIMENT_UNAVAILABLE");
  }
  mode = "ok"; assert.equal((await sentimentHealth()).available, true);
});

test("generation queues model analysis, outage preserves checkpoints and retry saves real result fields", async () => {
  const { dataset, job } = await generated("auto_model", true);
  assert.ok(job.options.analysisJob);
  const before = await models.reviews.find({}).sort({ _id: 1 }).lean();
  assert.equal(before.length, 7); assert.ok(before.every(r => r.sentimentScore === 0));
  let interrupted = false;
  const failed = await runNextJob({ jobId: job.options.analysisJob, afterBatch: async j => {
    if (!interrupted && j.cursor === 4) { interrupted = true; mode = "offline"; }
  } });
  assert.equal(failed.state, "failed"); assert.equal(failed.cursor, 4); assert.match(failed.error, /sentiment model is unavailable/i);
  assert.equal(await models.reviews.countDocuments({ "sentimentAnalysis.status": "completed" }), 4);
  mode = "ok"; await controlJob(failed._id, "retry", actor._id);
  const done = await runNextJob({ jobId: failed._id }); assert.equal(done.state, "completed", done.error); assert.equal(done.succeeded, 7);
  const reviews = await models.reviews.find({ _id: { $in: before.map(r => r._id) } }).lean();
  for (const review of reviews) {
    assert.equal(review.summary, "Model test summary"); assert.equal(review.sentimentScore, 0.91);
    assert.equal(review.sentimentAnalysis.textHash, reviewTextHash(review.text));
    assert.equal(review.sentimentAnalysis.modelVersion, "mock-v1"); assert.equal(review.aspects[0], "room");
    assert.equal(review.text, before.find(r => String(r._id) === String(review._id)).text);
  }
  assert.equal((await validateDataset(dataset._id)).valid, true);
  await assert.rejects(() => startJob(dataset._id, { kind: "analyze_reviews", requestKey: crypto.randomUUID() }, actor._id), /already have current/);
});

test("existing seed reviews can be analyzed in bulk with cancellation and safe resume", async () => {
  const { dataset } = await generated("old_model_data");
  const job = await startJob(dataset._id, { kind: "analyze_reviews", requestKey: crypto.randomUUID() }, actor._id);
  let cancelled = false;
  const result = await runNextJob({ jobId: job._id, afterBatch: async j => { if (!cancelled && j.cursor === 4) { cancelled = true; await controlJob(j._id, "cancel", actor._id); } } });
  assert.equal(result.state, "cancelled"); assert.equal(result.cursor, 4);
  await controlJob(job._id, "retry", actor._id);
  assert.equal((await runNextJob({ jobId: job._id })).state, "completed");
  assert.equal((await validateDataset(dataset._id)).valid, true);
});

test("queued analysis rejects an untracked review edit instead of overwriting it", async () => {
  const { dataset } = await generated("stale_model_data");
  const job = await startJob(dataset._id, { kind: "analyze_reviews", requestKey: crypto.randomUUID() }, actor._id);
  const item = await SeedItem.findOne({ plan: job._id, index: 0 }).lean();
  await models.reviews.updateOne({ _id: item.record }, { $set: { text: "An untracked edit" } });
  const result = await runNextJob({ jobId: job._id }); assert.equal(result.state, "failed"); assert.equal(result.cursor, 0);
  assert.equal((await models.reviews.findById(item.record)).sentimentScore, 0);
});

test("repeat generation preserves predictions and edits invalidate only the edited review", async () => {
  const { dataset, job } = await generated("preserve_model", true);
  assert.equal((await runNextJob({ jobId: job.options.analysisJob })).state, "completed");
  const beforeCalls = calls;
  const repeat = await previewGeneration(dataset._id, {}, actor._id);
  const rerun = await startJob(dataset._id, { kind: "generate", requestKey: crypto.randomUUID(), confirmation: repeat.confirmation, analyzeReviews: true }, actor._id);
  const done = await runNextJob({ jobId: rerun._id });
  assert.equal(done.state, "completed", done.error); assert.equal(done.succeeded, 0); assert.equal(done.options.analysisJob, undefined);
  assert.equal(calls, beforeCalls);
  assert.deepEqual(await reviewAnalysisCounts(dataset._id), { total: 7, analyzed: 7, pending: 0 });
  const record = await SeedItem.findOne({ plan: job.options.analysisJob, index: 0 }).lean();
  const tracking = await SeedRecord.findOne({ documentId: record.record, entity: "reviews" }).lean();
  await transaction(() => saveRecord(dataset._id, "reviews", { text: "The room was dirty.", sentiment: "negative" }, { id: record.record, revision: tracking.revision, actor: actor._id }));
  assert.deepEqual(await reviewAnalysisCounts(dataset._id), { total: 7, analyzed: 6, pending: 1 });
  assert.equal((await models.reviews.findById(record.record)).sentimentAnalysis.status, "pending");
  const analysis = await startJob(dataset._id, { kind: "analyze_reviews", requestKey: crypto.randomUUID() }, actor._id);
  assert.equal(analysis.total, 1); assert.equal((await runNextJob({ jobId: analysis._id })).state, "completed");
  assert.equal((await validateDataset(dataset._id)).valid, true);
});

test("append analyzes new reviews without changing older model predictions", async () => {
  const { dataset, job } = await generated("append_model", true);
  assert.equal((await runNextJob({ jobId: job.options.analysisJob })).state, "completed");
  const beforeCalls = calls;
  const preview = await previewGeneration(dataset._id, { kind: "append", recipe: config }, actor._id);
  const append = await startJob(dataset._id, { kind: "append", recipe: preview.recipe, confirmation: preview.confirmation, analyzeReviews: true, requestKey: crypto.randomUUID() }, actor._id);
  const generatedJob = await runNextJob({ jobId: append._id });
  assert.equal(generatedJob.state, "completed", generatedJob.error);
  const result = await runNextJob({ jobId: generatedJob.options.analysisJob });
  assert.equal(result.state, "completed", result.error); assert.equal(result.total, 7); assert.equal(calls - beforeCalls, 7);
  assert.deepEqual(await reviewAnalysisCounts(dataset._id), { total: 14, analyzed: 14, pending: 0 });
  assert.equal((await validateDataset(dataset._id)).valid, true);
});

test("revoked permissions stop model jobs before external calls and can be safely retried", async () => {
  const { job } = await generated("revoke_model", true);
  const beforeCalls = calls;
  await models.users.updateOne({ _id: actor._id }, { $set: { isSuperAdmin: false } });
  try {
    const failed = await runNextJob({ jobId: job.options.analysisJob });
    assert.equal(failed.state, "failed"); assert.equal(failed.cursor, 0); assert.equal(calls, beforeCalls);
  } finally { await models.users.updateOne({ _id: actor._id }, { $set: { isSuperAdmin: true } }); }
  await controlJob(job.options.analysisJob, "retry", actor._id);
  assert.equal((await runNextJob({ jobId: job.options.analysisJob })).state, "completed");
});

test("the actual Python model analyzes seeded reviews and updates property aspects", { skip: !process.env.SEED_REAL_SENTIMENT_PYTHON, timeout: 90000 }, async () => {
  const reservation = createServer();
  await new Promise(resolve => reservation.listen(0, "127.0.0.1", resolve));
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  let startupOutput = "", startupError;
  const python = spawn(process.env.SEED_REAL_SENTIMENT_PYTHON, ["-m", "uvicorn", "app:app", "--host", "127.0.0.1", "--port", String(port)], { cwd: fileURLToPath(new URL("../../sentiment-service/", import.meta.url)), stdio: ["ignore", "pipe", "pipe"] });
  const stopped = new Promise(resolve => python.once("close", resolve));
  python.on("error", error => { startupError = error; });
  for (const output of [python.stdout, python.stderr]) output.on("data", chunk => { startupOutput = (startupOutput + chunk.toString()).slice(-8000); });
  const previous = process.env.SENTIMENT_API_URL;
  try {
    process.env.SENTIMENT_API_URL = `http://127.0.0.1:${port}`;
    let ready = false;
    const deadline = Date.now() + 45000;
    while (Date.now() < deadline && !startupError && python.exitCode === null && python.signalCode === null) {
      if ((await sentimentHealth()).available) { ready = true; break; }
      await new Promise(r => setTimeout(r, 100));
    }
    assert.ok(ready, `Actual Python model startup: ${startupError?.message || startupOutput}`);
    for (const [text, expected] of [
      ["The room was spotless and the staff were helpful.", "positive"],
      ["The room was dirty and the staff were unhelpful.", "negative"],
      ["The staff were friendly, but the room was noisy.", "mixed"],
      ["We stayed for 5 nights.", "neutral"],
      ["The room was spotless and the staff were helpful. We stayed for 5 nights.", "positive"],
      ["The room was dirty and the staff were unhelpful. We stayed for 2 nights.", "negative"],
      ["The staff were friendly, but the room was noisy. We stayed for 3 nights.", "mixed"],
      ["It was a standard stay with basic facilities. We stayed for 4 nights.", "neutral"],
      ["Demo review, not a real guest experience. The room was spotless and the staff were helpful. We stayed for 2 nights.", "positive"],
      ["Demo review, not a real guest experience. The room was dirty and the staff were unhelpful. We stayed for 2 nights.", "negative"],
      ["Demo review, not a real guest experience. The staff were friendly, but the room was noisy. We stayed for 2 nights.", "mixed"],
      ["Demo review, not a real guest experience. It was a standard stay with basic facilities. We stayed for 4 nights.", "neutral"],
    ]) {
      assert.equal((await analyzeSentiment(text, { strict: true })).sentiment, expected);
    }
    const { dataset, job } = await generated("actual_python", true, { propertySource: "pakistan_v1", cities: ["Gilgit"], properties: 1, positivePercent: 100, negativePercent: 0, neutralPercent: 0 });
    const result = await runNextJob({ jobId: job.options.analysisJob }); assert.equal(result.state, "completed", result.error);
    const reviews = await models.reviews.find({ "sentimentAnalysis.modelVersion": { $ne: "mock-v1" }, "sentimentAnalysis.source": "model" }).lean();
    assert.equal(reviews.length, 7);
    for (const r of reviews) { assert.match(r.text, /^Demo review, not a real guest experience/); assert.equal(r.sentiment, "positive"); assert.ok(r.sentimentScore > 0); assert.notEqual(r.summary, "Synthetic demo feedback. Not a model prediction."); assert.match(r.sentimentAnalysis.modelVersion, /^[a-f0-9]{16}$/); }
    assert.ok(await models.properties.exists({ _id: { $in: reviews.map(r => r.property) }, "sentimentSnapshot.aspectBreakdown.0": { $exists: true } }));
    assert.equal((await validateDataset(dataset._id)).valid, true);
  } finally { if (python.pid && python.exitCode === null && python.signalCode === null) python.kill("SIGTERM"); await stopped; process.env.SENTIMENT_API_URL = previous; }
});

async function legacy(namespace) {
  const result = await generated(namespace);
  const records = await SeedRecord.find({ dataset: result.dataset._id, entity: "reviews" }).lean();
  for (const record of records) {
    await models.reviews.updateOne({ _id: record.documentId }, { $unset: { sentimentAnalysis: 1 } });
    const review = await models.reviews.findById(record.documentId).lean();
    await SeedRecord.updateOne({ _id: record._id }, { $set: { fingerprint: fingerprint(review) } });
  }
  return { ...result, records };
}

test("worker upgrades older tracked reviews once and preserves explicit fixtures and unrelated reviews", async () => {
  const { dataset, records } = await legacy("legacy_upgrade");
  const explicit = await generated("explicit_fixture_mode");
  const unrelated = await models.reviews.create({ guest: new mongoose.Types.ObjectId(), property: new mongoose.Types.ObjectId(), booking: new mongoose.Types.ObjectId(), text: "An unrelated review", rating: 4, summary: "Synthetic demo feedback. Not a model prediction." });
  const before = await models.reviews.findById(records[0].documentId).lean();
  const [first, second] = await Promise.all([queueLegacyReviewRecovery(), queueLegacyReviewRecovery()]);
  assert.equal([...first.queued, ...second.queued].filter(j => j.dataset === String(dataset._id)).length, 1);
  const job = await SeedJob.findOne({ dataset: dataset._id, requestKey: "legacy_sentiment_v1" });
  assert.equal(job.total, 7);
  assert.equal((await runNextJob({ jobId: job._id })).state, "completed");
  const after = await models.reviews.findById(before._id).lean();
  assert.equal(after.text, before.text); assert.equal(after.rating, before.rating); assert.deepEqual(after.createdAt, before.createdAt);
  assert.equal(after.sentimentAnalysis.source, "model"); assert.equal(after.sentimentScore, 0.91);
  assert.equal((await reviewAnalysisCounts(explicit.dataset._id)).pending, 7);
  assert.equal((await models.reviews.findById(unrelated._id)).summary, unrelated.summary);
  assert.equal((await queueLegacyReviewRecovery()).queued.length, 0);
  assert.equal((await validateDataset(dataset._id)).valid, true);
});

test("legacy recovery waits for Python and preserves cancellation instead of requeuing", async () => {
  const { dataset } = await legacy("legacy_offline");
  mode = "offline";
  try {
    assert.equal((await queueLegacyReviewRecovery()).waitingForModel, true);
    assert.equal(await SeedJob.exists({ dataset: dataset._id, kind: "analyze_reviews" }), null);
  } finally { mode = "ok"; }
  const report = await queueLegacyReviewRecovery();
  const job = report.queued.find(j => j.dataset === String(dataset._id)); assert.ok(job);
  await controlJob(job.job, "cancel", actor._id);
  assert.equal((await queueLegacyReviewRecovery()).queued.length, 0);
  assert.equal((await SeedJob.findById(job.job)).state, "cancelled");
});

test("legacy recovery respects an earlier manual analysis cancellation and revoked creator access", async () => {
  const cancelled = await legacy("legacy_manual_cancel");
  const manual = await startJob(cancelled.dataset._id, { kind: "analyze_reviews", requestKey: crypto.randomUUID() }, actor._id);
  await controlJob(manual._id, "cancel", actor._id);
  assert.equal((await queueLegacyReviewRecovery()).queued.length, 0);
  const revoked = await legacy("legacy_revoked");
  await models.users.updateOne({ _id: actor._id }, { $set: { isSuperAdmin: false } });
  try {
    const report = await queueLegacyReviewRecovery();
    assert.equal(report.queued.length, 0); assert.ok(report.blocked.find(item => item.dataset === String(revoked.dataset._id)));
  } finally { await models.users.updateOne({ _id: actor._id }, { $set: { isSuperAdmin: true } }); }
  const queued = (await queueLegacyReviewRecovery()).queued.find(j => j.dataset === String(revoked.dataset._id));
  assert.ok(queued); assert.equal((await runNextJob({ jobId: queued.job })).state, "completed");
});

test("legacy recovery refuses untracked edits and worker health expires after shutdown", async () => {
  const { dataset, records } = await legacy("legacy_conflict");
  await models.reviews.updateOne({ _id: records[0].documentId }, { $set: { text: "An outside edit" } });
  const report = await queueLegacyReviewRecovery();
  assert.ok(report.blocked.find(item => item.dataset === String(dataset._id)));
  assert.equal(await SeedJob.exists({ dataset: dataset._id, kind: "analyze_reviews" }), null);
  assert.equal((await workerStatus()).available, false);
  await heartbeat("worker-one"); await heartbeat("worker-two");
  await SeedWorker.deleteOne({ _id: "worker-one" });
  assert.equal((await workerStatus()).available, true);
  await SeedWorker.updateOne({ _id: "worker-two" }, { $set: { lastSeenAt: new Date(Date.now() - 31000) } });
  assert.equal((await workerStatus()).available, false);
});
