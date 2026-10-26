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
// The PC hotel snapshot contains several incorrect city labels. Use the
// other source snapshots for the supervisor demo and spread selection by city.
export function supervisorProperties(selectedCities, digest) {
  const seen = new Set();
  const groups = new Map();
  for (const property of catalogProperties(selectedCities, "pakistan_collected_v1", digest)) {
    if (new URL(property.sourceUrl).hostname === "www.pchotels.com" || !/\bhotel\b/i.test(property.title)) continue;
    const title = property.title.trim().toLocaleLowerCase("en");
    if (seen.has(title)) continue;
    seen.add(title);
    if (!groups.has(property.city)) groups.set(property.city, []);
    groups.get(property.city).push(property);
  }
  const result = [];
  for (let index = 0; result.length < seen.size; index++) {
    for (const group of groups.values())
      if (group[index]) result.push(group[index]);
  }
  return result;
}

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

export function catalogSummary(source, digest) {
  if (!["pakistan_v1", "pakistan_collected_v1"].includes(source)) throw new Error("Unknown property catalog.");
  const data = source === "pakistan_collected_v1" ? collectedCatalog(digest) : { properties: pakistanCatalog, digest: null };
  const cities = new Map(), sources = new Map();
  for (const property of data.properties) {
    const photos = property.images.length;
    for (const [map, key] of [[cities, property.city], [sources, new URL(property.sourceUrl).hostname]]) {
      const counts = map.get(key) || { properties: 0, photos: 0 };
      counts.properties++; counts.photos += photos; map.set(key, counts);
    }
  }
  return {
    source, digest: data.digest, available: data.properties.length,
    photos: data.properties.reduce((n, p) => n + p.images.length, 0),
    cities: [...cities].map(([city, counts]) => ({ city, ...counts })).sort((a, b) => a.city.localeCompare(b.city)),
    sources: [...sources].map(([host, counts]) => ({ host, ...counts })),
  };
}
