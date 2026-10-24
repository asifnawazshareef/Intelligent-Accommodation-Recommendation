import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";
import { isDeepStrictEqual } from "node:util";
import { parseProperty, propertyKey } from "./parsers.js";
import { allowedUrl } from "./network.js";
import { collectedCatalog } from "../pakistanCatalog.js";

export async function packageCatalog(input, directory, sourceCache, { partial = false, resume } = {}) {
  if (!Array.isArray(input.properties) || (partial ? input.properties.length < 1 || input.properties.length > 1500 : input.properties.length !== 1500))
    throw new Error("Exactly 1500 collected properties are required. No fallback records will be invented.");
  // A checkpoint cannot grant trust to itself. Only unchanged records from an
  // integrity checked, installed snapshot can substitute for a local page cache.
  const trusted = new Map(input.trustedCatalogDigest
    ? collectedCatalog(input.trustedCatalogDigest).properties.map(p => [p.id, p]) : []);
  {
    const audited = [];
    for (const p of input.properties) {
      const key = crypto.createHash("sha256").update(p.sourceUrl).digest("hex");
      let html;
      try { if (sourceCache) html = await fs.readFile(path.join(sourceCache, key + ".html"), "utf8"); }
      catch (e) { if (e.code !== "ENOENT") throw e; }
      if (html === undefined) {
        if (!isDeepStrictEqual(trusted.get(p.id), p)) throw new Error(`Cached source missing and no unchanged trusted record: ${p.id}`);
        audited.push(p); continue;
      }
      const source = parseProperty(html, p.sourceUrl);
      if (!source || source.title !== p.title || source.city !== p.city || source.address !== p.address ||
          p.images.some(image => !source.images.some(match => match.url === image.url)))
        throw new Error(`Cached source does not confirm this property's fields and gallery: ${p.id}`);
      audited.push({ ...p, description: source.description });
    }
    input = { ...input, properties: audited };
  }
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
  let recovery;
  if (resume) {
    // Metadata and public URLs only. Never distribute cached source HTML.
    recovery = {
      pending: (resume.pending || []).filter(t => allowedUrl(t.url) && ["list", "detail"].includes(t.kind))
        .map(t => ({ url: t.url, kind: t.kind })),
      seen: (resume.seen || []).filter(u => allowedUrl(u)),
      pages: Number.isSafeInteger(resume.pages) ? resume.pages : 0,
    };
  }
  const bytes = Buffer.from(JSON.stringify({ version: "pakistan_collected_v1", target: 1500,
    properties: input.properties, ...(recovery && { resume: recovery }) }));
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
  const info = { digest, properties: input.properties.length, target: 1500,
    remaining: 1500 - input.properties.length, ready: input.properties.length === 1500,
    photos: photos.size, sources: [...sources] };
  await fs.writeFile(path.join(directory, "index.json.tmp"), JSON.stringify(info, null, 2));
  await fs.rename(path.join(directory, "index.json.tmp"), path.join(directory, "index.json"));
  return info;
}
