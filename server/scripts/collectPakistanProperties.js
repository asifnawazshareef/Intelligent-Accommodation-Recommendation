import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs/promises";
import { packageCatalog } from "../services/seed/collection/package.js";
import { collect } from "../services/seed/collection/collector.js";
const directory = fileURLToPath(new URL("../data/pakistan-collection/", import.meta.url));
const options = { directory };
for (let i = 2; i < process.argv.length; i += 2) {
  const key = process.argv[i], value = process.argv[i+1];
  if (!["--target", "--photos", "--directory"].includes(key) || !value) throw new Error("Use --target 1500, --photos 2 to 5 or --directory PATH.");
  options[key === "--target" ? "target" : key === "--photos" ? "maxImages" : "directory"] = key === "--directory" ? path.resolve(value) : Number(value);
}
const controller = new AbortController();
process.on("SIGINT", () => controller.abort()); process.on("SIGTERM", () => controller.abort());
try { const report = await collect({ ...options, signal: controller.signal }); console.log(JSON.stringify(report, null, 2));
  if (report.status === "ready" && options.target !== 1500 && options.target !== undefined) console.log("Collection complete. Exactly 1500 properties are required for the dashboard preset.");
  else if (report.status === "ready") console.log(JSON.stringify(await packageCatalog(JSON.parse(await fs.readFile(report.catalogPath, "utf8")), fileURLToPath(new URL("../data/pakistan-1500/", import.meta.url)), path.join(options.directory, "cache")), null, 2));
  else process.exitCode = 2; }
catch (e) { console.error(e.message); process.exitCode = 1; }
