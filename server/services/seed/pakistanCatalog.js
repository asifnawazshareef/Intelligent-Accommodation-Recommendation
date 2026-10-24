import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import crypto from "node:crypto";

// Versioned, bundled data. Generation never depends on a live image/search API.
const catalog = JSON.parse(readFileSync(
  new URL("../../public/seed/pakistan/v1/catalog.json", import.meta.url), "utf8",
));
export const pakistanCatalog = catalog.properties;
export const pakistanCatalogCities = [...new Set(pakistanCatalog.map(p => p.city))];
export const catalogProperties = (selectedCities, source = "pakistan_v1", digest) =>
  (source === "pakistan_collected_v1" ? collectedCatalog(digest).properties : pakistanCatalog)
    .filter(p => selectedCities.includes(p.city));

// Collected catalogs are immutable snapshots, pinned by their content digest.
// A new collection can become active without changing existing dataset recipes.

const collectedRoot = new URL("../../data/pakistan-1500/", import.meta.url);
const snapshots = new Map();
export function collectedCatalog(digest) {
  if (!digest) {
    try { digest = JSON.parse(readFileSync(new URL("index.json", collectedRoot), "utf8")).digest; }
    catch { return { properties: [], digest: null }; }
  }
  if (!/^[a-f0-9]{64}$/.test(digest)) throw new Error("Invalid collected catalog digest.");
  if (snapshots.has(digest)) return snapshots.get(digest);
  const bytes = gunzipSync(readFileSync(new URL(`${digest}.json.gz`, collectedRoot)), { maxOutputLength: 30_000_000 });
  if (crypto.createHash("sha256").update(bytes).digest("hex") !== digest) throw new Error("Collected catalog integrity check failed.");
  const data = JSON.parse(bytes);
  if (!Array.isArray(data.properties) || data.properties.length > 5000) throw new Error("Invalid collected catalog.");
  const result = { ...data, digest }; snapshots.set(digest, result); return result;
}
export function collectedCatalogStatus() {
  try {
    const c = collectedCatalog(), hosts = [...new Set(c.properties.map(p => new URL(p.sourceUrl).hostname))];
    return { available: c.properties.length, target: 1500, digest: c.digest,
      ready: c.properties.length >= 1500 && hosts.length >= 2,
      sources: hosts, images: c.properties.reduce((n, p) => n + p.images.length, 0),
      cities: [...new Set(c.properties.map(p => p.city))] };
  } catch { return { available: 0, target: 1500, ready: false, digest: null, sources: [], cities: [], images: 0 }; }
}
