import mongoose from "mongoose";
import {
  SeedGate,
  SeedRecord,
  SeedDataset,
  SeedJob,
  SeedAudit,
} from "./models.js";
import { enabled, assert, fingerprint } from "./config.js";
import { models, referenceFields, fields, validateRecord } from "./store.js";
// Only used when the operator explicitly enables seed management. Existing
// controllers participate via Mongoose's documented transaction context.
export async function seedAppGuard(req, res, next) {
  if (
    !enabled() ||
    process.env.SEED_DATABASE_NAME !== mongoose.connection.name ||
    !req.path.startsWith("/api/") ||
    req.path.startsWith("/api/admin/seed") ||
    req.path.startsWith("/api/auth") ||
    req.path === "/api/health"
  )
    return next();
  const mayWrite =
    req.method !== "GET" ||
    [
      "/api/search",
      "/api/admin/image-audit",
      "/api/admin/listings/pending",
    ].includes(req.path);
  // Read-only recommendation queries keep their existing parallel execution.
  if (!mayWrite && !req.path.startsWith("/api/payments/stripe")) return next();
  if (!(await SeedRecord.exists({ state: "active" }))) return next();
  if (req.path.startsWith("/api/payments/stripe")) {
    const bookingId = req.body?.bookingId || req.query?.bookingId;
    if (
      bookingId &&
      mongoose.isValidObjectId(bookingId) &&
      (await SeedRecord.exists({ entity: "bookings", documentId: bookingId }))
    )
      return res.status(409).json({
        success: false,
        message: "Seed bookings support demo payments only.",
      });
    return next();
  }
  const original = res.json.bind(res);
  const started = new Date();
  let attempts = 0;
  let sentBody;
  let status = 200;
  try {
    await mongoose.connection.transaction(async () => {
      assert(
        attempts++ === 0,
        "Another seed operation changed the data. Please retry.",
        409,
      );
      await SeedGate.updateOne({ _id: "seed" }, { $inc: { revision: 1 } });
      if (mayWrite)
        assert(
          !(await SeedJob.exists({
            state: { $in: ["queued", "running", "cancel_requested"] },
          })),
          "Seed generation or maintenance is running. Please retry when it finishes.",
          409,
        );
      sentBody = await new Promise((resolve, reject) => {
        const close = () => reject(new Error("Request closed."));
        req.once("aborted", close);
        res.json = (body) => {
          req.removeListener("aborted", close);
          status = res.statusCode;
          if (status >= 400) {
            const e = new Error(body.message || "Request failed.");
            e.status = status;
            e.body = body;
            reject(e);
          } else resolve(body);
          return res;
        };
        next();
      });
      if (!mayWrite) return;
      // Capture ordinary demo activity only when all of its existing links have
      // the same proven seed ownership. Mixed activity stays outside the registry.
      for (const [entity, Model] of Object.entries(models)) {
        const docs = await Model.find({ updatedAt: { $gte: started } });
        for (const doc of docs) {
          let r = await SeedRecord.findOne({
            entity,
            documentId: doc._id,
            state: "active",
          });
          if (!r) {
            const refs = Object.entries(referenceFields[entity] || {}).filter(
              ([key]) => doc[key],
            );
            if (!refs.length) continue;
            const parents = [];
            for (const [key, parent] of refs)
              parents.push(
                await SeedRecord.findOne({
                  entity: parent,
                  documentId: doc[key],
                  state: "active",
                }),
              );
            if (
              parents.some((x) => !x) ||
              new Set(parents.map((x) => String(x.dataset))).size !== 1
            )
              continue;
            r = await SeedRecord.create({
              dataset: parents[0].dataset,
              entity,
              documentId: doc._id,
              key: `interaction:${doc._id}`,
              origin: "interaction",
              fingerprint: fingerprint(doc),
              ...(entity === "bookings" && {
                rate:
                  doc.totalAmount /
                  Math.max(
                    1,
                    Math.round(
                      (new Date(doc.endDate) - new Date(doc.startDate)) /
                        86400000,
                    ),
                  ),
              }),
            });
          } else {
            if (fields[entity])
              await validateRecord(r.dataset, entity, {}, doc, r);
            r.revision++;
            r.fingerprint = fingerprint(doc);
            await r.save();
          }
          if (fields[entity] && r.origin === "interaction" && r.revision === 0)
            await validateRecord(r.dataset, entity, {}, doc, r);
          await SeedDataset.updateOne(
            { _id: r.dataset },
            { $inc: { revision: 1 } },
          );
          await SeedAudit.create({
            dataset: r.dataset,
            actor: req.user?._id,
            action: "app_change",
            entity,
            documentId: doc._id,
          });
        }
      }
      // Existing controllers cap view/search history. Keep provenance tombstones
      // for these ephemeral records after the application prunes them.
      for (const entity of ["views", "searches"]) {
        const tracked = await SeedRecord.find({ entity, state: "active" });
        const existing = new Set(
          (
            await models[entity]
              .find({ _id: { $in: tracked.map((r) => r.documentId) } })
              .distinct("_id")
          ).map(String),
        );
        for (const r of tracked)
          if (!existing.has(String(r.documentId))) {
            r.state = "deleted";
            r.revision++;
            await r.save();
            await SeedDataset.updateOne(
              { _id: r.dataset },
              { $inc: { revision: 1 } },
            );
            await SeedAudit.create({
              dataset: r.dataset,
              actor: req.user?._id,
              action: "app_prune",
              entity,
              documentId: r.documentId,
            });
          }
      }
    });
    res.json = original;
    res.status(status);
    return original(sentBody);
  } catch (e) {
    res.json = original;
    if (!res.headersSent)
      return res.status(e.status || 409).json(
        e.body || {
          success: false,
          message: e.status
            ? e.message
            : "This operation conflicted with seed maintenance. Please retry.",
        },
      );
  }
}
