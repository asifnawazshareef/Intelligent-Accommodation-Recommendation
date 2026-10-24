import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";
import { propertyKey } from "./parsers.js";
import { allowedUrl } from "./network.js";
export async function packageCatalog(input, directory) {
  if (!Array.isArray(input.properties) || input.properties.length !== 1500) throw new Error("Exactly 1500 collected properties are required. No fallback records will be invented.");
  const ids = new Set(), keys = new Set(), photos = new Set(), sources = new Set();
  for (const p of input.properties) {
    if (!p.id || ids.has(p.id) || keys.has(propertyKey(p)) || p.country !== "Pakistan" || !p.title || !p.address || !p.city || !allowedUrl(p.sourceUrl)) throw new Error("Invalid or duplicate real property.");
    ids.add(p.id); keys.add(propertyKey(p)); sources.add(new URL(p.sourceUrl).hostname);
    if (!Array.isArray(p.images) || p.images.length < 2 || p.images.length > 5) throw new Error("Each property needs 2 to 5 real gallery photos.");
    for (const image of p.images) {
      if (!allowedUrl(image.url, true) || !/^[a-f0-9]{64}$/.test(image.sha256) || photos.has(image.sha256) || !image.caption || image.credit?.sourceUrl !== p.sourceUrl)
        throw new Error("Invalid, duplicate or unmatched photo reference.");
      photos.add(image.sha256);
    }
  }
  if (sources.size < 2) throw new Error("The catalog needs qualified properties from at least two websites.");
  const bytes = Buffer.from(JSON.stringify({ version: "pakistan_collected_v1", properties: input.properties }));
  const digest = crypto.createHash("sha256").update(bytes).digest("hex");
  await fs.mkdir(directory, { recursive: true });
  const target = path.join(directory, `${digest}.json.gz`);
  try {
    const existing = gunzipSync(await fs.readFile(target));
    if (crypto.createHash("sha256").update(existing).digest("hex") !== digest) throw new Error("An existing catalog snapshot is damaged.");
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
    await fs.writeFile(target + ".tmp", gzipSync(bytes)); await fs.rename(target + ".tmp", target);
  }
  await fs.writeFile(path.join(directory, "index.json.tmp"), JSON.stringify({ digest, properties: 1500, photos: photos.size, sources: [...sources] }, null, 2));
  await fs.rename(path.join(directory, "index.json.tmp"), path.join(directory, "index.json"));
  return { digest, properties: 1500, photos: photos.size, sources: [...sources] };
}
