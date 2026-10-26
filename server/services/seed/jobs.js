import crypto from "node:crypto";
import { SeedDataset, SeedJob, SeedRecord, SeedItem, SeedPlan, SeedAudit } from "./models.js";
import { assert, safeError, fingerprint } from "./config.js";
import {
  transaction,
  superAdmin,
  saveGeneratedBatch,
  validateDataset,
  audit,
  models,
  referenceFields,
} from "./store.js";
import { applyItem } from "./management.js";
import { buildDataset } from "./generator.js";
import { syncPropertySentiment } from "../../utils/propertySentimentStore.js";
import { analyzeSentiment, reviewAnalysisPayload } from "../sentimentService.js";
import { queueReviewAnalysis } from "./sentimentJobs.js";
const cleanupOrder = ["reviews", "views", "searches", "requests", "bookings", "properties", "users"];
async function checkCleanupBatch(dataset, records) {
  for (const entity of new Set(records.map(record => record.entity))) {
    const group = records.filter(record => record.entity === entity);
    const ids = group.map(record => record.documentId);
    const docs = await models[entity].find({ _id: { $in: ids } }).lean();
    const byId = new Map(docs.map(doc => [String(doc._id), doc]));
    for (const record of group)
      assert(byId.has(String(record.documentId)) && fingerprint(byId.get(String(record.documentId))) === record.fingerprint,
        "A seed record has an untracked edit or is missing. Cleanup stopped before deletion.", 409);
    for (const [childEntity, refs] of Object.entries(referenceFields)) {
      const fields = Object.entries(refs).filter(([, parent]) => parent === entity).map(([field]) => field);
      if (!fields.length) continue;
      const linked = await models[childEntity].find({ $or: fields.map(field => ({ [field]: { $in: ids } })) }).select("_id").lean();
      if (!linked.length) continue;
      const owned = await SeedRecord.find({ dataset, entity: childEntity, state: "active", documentId: { $in: linked.map(doc => doc._id) } }).select("documentId").lean();
      assert(owned.length === linked.length,
        "Cleanup is blocked by activity outside this seed dataset. Reassign or remove that activity first.", 409);
    }
  }
}
async function deleteCleanupBatch(dataset, records, actor, job) {
  await checkCleanupBatch(dataset, records);
  const entity = records[0].entity;
  assert(records.every(record => record.entity === entity), "Cleanup batches must contain one record type.");
  const ids = records.map(record => record.documentId);
  const reviews = entity === "reviews" ? await models.reviews.find({ _id: { $in: ids } }).select("property").lean() : [];
  const removed = await models[entity].deleteMany({ _id: { $in: ids } });
  assert(removed.deletedCount === records.length, "Cleanup records changed. Retry after reviewing the dataset.", 409);
  const tracking = await SeedRecord.updateMany({ _id: { $in: records.map(record => record._id) }, state: "active" },
    { $set: { state: "deleted" }, $inc: { revision: 1 } });
  assert(tracking.matchedCount === records.length, "Cleanup tracking changed. Retry after reviewing the dataset.", 409);
  if (reviews.length)
    for (const property of new Set(reviews.map(review => String(review.property))))
      await syncPropertySentiment(property);
  await SeedDataset.updateOne({ _id: dataset }, { $inc: { revision: records.length } });
  await SeedAudit.insertMany(records.map(record => ({
    dataset, actor, action: "delete", entity, documentId: record.documentId, job,
  })));
}
export async function controlJob(id, action, actor) {
  return transaction(async () => {
    await superAdmin(actor);
    const job = await SeedJob.findById(id);
    assert(job, "Job not found.", 404);
    if (action === "cancel") {
      if (job.state === "queued") job.state = "cancelled";
      else if (job.state === "running") job.state = "cancel_requested";
      else
        assert(
          ["cancel_requested", "cancelled"].includes(job.state),
          "Only an active job can be cancelled.",
        );
    } else {
      assert(
        ["failed", "cancelled"].includes(job.state),
        "Only failed or cancelled jobs can be retried.",
      );
      assert(
        !(await SeedJob.exists({
          dataset: job.dataset,
          _id: { $ne: job._id },
          state: { $in: ["queued", "running", "cancel_requested"] },
        })),
        "Another job is active for this dataset.",
        409,
      );
      job.state = "queued";
      job.error = undefined;
      job.leaseOwner = undefined;
      job.leaseUntil = undefined;
    }
    await job.save();
    await audit({ dataset: job.dataset, actor, action, job: job._id });
    return job;
  });
}
export async function runNextJob({
  batchSize = 25,
  workerId = crypto.randomUUID(),
  afterBatch,
  jobId,
} = {}) {
  assert(
    Number.isInteger(batchSize) && batchSize > 0 && batchSize <= 100,
    "Batch size must be from 1 to 100.",
  );
  const now = new Date();
  const job = await SeedJob.findOneAndUpdate(
    {
      ...(jobId && { _id: jobId }),
      $or: [
        { state: "queued" },
        {
          state: { $in: ["running", "cancel_requested"] },
          leaseUntil: { $lt: now },
        },
      ],
    },
    [
      {
        $set: {
          state: {
            $cond: [{ $eq: ["$state", "queued"] }, "running", "$state"],
          },
          leaseOwner: workerId,
          leaseUntil: new Date(Date.now() + 120000),
        },
      },
    ],
    { returnDocument: "after", sort: { createdAt: 1 }, updatePipeline: true },
  );
  if (!job) return null;
  try {
    const ds = await SeedDataset.findById(job.dataset);
    assert(ds, "Dataset missing.");
    const generated = ["generate", "append"].includes(job.kind)
      ? buildDataset(ds.namespace, job.options.recipe, job.options.generation)
      : null;
    while (true) {
      let predictions;
      if (job.kind === "analyze_reviews") {
        const checkpoint = await SeedJob.findOne({ _id: job._id, leaseOwner: workerId }).lean();
        assert(checkpoint && checkpoint.leaseUntil > new Date(), "Worker lease expired.", 409);
        if (checkpoint.state === "running") {
          await superAdmin(checkpoint.actor);
          const end = Math.min(checkpoint.cursor + Math.min(batchSize, 4), checkpoint.total);
          const items = await SeedItem.find({ plan: checkpoint.options.plan, index: { $gte: checkpoint.cursor, $lt: end } }).sort({ index: 1 }).lean();
          assert(items.length === end - checkpoint.cursor, "Analysis items are missing.");
          const results = await Promise.all(items.map(async item => ({ ...item,
            payload: reviewAnalysisPayload(item.payload.text, await analyzeSentiment(item.payload.text, { strict: true })),
          })));
          predictions = { cursor: checkpoint.cursor, end, items: results };
        }
      }
      const result = await transaction(async () => {
        const current = await SeedJob.findOne({
          _id: job._id,
          leaseOwner: workerId,
        });
        assert(
          current && current.leaseUntil > new Date(),
          "Worker lease expired.",
          409,
        );
        if (current.state === "cancel_requested") {
          current.state = "cancelled";
          current.finishedAt = new Date();
          await current.save();
          return "done";
        }
        assert(current.state === "running", "Job is no longer running.", 409);
        await superAdmin(current.actor);
        current.leaseUntil = new Date(Date.now() + 120000);
        if (current.kind === "analyze_reviews") {
          assert(predictions && predictions.cursor === current.cursor, "Analysis checkpoint changed. Retry this job.", 409);
          for (const item of predictions.items) await applyItem(ds._id, item, current.actor, current._id);
          current.cursor = predictions.end;
          current.succeeded += predictions.items.length;
        } else if (current.kind === "cleanup") {
          const count = current.options.count;
          if (current.cursor < count) {
            const work = await SeedRecord.find({ dataset: ds._id, state: "active" })
              .sort({ _id: 1 }).skip(current.cursor).limit(Math.min(batchSize, count - current.cursor)).lean();
            assert(work.length === Math.min(batchSize, count - current.cursor), "Cleanup records changed. Retry after reviewing the dataset.", 409);
            await checkCleanupBatch(ds._id, work);
            current.cursor += work.length;
          } else {
            let work = [];
            for (const entity of cleanupOrder) {
              work = await SeedRecord.find({ dataset: ds._id, entity, state: "active" })
                .sort({ _id: 1 }).limit(Math.min(batchSize, current.total - current.cursor)).lean();
              if (work.length) break;
            }
            assert(work.length, "Cleanup records changed. Review the dataset before retrying.", 409);
            await deleteCleanupBatch(ds._id, work, current.actor, current._id);
            current.succeeded += work.length;
            current.cursor += work.length;
          }
        } else if (["validate", "recalculate"].includes(current.kind)) {
          const work = await SeedRecord.find({
            dataset: ds._id,
            state: "active",
          })
            .sort({ _id: 1 })
            .skip(current.cursor)
            .limit(batchSize)
            .lean();
          if (current.kind === "recalculate") {
            for (const r of work)
              if (r.entity === "properties")
                await syncPropertySentiment(r.documentId);
          }
          const report = await validateDataset(ds._id, work);
          const previous = current.report || {
            valid: true,
            counts: {},
            issues: [],
            totalIssues: 0,
          };
          for (const [key, value] of Object.entries(report.counts))
            previous.counts[key] = (previous.counts[key] || 0) + value;
          current.report = {
            valid: previous.valid && report.valid,
            counts: previous.counts,
            issues: [...previous.issues, ...report.issues].slice(0, 100),
            totalIssues: previous.totalIssues + report.totalIssues,
          };
          current.cursor = Math.min(
            current.total,
            current.cursor + (work.length || 1),
          );
          current.succeeded += work.length;
        } else {
          const end = Math.min(current.cursor + batchSize, current.total);
          const work = generated
            ? generated.slice(current.cursor, end)
            : await SeedItem.find({
                plan: current.options.plan,
                index: { $gte: current.cursor, $lt: end },
              })
                .sort({ index: 1 })
                .lean();
          assert(
            work.length === end - current.cursor,
            "Job items are missing.",
          );
          if (generated) {
            const result = await saveGeneratedBatch(ds._id, work, {
              actor: current.actor,
              job: current._id,
            });
            current.succeeded += result.created;
            current.skipped += result.skipped;
          } else {
            for (const item of work) {
              await applyItem(ds._id, item, current.actor, current._id);
              current.succeeded++;
            }
          }
          current.cursor = end;
        }
        if (current.cursor >= current.total) {
          if (current.kind === "bulk" || current.kind === "cleanup") {
            const plan = await SeedPlan.findById(current.options.plan);
            if (current.kind === "cleanup" || (plan?.action === "delete" && plan.entity === "all")) {
              assert(
                !(await SeedRecord.exists({ dataset: ds._id, state: "active" })),
                "Some seed records remain in this dataset. Review the job before retrying.",
                409,
              );
              await SeedDataset.updateOne(
                { _id: ds._id },
                { $set: { archivedAt: new Date() } },
              );
            }
          }
          if (generated && current.options.analyzeReviews) {
            const next = await queueReviewAnalysis({ dataset: ds._id, actor: current.actor,
              requestKey: `analysis:${current._id}`, generationJob: current.kind === "append" ? current._id : undefined });
            if (next) current.options = { ...current.options, analysisJob: String(next._id) };
          }
          current.state = "completed";
          current.finishedAt = new Date();
          await audit({
            dataset: ds._id,
            actor: current.actor,
            action: "complete_job",
            job: current._id,
          });
        }
        await current.save();
        return current.state === "completed" ? "done" : "more";
      });
      if (afterBatch) await afterBatch(await SeedJob.findById(job._id));
      if (result === "done") break;
    }
  } catch (e) {
    await SeedJob.updateOne(
      {
        _id: job._id,
        leaseOwner: workerId,
        state: { $in: ["running", "cancel_requested"] },
      },
      {
        $set: { state: "failed", error: safeError(e), finishedAt: new Date() },
      },
    );
  }
  return SeedJob.findById(job._id);
}
