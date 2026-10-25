import { SeedRecord, SeedItem, SeedJob } from "./models.js";
import { models, audit } from "./store.js";
import { fingerprint, assert } from "./config.js";
import { hasCurrentPrediction } from "../sentimentService.js";

// Called inside the existing seed transaction. Freeze the exact review versions;
// HTTP predictions are made by the worker outside that transaction.
export async function queueReviewAnalysis({ dataset, actor, requestKey, generationJob }) {
  const records = await SeedRecord.find({ dataset, entity: "reviews", state: "active", ...(generationJob && { job: generationJob }) }).sort({ _id: 1 }).lean();
  const documents = new Map((await models.reviews.find({ _id: { $in: records.map(r => r.documentId) } }).lean()).map(r => [String(r._id), r]));
  const work = [];
  for (const record of records) {
    const review = documents.get(String(record.documentId));
    assert(review && fingerprint(review) === record.fingerprint, "A review has an untracked edit. Refresh its tracking before analyzing.", 409);
    if (!hasCurrentPrediction(review)) work.push({ record, review });
  }
  if (!work.length) return null;
  const job = new SeedJob({ dataset, actor, kind: "analyze_reviews", requestKey, total: work.length });
  job.options = { plan: job._id };
  await job.save();
  for (let offset = 0; offset < work.length; offset += 500) await SeedItem.insertMany(work.slice(offset, offset + 500).map(({ record, review }, i) => ({
    plan: job._id, index: offset + i, entity: "reviews", record: record.documentId, expectedRevision: record.revision,
    fingerprint: record.fingerprint, action: "analyze", payload: { text: review.text },
  })));
  await audit({ dataset, actor, action: "queue_review_analysis", job: job._id });
  return job;
}

export async function reviewAnalysisCounts(dataset) {
  const records = await SeedRecord.find({ dataset, entity: "reviews", state: "active" }).select("documentId").lean();
  const reviews = await models.reviews.find({ _id: { $in: records.map(r => r.documentId) } }).select("text sentimentAnalysis").lean();
  const analyzed = reviews.filter(hasCurrentPrediction).length;
  return { total: reviews.length, analyzed, pending: reviews.length - analyzed };
}
