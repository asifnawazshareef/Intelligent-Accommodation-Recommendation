import "dotenv/config";
import mongoose from "mongoose";
import { initialize, requireWrite } from "../services/seed/store.js";
import { runNextJob } from "../services/seed/jobs.js";
import { safeError, integer } from "../services/seed/config.js";
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
  console.log("Seed worker ready.");
  while (!stopping) {
    const job = await runNextJob({
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
  await mongoose.disconnect();
}
