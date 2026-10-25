import { normalize } from "./collection/identity.js";
import { catalogProperties } from "./pakistanCatalog.js";
import mongoose from "mongoose";
import { Faker, en } from "@faker-js/faker";
import { analyzeSentiment, reviewAnalysisPayload } from "../sentimentService.js";
import { queueReviewAnalysis } from "./sentimentJobs.js";
import { syncPropertySentiment } from "../../utils/propertySentimentStore.js";
import {
  SeedDataset,
  SeedRecord,
  SeedPlan,
  SeedItem,
  SeedJob,
} from "./models.js";
import {
  assert,
  integer,
  fingerprint,
  recipe,
  digest,
  entityNames,
} from "./config.js";
import {
  models,
  dataset,
  member,
  fields,
  sanitize,
  validateRecord,
  dependencies,
  transaction,
  superAdmin,
  saveRecord,
  deleteRecord,
  audit,
} from "./store.js";
import { buildDataset, fixture } from "./generator.js";
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export async function idle(ds) {
  assert(
    !(await SeedJob.exists({
      dataset: ds,
      state: { $in: ["queued", "running", "cancel_requested"] },
    })),
    "A job is active for this dataset. Wait or cancel it before editing.",
    409,
  );
}
export async function createDataset(input, actor) {
  assert(
    typeof input.name === "string" &&
      input.name.trim().length > 0 &&
      input.name.length <= 80,
    "Provide a dataset name up to 80 characters.",
  );
  assert(
    typeof input.namespace === "string" &&
      /^[a-z][a-z0-9_]{2,39}$/.test(input.namespace),
    "Namespace must use 3 to 40 lowercase letters, numbers, or underscores.",
  );
  const config = recipe(input.recipe);
  return transaction(async () => {
    await superAdmin(actor);
    const d = await SeedDataset.create({
      name: input.name.trim(),
      namespace: input.namespace,
      recipe: config,
      createdBy: actor,
    });
    await audit({ dataset: d._id, actor, action: "create_dataset" });
    return d;
  });
}
export async function counts(ds) {
  const groups = await SeedRecord.aggregate([
    { $match: { dataset: new mongoose.Types.ObjectId(ds), state: "active" } },
    { $group: { _id: "$entity", count: { $sum: 1 } } },
  ]);
  return Object.fromEntries(groups.map((g) => [g._id, g.count]));
}
export async function queryRecords(ds, entity, input = {}, all = false) {
  assert(entityNames.includes(entity), "Unsupported entity.");
  const allowed = [
    "q",
    "role",
    "city",
    "status",
    "rating",
    "sentiment",
    "from",
    "to",
    "page",
    "pageSize",
    "sort",
    "job",
  ];
  assert(
    Object.keys(input).every((k) => allowed.includes(k)),
    "Unsupported filter.",
  );
  const metas = await SeedRecord.find({
    dataset: ds,
    entity,
    state: "active",
    ...(input.job && { job: input.job }),
  }).lean();
  const filter = { _id: { $in: metas.map((r) => r.documentId) } };
  for (const [k, v] of Object.entries(input))
    assert(
      typeof v === "string" || typeof v === "number",
      "Filters must be plain values.",
    );
  if (input.q) {
    assert(
      String(input.q).length <= 100,
      "Search is limited to 100 characters.",
    );
    const regex = new RegExp(escapeRegex(String(input.q)), "i");
    const names =
      entity === "users"
        ? ["name", "email"]
        : entity === "properties"
          ? ["title", "location.city"]
          : entity === "reviews"
            ? ["text"]
            : ["startDate", "endDate"];
    filter.$or = names.map((k) => ({ [k]: regex }));
    if (/^[a-f\d]{24}$/i.test(String(input.q)))
      filter.$or.push({ _id: input.q });
  }
  for (const k of ["role", "status", "sentiment"])
    if (input[k]) filter[k] = input[k];
  if (input.city) filter["location.city"] = input.city;
  if (input.rating) filter.rating = integer(input.rating, "Rating", 1, 5);
  if (input.from || input.to) {
    const from = input.from ? new Date(input.from) : null,
      to = input.to ? new Date(`${input.to}T23:59:59.999Z`) : null;
    assert(
      (!from || Number.isFinite(+from)) && (!to || Number.isFinite(+to)),
      "Invalid date filter.",
    );
    filter.createdAt = { ...(from && { $gte: from }), ...(to && { $lte: to }) };
  }
  const page = integer(input.page ?? 1, "Page", 1, 100000),
    pageSize = integer(input.pageSize ?? 25, "Page size", 1, 100);
  const sorts = {
    newest: { createdAt: -1, _id: 1 },
    oldest: { createdAt: 1, _id: 1 },
    name: { name: 1, title: 1, _id: 1 },
    price: { price: 1, _id: 1 },
  };
  assert(!input.sort || sorts[input.sort], "Invalid sort.");
  let query = models[entity].find(filter).sort(sorts[input.sort || "newest"]);
  if (!all) query = query.skip((page - 1) * pageSize).limit(pageSize);
  const docs = await query.lean();
  const map = new Map(metas.map((r) => [String(r.documentId), r]));
  return {
    total: await models[entity].countDocuments(filter),
    page,
    pageSize,
    records: docs.map((doc) => {
      const r = map.get(String(doc._id));
      delete doc.password;
      delete doc.stripeSessionId;
      delete doc.stripePaymentIntentId;
      return {
        ...doc,
        seedRevision: r.revision,
        seedOrigin: r.origin,
        ...(r.rate != null && { rate: r.rate }),
      };
    }),
  };
}
export async function getRecord(ds, entity, id) {
  const r = await member(ds, entity, id);
  const doc = await models[entity].findById(id).lean();
  assert(doc, "Record missing.", 404);
  delete doc.password;
  delete doc.stripeSessionId;
  delete doc.stripePaymentIntentId;
  return {
    ...doc,
    seedRevision: r.revision,
    seedOrigin: r.origin,
    ...(r.rate != null && { rate: r.rate }),
    dependencies: await dependencies(entity, id),
  };
}
async function requireUnusedCatalog(ds, config) {
  if (!["pakistan_v1", "pakistan_collected_v1"].includes(config.propertySource)) return;
  const ids = catalogProperties(config.cities, config.propertySource, config.catalogDigest).slice(0, config.properties).map(p => p.id);
  const tracked = await SeedRecord.find({ dataset: ds, entity: "properties", state: "active" }).select("documentId").lean();
  const selected = catalogProperties(config.cities, config.propertySource, config.catalogDigest).slice(0, config.properties);
  const names = new Set(selected.map(p => `${normalize(p.title)}|${normalize(p.city)}`));
  const existing = await models.properties.find({ _id: { $in: tracked.map(r => r.documentId) }, seedCatalog: { $exists: true } })
    .select("title location.city seedCatalog.id").lean();
  assert(!existing.some(p => ids.includes(p.seedCatalog.id) || names.has(`${normalize(p.title)}|${normalize(p.location.city)}`)),
    "Some selected real properties already exist in this dataset. Choose other catalog cities or use generated demo properties to add more records.");
}
export async function previewGeneration(ds, input, actor) {
  const d = await dataset(ds);
  const config = recipe(input.recipe || d.recipe);
  if (input.kind === "append") await requireUnusedCatalog(ds, config);
  const items = buildDataset(d.namespace, config);
  return {
    recipe: config,
    total: items.length,
    counts: {
      users: config.owners + config.guests,
      properties: config.properties,
      bookings: config.reviews,
      reviews: config.reviews,
    },
    samples: entityNames
      .map((entity) => items.find((i) => i.entity === entity))
      .filter(Boolean),
    confirmation: digest({
      dataset: String(ds),
      recipe: config,
      actor: String(actor),
    }),
  };
}
export async function startJob(ds, input, actor) {
  assert(
    ["generate", "append", "validate", "recalculate", "analyze_reviews"].includes(input.kind),
    "Invalid job type.",
  );
  assert(
    typeof input.requestKey === "string" &&
      input.requestKey.length >= 8 &&
      input.requestKey.length <= 100,
    "A request key is required.",
  );
  return transaction(async () => {
    await superAdmin(actor);
    const d = await dataset(ds);
    const previous = await SeedJob.findOne({
      dataset: ds,
      requestKey: input.requestKey,
    });
    if (previous) {
      assert(
        previous.kind === input.kind &&
          String(previous.actor) === String(actor) &&
          (!["generate", "append"].includes(input.kind) || Boolean(previous.options?.analyzeReviews) === Boolean(input.analyzeReviews)) &&
          (!previous.options?.recipe ||
            digest(previous.options.recipe) ===
              digest(recipe(input.recipe || d.recipe))),
        "Request key was already used for a different operation.",
        409,
      );
      return previous;
    }
    await idle(ds);
    if (input.kind === "analyze_reviews") {
      const analysis = await queueReviewAnalysis({ dataset: ds, actor, requestKey: input.requestKey });
      assert(analysis, "All reviews already have current model predictions, or this dataset has no reviews.");
      return analysis;
    }
    let options = {};
    let total = 1;
    if (["generate", "append"].includes(input.kind)) {
      const config = recipe(input.recipe || d.recipe);
      if (input.kind === "append") await requireUnusedCatalog(ds, config);
      assert(
        input.confirmation ===
          digest({ dataset: String(ds), recipe: config, actor: String(actor) }),
        "Preview this generation request first.",
      );
      if (input.kind === "generate")
        assert(
          digest(config) === digest(d.recipe),
          "Initial generation uses the original recipe. Use append for new data.",
        );
      const generation =
        input.kind === "generate" ? "initial" : `append:${d.nextSequence++}`;
      assert(input.analyzeReviews === undefined || typeof input.analyzeReviews === "boolean", "Analyze reviews must be true or false.");
      options = { recipe: config, generation, analyzeReviews: input.analyzeReviews === true };
      total = buildDataset(d.namespace, config, generation).length;
      await d.save();
    } else {
      total = Math.max(
        1,
        await SeedRecord.countDocuments({ dataset: ds, state: "active" }),
      );
    }
    const j = await SeedJob.create({
      dataset: ds,
      actor,
      kind: input.kind,
      requestKey: input.requestKey,
      options,
      total,
    });
    await audit({
      dataset: ds,
      actor,
      action: `queue_${input.kind}`,
      job: j._id,
    });
    return j;
  });
}
export async function previewBulk(ds, input, actor) {
  const d = await dataset(ds);
  await idle(ds);
  assert(
    ["update", "delete", "regenerate", "create", "analyze"].includes(
      input.action,
    ),
    "Invalid bulk action.",
  );
  assert(
    entityNames.includes(input.entity) ||
      (input.action === "delete" && input.entity === "all"),
    "Invalid entity.",
  );
  let targets = [];
  if (input.action === "create") {
    assert(
      Array.isArray(input.records) &&
        input.records.length > 0 &&
        input.records.length <= 100,
      "Provide 1 to 100 records.",
    );
    const emails = new Set();
    const reviewBookings = new Set();
    const bookings = [];
    for (const payload of input.records) {
      const clean = sanitize(input.entity, payload);
      const checked = await validateRecord(ds, input.entity, clean);
      const validationDoc = new models[input.entity]({
        ...checked.data,
        ...(input.entity === "users" && { password: "validation_only" }),
      });
      await validationDoc.validate();
      if (input.entity === "users") {
        const email = checked.data.email.trim().toLowerCase();
        assert(!emails.has(email), "Duplicate email in this bulk request.");
        assert(
          !(await models.users.exists({ email })),
          "An account already uses an email in this bulk request.",
          409,
        );
        emails.add(email);
      }
      if (input.entity === "reviews") {
        const booking = String(checked.data.booking);
        assert(
          !reviewBookings.has(booking),
          "A booking can have only one review in this bulk request.",
        );
        reviewBookings.add(booking);
      }
      if (
        input.entity === "bookings" &&
        ["pending", "confirmed"].includes(checked.data.status)
      ) {
        assert(
          !bookings.some(
            (b) =>
              String(b.property) === String(checked.data.property) &&
              b.startDate <= checked.data.endDate &&
              b.endDate >= checked.data.startDate,
          ),
          "The property has overlapping bookings in this bulk request.",
        );
        bookings.push(checked.data);
      }
      targets.push({ entity: input.entity, action: "create", payload: clean });
    }
  } else {
    let records = [];
    if (input.entity === "all") {
      assert(
        input.action === "delete" && input.selection?.all === true,
        "Dataset deletion needs all records selected.",
      );
      records = await SeedRecord.find({ dataset: ds, state: "active" });
    } else if (input.selection?.all === true) {
      const list = await queryRecords(
        ds,
        input.entity,
        input.selection.filters || {},
        true,
      );
      records = await SeedRecord.find({
        dataset: ds,
        entity: input.entity,
        documentId: { $in: list.records.map((r) => r._id) },
        state: "active",
      });
    } else {
      assert(
        Array.isArray(input.selection?.ids) &&
          input.selection.ids.length > 0 &&
          input.selection.ids.length <= 500,
        "Select 1 to 500 records or all matching records.",
      );
      for (const id of new Set(input.selection.ids))
        records.push(await member(ds, input.entity, id));
    }
    assert(records.length > 0, "No seed records match this selection.");
    const seen = new Set(records.map((r) => `${r.entity}:${r.documentId}`));
    if (input.action === "delete") {
      for (let index = 0; index < records.length; index++) {
        const r = records[index];
        for (const dep of await dependencies(r.entity, r.documentId)) {
          const key = `${dep.entity}:${dep.id}`;
          if (seen.has(key)) continue;
          assert(
            input.cascade === true,
            "Selected records have dependencies. Enable inclusion of related seed records or reassign them.",
            409,
          );
          const child = await SeedRecord.findOne({
            dataset: ds,
            entity: dep.entity,
            documentId: dep.id,
            state: "active",
          });
          assert(
            child,
            "Deletion is blocked by activity outside this seed dataset.",
            409,
          );
          seen.add(key);
          records.push(child);
        }
      }
      const order = [
        "reviews",
        "views",
        "searches",
        "requests",
        "bookings",
        "properties",
        "users",
      ];
      records.sort((a, b) => order.indexOf(a.entity) - order.indexOf(b.entity));
    }
    assert(
      records.length <= 50000,
      "This action is too large. Use smaller selections.",
    );
    if (input.action === "analyze")
      assert(
        input.entity === "reviews" && records.length <= 50,
        "Analyze at most 50 reviews per job.",
      );
    for (const r of records) {
      const doc = await models[r.entity].findById(r.documentId);
      assert(
        doc && r.fingerprint === fingerprint(doc),
        "A selected record has an untracked edit. Refresh its tracking before proceeding.",
        409,
      );
      let payload = {};
      if (input.action === "update") {
        payload = sanitize(r.entity, input.patch || {});
        if (input.pricePercent != null) {
          assert(
            r.entity === "properties" &&
              Number.isFinite(Number(input.pricePercent)) &&
              Math.abs(Number(input.pricePercent)) <= 1000,
            "Invalid price percentage.",
          );
          payload.price = Math.round(
            doc.price * (1 + Number(input.pricePercent) / 100),
          );
        }
      }
      if (input.action === "regenerate") {
        const faker = new Faker({ locale: [en] });
        faker.seed(parseInt(String(r.documentId).slice(-8), 16) + r.revision);
        const choices =
          r.entity === "users"
            ? { name: faker.person.fullName(), phone: "" }
            : r.entity === "properties"
              ? {
                  title: `${faker.word.adjective()} Guest House`,
                  description: `${faker.lorem.sentences(3)} Synthetic FYP listing.`,
                  price: faker.number.int({ min: 4000, max: 45000 }),
                }
              : r.entity === "reviews"
                ? fixture(
                    faker,
                    faker.helpers.arrayElement([
                      "positive",
                      "negative",
                      "neutral",
                      "mixed",
                    ]),
                  )
                : { guests: faker.number.int({ min: 1, max: 4 }) };
        const permitted =
          r.entity === "reviews"
            ? ["text", "rating", "sentiment"]
            : Object.keys(choices);
        const selected = input.fields || permitted;
        assert(
          Array.isArray(selected) &&
            selected.length > 0 &&
            selected.every((k) => permitted.includes(k)),
          "Choose supported fields to regenerate.",
        );
        if (r.entity === "reviews" && selected.includes("text"))
          assert(
            selected.includes("sentiment"),
            "Regenerating review text also requires sentiment.",
          );
        payload = Object.fromEntries(selected.map((k) => [k, choices[k]]));
      }
      if (input.action === "analyze") {
        const result = await analyzeSentiment(doc.text, { strict: true });
        assert(
          result.summary !== "Sentiment service unavailable",
          "The sentiment service is unavailable. No analysis job was created.",
          503,
        );
        payload = reviewAnalysisPayload(doc.text, result);
      }
      if (["update", "regenerate"].includes(input.action)) {
        const checked = await validateRecord(ds, r.entity, payload, doc, r);
        await new models[r.entity]({
          ...checked.data,
          ...(r.entity === "users" && { password: "validation_only" }),
        }).validate();
      }
      targets.push({
        entity: r.entity,
        record: r.documentId,
        expectedRevision: r.revision,
        fingerprint: r.fingerprint,
        action: input.action === "regenerate" ? "update" : input.action,
        payload,
      });
    }
  }
  // Persist only after all preflight checks pass, and verify that the dataset
  // did not change while an external sentiment analysis was running.
  return transaction(async () => {
    await superAdmin(actor);
    await idle(ds);
    const current = await dataset(ds);
    assert(
      current.revision === d.revision,
      "Dataset changed during preview. Preview again.",
      409,
    );
    const summary = targets.reduce(
      (acc, t) => ({ ...acc, [t.entity]: (acc[t.entity] || 0) + 1 }),
      {},
    );
    const plan = await SeedPlan.create({
      dataset: ds,
      actor,
      action: input.action,
      entity: input.entity,
      count: targets.length,
      summary,
      datasetRevision: d.revision,
      expiresAt: new Date(Date.now() + 15 * 60000),
    });
    for (let i = 0; i < targets.length; i += 100)
      await SeedItem.insertMany(
        targets
          .slice(i, i + 100)
          .map((target, j) => ({ ...target, plan: plan._id, index: i + j })),
      );
    return {
      ...plan.toObject(),
      samples: targets.slice(0, 5).map((t) => ({
        entity: t.entity,
        record: t.record,
        changes: t.payload,
      })),
    };
  });
}
export async function executeBulk(ds, input, actor) {
  return transaction(async () => {
    await superAdmin(actor);
    const d = await dataset(ds);
    const plan = await SeedPlan.findOne({
      _id: input.planId,
      dataset: ds,
      actor,
    });
    assert(plan, "Preview not found.", 404);
    if (plan.consumedBy) return SeedJob.findById(plan.consumedBy);
    await idle(ds);
    assert(
      plan.expiresAt > new Date() && plan.datasetRevision === d.revision,
      "Preview expired or the dataset changed. Preview again.",
      409,
    );
    if (plan.action === "delete")
      assert(
        input.confirmName === d.name,
        "Enter the dataset name to confirm deletion.",
      );
    const j = await SeedJob.create({
      dataset: ds,
      actor,
      kind: "bulk",
      requestKey: `plan:${plan._id}`,
      options: { plan: plan._id },
      total: plan.count,
    });
    plan.consumedBy = j._id;
    await plan.save();
    await audit({
      dataset: ds,
      actor,
      action: `queue_${plan.action}`,
      job: j._id,
    });
    return j;
  });
}
export async function applyItem(ds, item, actor, job) {
  if (item.action === "delete")
    return deleteRecord(
      ds,
      item.entity,
      item.record,
      item.expectedRevision,
      actor,
      job,
    );
  if (item.action === "analyze") {
    const r = await member(ds, "reviews", item.record);
    const doc = await models.reviews.findById(item.record);
    assert(
      doc &&
        r.revision === item.expectedRevision &&
        r.fingerprint === fingerprint(doc),
      "Review changed since analysis.",
      409,
    );
    doc.set(item.payload);
    await doc.save();
    r.revision++;
    r.fingerprint = fingerprint(doc);
    await r.save();
    await syncPropertySentiment(doc.property);
    await SeedDataset.updateOne({ _id: ds }, { $inc: { revision: 1 } });
    return audit({
      dataset: ds,
      actor,
      action: "analyze",
      entity: "reviews",
      documentId: doc._id,
      job,
    });
  }
  return saveRecord(ds, item.entity, item.payload, {
    id: item.action === "create" ? undefined : item.record,
    revision: item.expectedRevision,
    actor,
    job,
  });
}
export function csv(records) {
  const keys = [...new Set(records.flatMap((r) => Object.keys(r)))].filter(
    (k) =>
      !["password", "stripeSessionId", "stripePaymentIntentId"].includes(k),
  );
  const cell = (value) => {
    let s =
      value == null
        ? ""
        : typeof value === "object"
          ? JSON.stringify(value)
          : String(value);
    if (/^[\s]*[=+@\-\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replaceAll('"', '""')}"`;
  };
  return [
    keys.map(cell).join(","),
    ...records.map((r) => keys.map((k) => cell(r[k])).join(",")),
  ].join("\r\n");
}
