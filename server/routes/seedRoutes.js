import { pakistanCatalogCities, pakistanCatalog, collectedCatalogStatus, catalogSummary } from "../services/seed/pakistanCatalog.js";
import { checkSeedSetup } from "../services/seed/readiness.js";
import { sentimentHealth } from "../services/sentimentService.js";
import { reviewAnalysisCounts } from "../services/seed/sentimentJobs.js";
import { workerStatus } from "../services/seed/recovery.js";
import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { SeedDataset, SeedJob, SeedAudit } from "../services/seed/models.js";
import {
  capabilities,
  superAdmin,
  transaction,
  saveRecord,
  member,
  models,
  audit,
  dataset,
} from "../services/seed/store.js";
import {
  SeedError,
  assert,
  safeError,
  integer,
  fingerprint,
  getSeedPresets,
  presetDescriptions,
  cities,
} from "../services/seed/config.js";
import {
  createDataset,
  counts,
  queryRecords,
  getRecord,
  previewGeneration,
  startJob,
  previewBulk,
  executeBulk,
  previewCleanup,
  startCleanup,
  idle,
  csv,
} from "../services/seed/management.js";
import { controlJob } from "../services/seed/jobs.js";
import { propertyUpload, handleMulterError } from "../middleware/uploadMiddleware.js";
import { buildVerifiedImagesFromFiles, deleteUploadedImage } from "../utils/imageVerification.js";
const router = express.Router();
const handler = (fn) => async (req, res, next) => {
  try {
    await fn(req, res);
  } catch (e) {
    res
      .status(e instanceof SeedError ? e.status : e.code === "SENTIMENT_UNAVAILABLE" ? 503 : e.code === 11000 ? 409 : 400)
      .json({ success: false, message: safeError(e) });
  }
};
router.use(protect, async (req, res, next) => {
  try {
    await superAdmin(req.user._id);
    const cap = await capabilities();
    assert(
      cap.enabled,
      "Seed management is disabled for this environment.",
      403,
    );
    next();
  } catch (e) {
    res.status(e.status || 403).json({ success: false, message: safeError(e) });
  }
});
router.get(
  "/capabilities",
  handler(async (req, res) =>
    res.json({ ...(await capabilities()), setup: await checkSeedSetup(), presets: getSeedPresets(), presetDescriptions, cities, collectedCatalog: collectedCatalogStatus(), propertyCatalog: { count: pakistanCatalog.length, cities: pakistanCatalogCities } }),
  ),
);
router.get("/catalog", handler(async (req, res) => {
  const { source, digest } = req.query;
  assert(["pakistan_v1", "pakistan_collected_v1"].includes(source), "Choose a valid property catalog.");
  assert(source !== "pakistan_collected_v1" || typeof digest === "string" && /^[a-f0-9]{64}$/.test(digest), "Choose a valid catalog snapshot.");
  try { res.json(catalogSummary(source, digest)); }
  catch { throw new SeedError("The selected catalog is missing or damaged. Restore its snapshot before retrying."); }
}));
router.get(
  "/datasets",
  handler(async (req, res) => {
    const docs = await SeedDataset.find({ archivedAt: { $exists: false } })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    for (const d of docs) d.counts = await counts(d._id);
    res.json(docs);
  }),
);
router.post(
  "/datasets",
  handler(async (req, res) =>
    res.status(201).json(await createDataset(req.body, req.user._id)),
  ),
);
router.get(
  "/jobs",
  handler(async (req, res) =>
    res.json(
      await SeedJob.find(
        req.query.dataset ? { dataset: req.query.dataset } : {},
      )
        .sort({ createdAt: -1 })
        .limit(50),
    ),
  ),
);
router.get(
  "/jobs/:id",
  handler(async (req, res) => {
    const j = await SeedJob.findById(req.params.id);
    assert(j, "Job not found.", 404);
    res.json(j);
  }),
);
router.post(
  "/jobs/:id/:action",
  handler(async (req, res) => {
    assert(["cancel", "retry"].includes(req.params.action), "Invalid action.");
    res.json(await controlJob(req.params.id, req.params.action, req.user._id));
  }),
);
router.param("ds", (req, res, next, id) => {
  dataset(id)
    .then(() => next())
    .catch((e) =>
      res
        .status(e.status || 400)
        .json({ success: false, message: safeError(e) }),
    );
});
router.post(
  "/datasets/:ds/preview",
  handler(async (req, res) =>
    res.json(await previewGeneration(req.params.ds, req.body, req.user._id)),
  ),
);
router.get("/datasets/:ds/sentiment", handler(async (req, res) => {
  const [service, counts, worker] = await Promise.all([sentimentHealth(), reviewAnalysisCounts(req.params.ds), workerStatus()]);
  res.json({ service, worker, ...counts });
}));
router.get("/sentiment", handler(async (req, res) => {
  const [service, worker] = await Promise.all([sentimentHealth(), workerStatus()]);
  res.json({ service, worker });
}));
router.post(
  "/datasets/:ds/jobs",
  handler(async (req, res) =>
    res.status(202).json(await startJob(req.params.ds, req.body, req.user._id)),
  ),
);
router.post(
  "/datasets/:ds/cleanup/preview",
  handler(async (req, res) => res.json(await previewCleanup(req.params.ds, req.user._id))),
);
router.post(
  "/datasets/:ds/cleanup/execute",
  handler(async (req, res) => res.status(202).json(await startCleanup(req.params.ds, req.body, req.user._id))),
);
router.post(
  "/datasets/:ds/bulk/preview",
  handler(async (req, res) =>
    res.json(await previewBulk(req.params.ds, req.body, req.user._id)),
  ),
);
router.post(
  "/datasets/:ds/bulk/execute",
  handler(async (req, res) =>
    res
      .status(202)
      .json(await executeBulk(req.params.ds, req.body, req.user._id)),
  ),
);
router.get(
  "/datasets/:ds/history",
  handler(async (req, res) =>
    res.json(
      await SeedAudit.find({ dataset: req.params.ds })
        .sort({ createdAt: -1 })
        .limit(200),
    ),
  ),
);
router.post(
  "/datasets/:ds/export",
  handler(async (req, res) => {
    const entity = req.body.entity;
    const format = req.body.format || "json";
    assert(["json", "csv"].includes(format), "Invalid export format.");
    if (!entity || entity === "all") {
      assert(format === "json", "Whole dataset exports use JSON.");
      const result = {};
      for (const e of ["users", "properties", "bookings", "reviews"])
        result[e] = (await queryRecords(req.params.ds, e, {}, true)).records;
      return res.attachment("seed_dataset.json").json(result);
    }
    let records = (
      await queryRecords(req.params.ds, entity, req.body.filters || {}, true)
    ).records;
    if (req.body.ids) {
      assert(Array.isArray(req.body.ids), "IDs must be a list.");
      const ids = new Set(req.body.ids);
      records = records.filter((r) => ids.has(String(r._id)));
    }
    if (format === "csv")
      return res
        .type("text/csv")
        .attachment(`seed_${entity}.csv`)
        .send(csv(records));
    return res.attachment(`seed_${entity}.json`).json(records);
  }),
);
router.post(
  "/datasets/:ds/users/:id/password",
  handler(async (req, res) => {
    assert(
      typeof req.body.password === "string" &&
        req.body.password.length >= 10 &&
        Buffer.byteLength(req.body.password, "utf8") <= 72,
      "Use 10 or more characters and at most 72 UTF-8 bytes.",
    );
    await transaction(async () => {
      await superAdmin(req.user._id);
      await idle(req.params.ds);
      const r = await member(req.params.ds, "users", req.params.id);
      assert(
        r.revision === integer(req.body.revision, "Revision"),
        "Record changed. Refresh first.",
        409,
      );
      const user = await models.users.findById(req.params.id);
      assert(
        user && r.fingerprint === fingerprint(user),
        "Record changed outside seed management. Resolve the validation report first.",
        409,
      );
      user.password = req.body.password;
      await user.save();
      r.revision++;
      r.fingerprint = fingerprint(user);
      await r.save();
      await SeedDataset.updateOne(
        { _id: req.params.ds },
        { $inc: { revision: 1 } },
      );
      await audit({
        dataset: req.params.ds,
        actor: req.user._id,
        action: "password_reset",
        entity: "users",
        documentId: user._id,
      });
    });
    res.json({ success: true });
  }),
);
router.get(
  "/datasets/:ds/:entity",
  handler(async (req, res) =>
    res.json(await queryRecords(req.params.ds, req.params.entity, req.query)),
  ),
);
router.get(
  "/datasets/:ds/:entity/:id",
  handler(async (req, res) =>
    res.json(await getRecord(req.params.ds, req.params.entity, req.params.id)),
  ),
);
router.post("/datasets/:ds/properties/:id/photos", (req, res, next) =>
  propertyUpload(req, res, error => {
    if (!error) return next();
    for (const file of req.files || []) deleteUploadedImage(`/uploads/properties/${file.filename}`);
    return handleMulterError(error, req, res, next);
  }),
  handler(async (req, res) => {
    try {
      const keep = JSON.parse(req.body.keepImageIds || "[]");
      assert(Array.isArray(keep) && keep.every(id => typeof id === "string"), "Select the images to keep.");
      const files = req.files || [];
      const { updated, removed } = await transaction(async () => {
        await superAdmin(req.user._id);
        await idle(req.params.ds);
        const record = await member(req.params.ds, "properties", req.params.id);
        const property = await models.properties.findById(record.documentId);
        assert(property, "Property not found.", 404);
        const original = property.images.map(image => String(image._id));
        assert(keep.every(id => original.includes(id)) && new Set(keep).size === keep.length, "The selected images changed. Refresh and try again.", 409);
        const images = property.images.filter(image => keep.includes(String(image._id)))
          .map(image => ({ ...image.toObject(), _id: String(image._id) }));
        assert(images.length + files.length <= 5, "A property supports at most five images.");
        images.push(...await buildVerifiedImagesFromFiles(files, property._id));
        assert(images.length > 0, "Keep or upload at least one image.");
        const updated = await saveRecord(req.params.ds, "properties", { images }, {
          id: property._id, revision: integer(req.body.revision, "Revision"), actor: req.user._id,
        });
        return { updated, removed: property.images.filter(image => !keep.includes(String(image._id)))
          .map(image => image.url).filter(url => url.startsWith("/uploads/properties/")) };
      });
      for (const url of removed) {
        try { deleteUploadedImage(url); } catch { /* The database update has committed; keep the new photos available. */ }
      }
      res.json(updated);
    } catch (error) {
      for (const file of req.files || []) deleteUploadedImage(`/uploads/properties/${file.filename}`);
      throw error;
    }
  }),
);
router.post(
  "/datasets/:ds/:entity",
  handler(async (req, res) =>
    res.status(201).json(
      await transaction(async () => {
        await superAdmin(req.user._id);
        await idle(req.params.ds);
        return saveRecord(req.params.ds, req.params.entity, req.body, {
          actor: req.user._id,
        });
      }),
    ),
  ),
);
router.patch(
  "/datasets/:ds/:entity/:id",
  handler(async (req, res) =>
    res.json(
      await transaction(async () => {
        await superAdmin(req.user._id);
        await idle(req.params.ds);
        return saveRecord(req.params.ds, req.params.entity, req.body.patch, {
          id: req.params.id,
          revision: integer(req.body.revision, "Revision"),
          actor: req.user._id,
        });
      }),
    ),
  ),
);
router.delete(
  "/datasets/:ds/:entity/:id",
  handler(async (req, res) => {
    const { SeedPlan, SeedItem } = await import("../services/seed/models.js");
    const plan = await SeedPlan.findById(req.body.planId);
    assert(
      plan?.action === "delete" &&
        plan.count === 1 &&
        (await SeedItem.exists({
          plan: plan._id,
          entity: req.params.entity,
          record: req.params.id,
        })),
      "Preview this single record deletion first.",
    );
    res
      .status(202)
      .json(await executeBulk(req.params.ds, req.body, req.user._id));
  }),
);
export default router;
