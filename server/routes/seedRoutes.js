import { pakistanCatalogCities, pakistanCatalog } from "../services/seed/pakistanCatalog.js";
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
  presets,
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
  idle,
  csv,
} from "../services/seed/management.js";
import { controlJob } from "../services/seed/jobs.js";
const router = express.Router();
const handler = (fn) => async (req, res, next) => {
  try {
    await fn(req, res);
  } catch (e) {
    res
      .status(e instanceof SeedError ? e.status : e.code === 11000 ? 409 : 400)
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
    res.json({ ...(await capabilities()), presets, presetDescriptions, cities, propertyCatalog: { count: pakistanCatalog.length, cities: pakistanCatalogCities } }),
  ),
);
router.get(
  "/datasets",
  handler(async (req, res) => {
    const docs = await SeedDataset.find()
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
router.post(
  "/datasets/:ds/jobs",
  handler(async (req, res) =>
    res.status(202).json(await startJob(req.params.ds, req.body, req.user._id)),
  ),
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
