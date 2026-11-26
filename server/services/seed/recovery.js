import { SeedDataset, SeedJob, SeedRecord, SeedWorker } from "./models.js";
import { models, transaction, superAdmin, requireWrite } from "./store.js";
import { safeError } from "./config.js";
import { queueReviewAnalysis } from "./sentimentJobs.js";
import { sentimentHealth } from "../sentimentService.js";

const requestKey = "legacy_sentiment_v1";
const activeStates = ["queued", "running", "cancel_requested"];

export async function heartbeat(workerId) {
  await SeedWorker.updateOne({ _id: workerId }, { $set: {
    lastSeenAt: new Date(), expiresAt: new Date(Date.now() + 120000),
  } }, { upsert: true });
}

export async function workerStatus() {
  const worker = await SeedWorker.findOne().sort({ lastSeenAt: -1 }).lean();
  return { available: Boolean(worker?.lastSeenAt > new Date(Date.now() - 30000)),
    lastSeenAt: worker?.lastSeenAt || null };
}

// Only pre-integration, tracked fixture reviews qualify. Explicit fixture mode
// on newer datasets is preserved, as are real reviews and cancelled recovery jobs.
export async function queueLegacyReviewRecovery() {
  await requireWrite();
  const ids = await models.reviews.find({ sentimentAnalysis: { $exists: false },
    summary: "Synthetic demo feedback. Not a model prediction.", sentimentScore: 0 }).distinct("_id");
  const datasets = await SeedRecord.find({ entity: "reviews", state: "active",
    documentId: { $in: ids } }).distinct("dataset");
  const previous = await SeedJob.find({ dataset: { $in: datasets },
    $or: [{ requestKey }, { kind: "analyze_reviews" }] }).distinct("dataset");
  const attempted = new Set(previous.map(String));
  const eligible = datasets.filter(id => !attempted.has(String(id)));
  const report = { queued: [], blocked: [], waitingForModel: false };
  if (!eligible.length) return report;
  if (!(await sentimentHealth()).available) return { ...report, waitingForModel: true };
  for (const id of eligible) {
    try {
      const job = await transaction(async () => {
        if (await SeedJob.exists({ dataset: id, $or: [{ requestKey }, { kind: "analyze_reviews" }, { state: { $in: activeStates } }] })) return null;
        const dataset = await SeedDataset.findById(id);
        if (!dataset) return null;
        await superAdmin(dataset.createdBy);
        return queueReviewAnalysis({ dataset: id, actor: dataset.createdBy, requestKey, legacyOnly: true });
      });
      if (job) report.queued.push({ dataset: String(id), job: String(job._id), reviews: job.total });
    } catch (error) { report.blocked.push({ dataset: String(id), message: safeError(error) }); }
  }
  return report;
}
