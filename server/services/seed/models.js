import mongoose from "mongoose";
const { Schema } = mongoose;
const id = Schema.Types.ObjectId;
const model = (name, fields, indexes = []) => {
  const schema = new Schema(fields, { timestamps: true });
  indexes.forEach(([keys, options]) => schema.index(keys, options));
  return mongoose.models[name] || mongoose.model(name, schema);
};
export const SeedDataset = model("SeedDataset", {
  name: { type: String, required: true },
  namespace: { type: String, required: true, unique: true },
  recipe: { type: Schema.Types.Mixed, required: true },
  createdBy: id,
  nextSequence: { type: Number, default: 0 },
  revision: { type: Number, default: 0 },
});
export const SeedRecord = model(
  "SeedRecord",
  {
    dataset: { type: id, required: true, index: true },
    entity: { type: String, required: true },
    documentId: { type: id, required: true },
    key: { type: String, required: true },
    state: { type: String, enum: ["active", "deleted"], default: "active" },
    revision: { type: Number, default: 0 },
    fingerprint: String,
    rate: Number,
    origin: { type: String, default: "generated" },
    job: id,
  },
  [
    [{ entity: 1, documentId: 1 }, { unique: true }],
    [{ dataset: 1, key: 1 }, { unique: true }],
  ],
);
export const SeedJob = model(
  "SeedJob",
  {
    dataset: { type: id, required: true, index: true },
    actor: id,
    kind: {
      type: String,
      enum: ["generate", "append", "bulk", "validate", "recalculate", "analyze_reviews"],
      required: true,
    },
    requestKey: { type: String, required: true },
    options: Schema.Types.Mixed,
    state: {
      type: String,
      enum: [
        "queued",
        "running",
        "cancel_requested",
        "cancelled",
        "failed",
        "completed",
      ],
      default: "queued",
    },
    cursor: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    succeeded: { type: Number, default: 0 },
    skipped: { type: Number, default: 0 },
    error: String,
    report: Schema.Types.Mixed,
    leaseOwner: String,
    leaseUntil: Date,
    finishedAt: Date,
  },
  [
    [{ dataset: 1, requestKey: 1 }, { unique: true }],
    [{ state: 1, leaseUntil: 1 }, {}],
  ],
);
export const SeedPlan = model("SeedPlan", {
  dataset: { type: id, required: true },
  actor: { type: id, required: true },
  action: { type: String, required: true },
  entity: String,
  count: Number,
  summary: Schema.Types.Mixed,
  datasetRevision: Number,
  expiresAt: Date,
  consumedBy: id,
});
export const SeedItem = model(
  "SeedItem",
  {
    plan: { type: id, required: true },
    index: { type: Number, required: true },
    entity: String,
    record: id,
    expectedRevision: Number,
    fingerprint: String,
    action: String,
    payload: Schema.Types.Mixed,
  },
  [[{ plan: 1, index: 1 }, { unique: true }]],
);
export const SeedAudit = model("SeedAudit", {
  dataset: { type: id, index: true },
  actor: id,
  action: String,
  entity: String,
  documentId: id,
  fields: [String],
  job: id,
  detail: String,
});
// Every seed mutation and enabled demo app request writes this gate inside its
// transaction. This prevents a booking insertion racing a property deletion.
export const SeedGate = model("SeedGate", {
  _id: String,
  revision: { type: Number, default: 0 },
});
export const seedModels = [
  SeedDataset,
  SeedRecord,
  SeedJob,
  SeedPlan,
  SeedItem,
  SeedAudit,
  SeedGate,
];
