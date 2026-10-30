import mongoose from "mongoose";
import User from "../../models/User.js";
import Property from "../../models/Property.js";
import Booking from "../../models/Booking.js";
import Review from "../../models/Review.js";
import PropertyView from "../../models/PropertyView.js";
import SearchHistory from "../../models/SearchHistory.js";
import OfflineRequest from "../../models/OfflineRequest.js";
import {
  syncPropertySentiment,
  buildPropertySentimentSnapshot,
} from "../../utils/propertySentimentStore.js";
import { calculateBookingTotal } from "../../utils/bookingAmount.js";
import {
  SeedDataset,
  SeedRecord,
  SeedAudit,
  SeedGate,
  seedModels,
} from "./models.js";
import {
  assert,
  SeedError,
  enabled,
  fingerprint,
  dateString,
  demoPassword,
  integer,
} from "./config.js";
mongoose.set("transactionAsyncLocalStorage", true);
export const models = {
  users: User,
  properties: Property,
  bookings: Booking,
  reviews: Review,
  views: PropertyView,
  searches: SearchHistory,
  requests: OfflineRequest,
};
export const fields = {
  users: ["name", "email", "phone", "role", "languagePref", "isVerified"],
  properties: [
    "title",
    "description",
    "location",
    "price",
    "owner",
    "images",
    "availabilityCalendar",
    "status",
  ],
  bookings: [
    "guest",
    "property",
    "startDate",
    "endDate",
    "guests",
    "status",
    "paymentStatus",
    "rate",
  ],
  reviews: ["booking", "rating", "text", "sentiment"],
};
export const referenceFields = {
  properties: { owner: "users" },
  bookings: { guest: "users", property: "properties" },
  reviews: { guest: "users", property: "properties", booking: "bookings" },
  views: { user: "users", property: "properties" },
  searches: { user: "users" },
  requests: { guest: "users", property: "properties" },
};
export const objectId = (value) => {
  assert(mongoose.isValidObjectId(value), "Invalid record ID.");
  return value;
};
export async function capabilities() {
  const active =
    enabled() && process.env.SEED_DATABASE_NAME === mongoose.connection.name;
  let transactions = false;
  if (active) {
    const hello = await mongoose.connection.db.admin().command({ hello: 1 });
    transactions = Boolean(hello.setName || hello.msg === "isdbgrid");
  }
  return {
    enabled: active,
    transactions,
    environment: process.env.SEED_ENVIRONMENT_LABEL || "FYP demo",
    maxRecords: 20000,
  };
}
export async function requireWrite() {
  const cap = await capabilities();
  assert(
    cap.enabled,
    "Seed management is disabled or the permitted database name does not match.",
    403,
  );
  assert(
    cap.transactions,
    "Seed writes require a MongoDB replica set. See the setup guide.",
    409,
  );
}
export async function initialize() {
  await Promise.all(
    [...Object.values(models), ...seedModels].map((m) => m.init()),
  );
  await SeedGate.updateOne(
    { _id: "seed" },
    { $setOnInsert: { revision: 0 } },
    { upsert: true },
  );
}
export async function transaction(fn) {
  await requireWrite();
  return mongoose.connection.transaction(async () => {
    await SeedGate.updateOne({ _id: "seed" }, { $inc: { revision: 1 } });
    return fn();
  });
}
export async function superAdmin(actor) {
  assert(
    actor &&
      (await User.exists({ _id: actor, role: "admin", isSuperAdmin: true })),
    "Super admin access is required.",
    403,
  );
}
export async function dataset(id) {
  const d = await SeedDataset.findById(objectId(id));
  assert(d && !d.archivedAt, "Dataset not found.", 404);
  return d;
}
export async function audit(data) {
  await SeedAudit.create(data);
}
export async function member(ds, entity, id, active = true) {
  const r = await SeedRecord.findOne({
    dataset: ds,
    entity,
    documentId: objectId(id),
    ...(active && { state: "active" }),
  });
  assert(r, "This record does not belong to the selected seed dataset.", 404);
  return r;
}
export function sanitize(entity, input) {
  assert(fields[entity], "Unsupported entity.");
  assert(
    input && typeof input === "object" && !Array.isArray(input),
    "Provide an object of fields.",
  );
  assert(
    Object.keys(input).every((k) => fields[entity].includes(k)),
    "One or more fields cannot be edited here.",
  );
  return structuredClone(input);
}
async function link(ds, entity, id, role, context) {
  let doc;
  if (context) doc = context.links.get(`${entity}:${id}`);
  else {
    await member(ds, entity, id);
    doc = await models[entity].findById(id);
  }
  assert(doc, "A linked record is missing.", 409);
  if (role) assert(doc.role === role, `The linked user must be a ${role}.`);
  return doc;
}
export async function validateRecord(
  ds,
  entity,
  input,
  existing = null,
  meta = null,
  context = null,
) {
  const data = {
    ...(existing?.toObject ? existing.toObject() : existing || {}),
    ...input,
  };
  const ownId = existing?._id || input._id;
  if (entity === "users") {
    assert(
      ["guest", "owner"].includes(data.role),
      "Seed users can only be guests or owners.",
    );
    assert(
      typeof data.email === "string" &&
        /^[a-z0-9.!+_\-]+@example\.(test|com|org|net)$/i.test(data.email),
      "Use a unique address at example.test for seed accounts.",
    );
    if (data.isVerified !== undefined)
      assert(
        typeof data.isVerified === "boolean",
        "Verification must be true or false.",
      );
    if (existing) {
      const count = context
        ? data.role === "guest"
          ? context.owners.has(String(ownId))
          : context.guests.has(String(ownId))
        : data.role === "guest"
          ? await Property.countDocuments({ owner: ownId })
          : (await Booking.countDocuments({ guest: ownId })) +
            (await Review.countDocuments({ guest: ownId }));
      assert(
        !count,
        "Reassign or remove dependent records before changing this role.",
        409,
      );
    }
  } else if (entity === "properties") {
    await link(ds, "users", data.owner, "owner", context);
    assert(
      Number.isFinite(Number(data.price)) && Number(data.price) > 0,
      "Price must be positive.",
    );
    data.price = Number(data.price);
    assert(
      Array.isArray(data.images) && data.images.length <= 5,
      "A property supports at most five images.",
    );
    for (const image of data.images) {
      assert(
        typeof image.url === "string" &&
          (image.url.startsWith("/seed/") ||
            image.url.startsWith("/uploads/properties/") ||
            /^https:\/\//.test(image.url)),
        "Use a valid HTTPS or application image URL.",
      );
      assert(
        !Object.keys(image).some(
          (k) =>
            ![
              "url",
              "caption",
              "credit",
              "verificationStatus",
              "aiScore",
              "hash",
              "uploadedAt",
              "_id",
            ].includes(k),
        ),
        "Unknown image field.",
      );
    }
    for (const image of data.images) {
      if (image.caption !== undefined)
        assert(typeof image.caption === "string" && image.caption.length <= 500, "Invalid image caption.");
      if (image.credit !== undefined) {
        const credit = image.credit;
        assert(credit && typeof credit === "object" && !Array.isArray(credit) &&
          Object.keys(credit).every(k => ["title", "author", "sourceUrl", "license", "licenseUrl", "capturedAt", "changes"].includes(k)),
          "Invalid photo credit.");
        for (const key of ["title", "author", "sourceUrl", "license", "licenseUrl"])
          assert(typeof credit[key] === "string" && credit[key].trim().length > 0 && credit[key].length <= 2000,
            "Complete photo source, author and license are required.");
        for (const key of ["sourceUrl", "licenseUrl"])
          assert(/^https:\/\//.test(credit[key]), "Photo credit links must use HTTPS.");
      }
    }
    if (data.status === "approved")
      assert(
        data.images.some((x) => x.verificationStatus === "verified"),
        "Approval requires a verified image.",
      );
    assert(
      Array.isArray(data.availabilityCalendar),
      "Availability must be a list of date ranges.",
    );
    for (const range of data.availabilityCalendar)
      assert(
        dateString(range.startDate) &&
          dateString(range.endDate) &&
          range.startDate < range.endDate,
        "Invalid availability range.",
      );
    if (existing) {
      const bookings = context
        ? context.bookings.filter((b) => String(b.property) === String(ownId))
        : await Booking.find({
            property: ownId,
            status: { $in: ["pending", "confirmed"] },
          });
      for (const b of bookings)
        assert(
          data.status === "approved" &&
            within(data.availabilityCalendar, b.startDate, b.endDate),
          "This change would invalidate an existing booking.",
          409,
        );
    }
  } else if (entity === "bookings") {
    await link(ds, "users", data.guest, "guest", context);
    const p = await link(ds, "properties", data.property, undefined, context);
    if (!existing) {
      if (data.status === undefined) data.status = "pending";
      if (data.paymentStatus === undefined) data.paymentStatus = "pending";
    }
    assert(
      ["pending", "confirmed", "cancelled"].includes(data.status) &&
        ["pending", "confirmed", "failed"].includes(data.paymentStatus),
      "Choose a valid booking and payment status.",
    );
    assert(
      dateString(data.startDate) &&
        dateString(data.endDate) &&
        data.startDate < data.endDate,
      "End date must be after the start date.",
    );
    if (!existing || ["pending", "confirmed"].includes(data.status)) {
      assert(p.status === "approved", "Bookings require an approved property.");
      assert(
        within(p.availabilityCalendar, data.startDate, data.endDate),
        "Dates are outside property availability.",
      );
    }
    data.guests = integer(data.guests, "Guests", 1, 50);
    const rate = input.rate ?? meta?.rate ?? p.price;
    assert(
      Number.isFinite(Number(rate)) && Number(rate) > 0,
      "Invalid booked rate.",
    );
    data.totalAmount = calculateBookingTotal(
      Number(rate),
      data.startDate,
      data.endDate,
    );
    data.paymentMethod = "demo";
    data.stripeSessionId = null;
    data.stripePaymentIntentId = null;
    if (data.status === "confirmed")
      assert(
        data.paymentStatus === "confirmed",
        "Confirmed seed bookings require confirmed demo payment.",
      );
    if (data.paymentStatus === "confirmed")
      data.paymentConfirmedAt ||= new Date();
    else data.paymentConfirmedAt = null;
    if (["pending", "confirmed"].includes(data.status))
      assert(
        !(context
          ? context.bookings.some(
              (b) =>
                String(b.property) === String(data.property) &&
                String(b._id) !== String(ownId) &&
                b.startDate <= data.endDate &&
                b.endDate >= data.startDate,
            )
          : await Booking.exists({
              property: data.property,
              _id: { $ne: ownId || new mongoose.Types.ObjectId() },
              status: { $in: ["pending", "confirmed"] },
              startDate: { $lte: data.endDate },
              endDate: { $gte: data.startDate },
            })),
        "The property already has a booking for these dates.",
        409,
      );
    if (
      existing &&
      (context
        ? context.reviews.some((r) => String(r.booking) === String(ownId))
        : await Review.exists({ booking: ownId }))
    )
      assert(
        data.status === "confirmed" && data.paymentStatus === "confirmed",
        "Resolve the linked review before changing the booking state.",
        409,
      );
    delete data.rate;
    return { data, rate: Number(rate) };
  } else if (entity === "reviews") {
    const b = await link(ds, "bookings", data.booking, undefined, context);
    assert(
      b.status === "confirmed" && b.paymentStatus === "confirmed",
      "Reviews require a confirmed demo booking.",
    );
    data.guest = b.guest;
    data.property = b.property;
    assert(
      !(context
        ? context.reviews.some(
            (r) =>
              String(r.booking) === String(b._id) &&
              String(r._id) !== String(ownId),
          )
        : await Review.exists({
            booking: b._id,
            _id: { $ne: ownId || new mongoose.Types.ObjectId() },
          })),
      "This booking already has a review.",
      409,
    );
    data.rating = integer(data.rating, "Rating", 1, 5);
    assert(
      typeof data.text === "string" &&
        data.text.trim().length > 0 &&
        data.text.length <= 1000,
      "Review text must contain 1 to 1000 characters.",
    );
    assert(
      ["positive", "negative", "neutral", "mixed"].includes(data.sentiment),
      "Choose a sentiment.",
    );
    if (input.text !== undefined || input.sentiment !== undefined) {
      assert(
        input.sentiment !== undefined,
        "Choose the synthetic sentiment for the edited text.",
      );
      data.sentimentScore = 0;
      data.aspects = [];
      data.aspectInsights = [];
      data.summary = "Synthetic demo feedback. Not a model prediction.";
      data.sentimentAnalysis = { source: "fixture", status: "pending" };
    }
  }
  return { data };
}
function within(ranges, start, end) {
  return (
    !ranges?.length ||
    ranges.some((r) => r.startDate <= start && r.endDate >= end)
  );
}
export async function saveRecord(
  ds,
  entity,
  payload,
  {
    id,
    revision,
    key,
    origin = "manual",
    actor,
    job,
    generated = false,
    rate,
  } = {},
) {
  const Model = models[entity];
  assert(Model && fields[entity], "Unsupported entity.");
  let meta = null;
  let existing = null;
  if (id) {
    meta = await member(ds, entity, id);
    existing = await Model.findById(id);
    assert(existing, "Record is missing.", 409);
    assert(
      meta.revision === Number(revision),
      "This record changed. Refresh before editing.",
      409,
    );
    assert(
      meta.fingerprint === fingerprint(existing),
      "This record changed outside seed management. Refresh its tracked revision first.",
      409,
    );
  }
  const clean = generated ? payload : sanitize(entity, payload);
  const validated = await validateRecord(
    ds,
    entity,
    clean,
    existing,
    meta || { rate },
  );
  const oldProperty =
    entity === "reviews" ? existing?.property?.toString() : null;
  let doc;
  if (existing) {
    existing.set(validated.data);
    doc = await existing.save();
  } else {
    doc = new Model(validated.data);
    if (entity === "users") doc.password = demoPassword();
    await doc.save({ timestamps: !generated });
  }
  const fp = fingerprint(doc);
  if (meta) {
    meta.revision += 1;
    meta.fingerprint = fp;
    if (validated.rate != null) meta.rate = validated.rate;
    await meta.save();
  } else
    meta = await SeedRecord.create({
      dataset: ds,
      entity,
      documentId: doc._id,
      key: key || `manual:${doc._id}`,
      origin,
      fingerprint: fp,
      rate: validated.rate ?? rate,
      job,
    });
  if (entity === "reviews") {
    await syncPropertySentiment(doc.property);
    if (oldProperty && oldProperty !== String(doc.property))
      await syncPropertySentiment(oldProperty);
  }
  if (entity === "bookings" && existing) {
    const review = await Review.findOne({ booking: doc._id });
    if (review) {
      const rmeta = await member(ds, "reviews", review._id);
      const old = String(review.property);
      review.guest = doc.guest;
      review.property = doc.property;
      await review.save();
      rmeta.revision++;
      rmeta.fingerprint = fingerprint(review);
      await rmeta.save();
      await syncPropertySentiment(old);
      if (old !== String(review.property))
        await syncPropertySentiment(review.property);
    }
  }
  await SeedDataset.updateOne({ _id: ds }, { $inc: { revision: 1 } });
  await audit({
    dataset: ds,
    actor,
    action: id ? "update" : "create",
    entity,
    documentId: doc._id,
    fields: Object.keys(clean).filter((x) => x !== "password"),
    job,
  });
  const out = doc.toObject();
  delete out.password;
  return {
    ...out,
    seedRevision: meta.revision,
    seedOrigin: meta.origin,
    ...(meta.rate != null && { rate: meta.rate }),
  };
}
export async function dependencies(entity, id) {
  const result = [];
  for (const [target, refs] of Object.entries(referenceFields)) {
    const names = Object.entries(refs)
      .filter(([, parent]) => parent === entity)
      .map(([name]) => name);
    if (!names.length) continue;
    const docs = await models[target]
      .find({ $or: names.map((name) => ({ [name]: id })) })
      .select("_id")
      .lean();
    result.push(
      ...docs.map((doc) => ({ entity: target, id: String(doc._id) })),
    );
  }
  return result;
}
export async function deleteRecord(ds, entity, id, revision, actor, job) {
  const meta = await member(ds, entity, id);
  const doc = await models[entity].findById(id);
  assert(
    doc && meta.revision === revision && meta.fingerprint === fingerprint(doc),
    "A selected record changed. Create a new preview.",
    409,
  );
  assert(
    !(await dependencies(entity, id)).length,
    "This record still has dependent records. Delete or reassign them first.",
    409,
  );
  await models[entity].deleteOne({ _id: id });
  meta.state = "deleted";
  meta.revision++;
  await meta.save();
  if (entity === "reviews") await syncPropertySentiment(doc.property);
  await SeedDataset.updateOne({ _id: ds }, { $inc: { revision: 1 } });
  await audit({
    dataset: ds,
    actor,
    action: "delete",
    entity,
    documentId: id,
    job,
  });
}
export async function validateDataset(ds, selectedRecords) {
  const records =
    selectedRecords ||
    (await SeedRecord.find({
      dataset: ds,
      state: "active",
    }).lean());
  const issues = [];
  const counts = {};
  const documents = new Map();
  for (const entity of new Set(records.map((r) => r.entity))) {
    const docs = await models[entity].find({
      _id: {
        $in: records
          .filter((r) => r.entity === entity)
          .map((r) => r.documentId),
      },
    });
    for (const doc of docs) documents.set(`${entity}:${doc._id}`, doc);
  }
  const context = await validationContext(
    ds,
    records
      .map((r) => ({
        entity: r.entity,
        doc: documents.get(`${r.entity}:${r.documentId}`),
      }))
      .filter((e) => e.doc),
  );
  for (const r of records) {
    const doc = documents.get(`${r.entity}:${r.documentId}`);
    counts[r.entity] = (counts[r.entity] || 0) + 1;
    if (!doc) {
      issues.push(`${r.entity} ${r.documentId}: missing document`);
      continue;
    }
    try {
      await doc.validate();
      if (r.fingerprint !== fingerprint(doc))
        issues.push(`${r.entity} ${r.documentId}: untracked edit`);
      for (const [field, parent] of Object.entries(
        referenceFields[r.entity] || {},
      ))
        if (doc[field]) await link(ds, parent, doc[field], undefined, context);
      if (fields[r.entity])
        await validateRecord(ds, r.entity, {}, doc, r, context);
      if (
        r.entity === "bookings" &&
        doc.totalAmount !==
          calculateBookingTotal(r.rate, doc.startDate, doc.endDate)
      )
        issues.push(`bookings ${r.documentId}: incorrect total`);
      if (r.entity === "properties") {
        const expected = buildPropertySentimentSnapshot(
          context.reviews.filter((r) => String(r.property) === String(doc._id)),
        );
        for (const k of [
          "totalReviews",
          "positiveCount",
          "negativeCount",
          "neutralCount",
          "mixedCount",
          "averageRating",
        ])
          if (doc.sentimentSnapshot?.[k] !== expected[k])
            issues.push(`properties ${r.documentId}: incorrect ${k}`);
      }
    } catch (e) {
      issues.push(
        `${r.entity} ${r.documentId}: ${e instanceof SeedError ? e.message : "invalid record"}`,
      );
    }
  }
  return {
    valid: issues.length === 0,
    counts,
    issues: issues.slice(0, 100),
    totalIssues: issues.length,
  };
}

// Prefetch only the relationships needed by this bounded batch. The transaction
// gate keeps these snapshots stable while validation and writes run sequentially.
export async function validationContext(ds, entries) {
  const context = {
    links: new Map(),
    bookings: [],
    reviews: [],
    owners: new Set(),
    guests: new Set(),
  };
  const referenceIds = new Map();
  for (const { entity, doc } of entries) {
    for (const [field, parent] of Object.entries(
      referenceFields[entity] || {},
    )) {
      if (!doc[field]) continue;
      if (!referenceIds.has(parent)) referenceIds.set(parent, new Set());
      referenceIds.get(parent).add(String(doc[field]));
    }
  }
  for (const [entity, ids] of referenceIds) {
    const tracked = await SeedRecord.find({
      dataset: ds,
      entity,
      state: "active",
      documentId: { $in: [...ids] },
    })
      .select("documentId")
      .lean();
    const docs = await models[entity]
      .find({ _id: { $in: tracked.map((r) => r.documentId) } })
      .lean();
    for (const doc of docs) context.links.set(`${entity}:${doc._id}`, doc);
  }
  const users = entries
    .filter((e) => e.entity === "users")
    .map((e) => e.doc._id);
  const properties = [
    ...new Set(
      entries.flatMap((e) =>
        e.entity === "properties"
          ? [String(e.doc._id)]
          : e.entity === "bookings"
            ? [String(e.doc.property)]
            : [],
      ),
    ),
  ];
  const bookings = [
    ...new Set(
      entries.flatMap((e) =>
        e.entity === "bookings"
          ? [String(e.doc._id)]
          : e.entity === "reviews"
            ? [String(e.doc.booking)]
            : [],
      ),
    ),
  ];
  if (users.length) {
    context.owners = new Set(
      (await Property.distinct("owner", { owner: { $in: users } })).map(String),
    );
    context.guests = new Set(
      (await Booking.distinct("guest", { guest: { $in: users } })).map(String),
    );
    for (const id of await Review.distinct("guest", { guest: { $in: users } }))
      context.guests.add(String(id));
  }
  if (properties.length)
    context.bookings = await Booking.find({
      property: { $in: properties },
      status: { $in: ["pending", "confirmed"] },
    }).lean();
  const reviewFilters = [];
  if (properties.length) reviewFilters.push({ property: { $in: properties } });
  if (bookings.length) reviewFilters.push({ booking: { $in: bookings } });
  if (reviewFilters.length)
    context.reviews = await Review.find({ $or: reviewFilters }).lean();
  return context;
}

export async function saveGeneratedBatch(ds, items, { actor, job, supervisorDemo = false }) {
  const prior = new Map(
    (
      await SeedRecord.find({
        dataset: ds,
        key: { $in: items.map((i) => i.key) },
      }).lean()
    ).map((r) => [r.key, r]),
  );
  let created = 0,
    skipped = 0;
  for (const entity of ["users", "properties", "bookings", "reviews"]) {
    const group = items.filter((i) => i.entity === entity);
    if (!group.length) continue;
    const stored = new Map(
      (
        await models[entity].find({
          _id: { $in: group.map((i) => i.payload._id) },
        })
      ).map((doc) => [String(doc._id), doc]),
    );
    const fresh = [];
    for (const item of group) {
      const r = prior.get(item.key),
        doc = stored.get(String(item.payload._id));
      if (r) {
        if (r.state === "active")
          assert(
            doc && r.fingerprint === fingerprint(doc),
            "A generated record has an untracked change.",
            409,
          );
        skipped++;
      } else {
        assert(!doc, "Generated ID collides with an existing record.", 409);
        fresh.push(item);
      }
    }
    if (!fresh.length) continue;
    const context = await validationContext(
      ds,
      fresh.map((i) => ({ entity, doc: i.payload })),
    );
    const documents = [],
      rates = [];
    for (const item of fresh) {
      const validated = await validateRecord(
        ds,
        entity,
        item.payload,
        null,
        { rate: item.rate },
        context,
      );
      const doc = new models[entity](validated.data);
      if (entity === "users") {
        doc.password = demoPassword(doc.role, supervisorDemo);
        // User.save is intentional: preserve the existing bcrypt password hook.
        await doc.save({ timestamps: false });
      }
      documents.push(doc);
      rates.push(validated.rate ?? item.rate);
      if (entity === "bookings") context.bookings.push(validated.data);
      if (entity === "reviews") context.reviews.push(validated.data);
    }
    // insertMany runs schema validation; the other three models have no save hooks.
    if (entity !== "users")
      await models[entity].insertMany(documents, {
        timestamps: false,
        ordered: true,
      });
    await SeedRecord.insertMany(
      documents.map((doc, i) => ({
        dataset: ds,
        entity,
        documentId: doc._id,
        key: fresh[i].key,
        origin: "generated",
        fingerprint: fingerprint(doc),
        rate: rates[i],
        job,
      })),
    );
    await SeedAudit.insertMany(
      documents.map((doc, i) => ({
        dataset: ds,
        actor,
        action: "create",
        entity,
        documentId: doc._id,
        fields: Object.keys(fresh[i].payload).filter((k) => k !== "password"),
        job,
      })),
    );
    if (entity === "reviews") {
      const ids = [...new Set(documents.map((d) => String(d.property)))];
      const reviews = await Review.find({ property: { $in: ids } }).lean();
      await Property.bulkWrite(
        ids.map((id) => ({
          updateOne: {
            filter: { _id: id },
            update: {
              $set: {
                sentimentSnapshot: buildPropertySentimentSnapshot(
                  reviews.filter((r) => String(r.property) === id),
                ),
              },
            },
          },
        })),
      );
    }
    created += documents.length;
  }
  if (created)
    await SeedDataset.updateOne({ _id: ds }, { $inc: { revision: created } });
  return { created, skipped };
}
