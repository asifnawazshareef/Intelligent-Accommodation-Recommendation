import "dotenv/config";
import mongoose from "mongoose";
import crypto from "node:crypto";
import { initialize, requireWrite } from "../services/seed/store.js";
import { runNextJob } from "../services/seed/jobs.js";
import { safeError, integer } from "../services/seed/config.js";
import { heartbeat, queueLegacyReviewRecovery } from "../services/seed/recovery.js";
import { SeedWorker } from "../services/seed/models.js";
const workerId = crypto.randomUUID();
let heartbeatTimer;
let stopping = false;
process.on("SIGINT", () => {
  stopping = true;
});
process.on("SIGTERM", () => {
  stopping = true;
});
try {
  await mongoose.connect(process.env.MONGO_URI);
  await requireWrite();
  await initialize();
  await heartbeat(workerId);
  heartbeatTimer = setInterval(() => heartbeat(workerId).catch(() => {}), 10000);
  let nextRecoveryCheck = 0;
  console.log("Seed worker ready.");
  while (!stopping) {
    if (Date.now() >= nextRecoveryCheck) {
      const recovery = await queueLegacyReviewRecovery();
      for (const item of recovery.queued) console.log(`Queued model analysis for ${item.reviews} existing demo reviews. Job ${item.job}.`);
      if (recovery.waitingForModel) console.log("Existing demo reviews are waiting for the sentiment model. Retrying automatically.");
      for (const item of recovery.blocked) console.error(`Review recovery needs attention for dataset ${item.dataset}: ${item.message}`);
      nextRecoveryCheck = Date.now() + (recovery.waitingForModel ? 5000 : 30000);
    }
    const job = await runNextJob({
      workerId,
      batchSize: integer(
        process.env.SEED_BATCH_SIZE || 25,
        "Batch size",
        1,
        100,
      ),
    });
    if (job)
      console.log(
        `Seed job ${job._id}: ${job.state}, ${job.cursor}/${job.total}`,
      );
    else await new Promise((resolve) => setTimeout(resolve, 1000));
  }
} catch (e) {
  console.error(safeError(e));
  process.exitCode = 1;
} finally {
  clearInterval(heartbeatTimer);
  if (mongoose.connection.readyState === 1) await SeedWorker.deleteOne({ _id: workerId }).catch(() => {});
  await mongoose.disconnect();
}
