import "dotenv/config";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import mongoose from "mongoose";
import { recipe, presets, assert, safeError } from "../services/seed/config.js";
import { buildDataset } from "../services/seed/generator.js";
import {
  initialize,
  superAdmin,
  requireWrite,
} from "../services/seed/store.js";
import {
  createDataset,
  previewGeneration,
  startJob,
} from "../services/seed/management.js";
import { SeedDataset } from "../services/seed/models.js";
import { runNextJob } from "../services/seed/jobs.js";
try {
  const args = process.argv.slice(2);
  const options = {};
  for (let i = 0; i < args.length; i++) {
    assert(
      [
        "--apply",
        "--standard",
        "--config",
        "--namespace",
        "--actor",
        "--append",
      ].includes(args[i]),
      `Unknown argument: ${args[i]}`,
    );
    const key = args[i];
    if (["--config", "--namespace", "--actor"].includes(key)) {
      assert(
        args[i + 1] && !args[i + 1].startsWith("--"),
        `Supply a value for ${key}.`,
      );
      options[key] = args[++i];
    } else {
      options[key] = true;
    }
  }
  let config = recipe(
    options["--config"]
      ? JSON.parse(await fs.readFile(options["--config"], "utf8"))
      : options["--standard"]
        ? presets.standard
        : presets.small,
  );
  const namespace = options["--namespace"] || "fyp_demo";
  if (!options["--apply"]) {
    const items = buildDataset(namespace, config);
    console.log(
      JSON.stringify(
        {
          mode: "preview",
          recipe: config,
          records: items.length,
          samples: ["users", "properties", "bookings", "reviews"].map((e) =>
            items.find((i) => i.entity === e),
          ),
        },
        null,
        2,
      ),
    );
  } else {
    assert(
      process.env.NODE_ENV !== "production",
      "Production seeding is disabled.",
    );
    assert(
      process.env.SEED_MONGO_URI && process.env.SEED_DATABASE_NAME,
      "Set SEED_MONGO_URI and SEED_DATABASE_NAME explicitly.",
    );
    assert(
      options["--actor"],
      "Supply --actor with the ID of an existing super admin in the seed database.",
    );
    process.env.SEED_DASHBOARD_ENABLED = "true";
    await mongoose.connect(process.env.SEED_MONGO_URI);
    await requireWrite();
    await initialize();
    await superAdmin(options["--actor"]);
    let ds = await SeedDataset.findOne({ namespace });
    if (!ds)
      ds = await createDataset(
        { name: "FYP demo", namespace, recipe: config },
        options["--actor"],
      );
    if (!options["--append"] && !options["--config"]) config = ds.recipe;
    const preview = await previewGeneration(
      ds._id,
      { recipe: config },
      options["--actor"],
    );
    const job = await startJob(
      ds._id,
      {
        kind: options["--append"] ? "append" : "generate",
        recipe: config,
        confirmation: preview.confirmation,
        requestKey: crypto.randomUUID(),
      },
      options["--actor"],
    );
    console.log(`Queued job ${job._id}.`);
    const result = await runNextJob({ jobId: job._id });
    assert(
      result && String(result._id) === String(job._id),
      "Another worker claimed this job. Follow its status in the dashboard.",
    );
    console.log(
      JSON.stringify({
        state: result.state,
        total: result.total,
        created: result.succeeded,
        skipped: result.skipped,
        error: result.error,
      }),
    );
    if (result.state !== "completed") process.exitCode = 1;
  }
} catch (e) {
  console.error(safeError(e));
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
