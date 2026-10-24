import crypto from "node:crypto";
import { pakistanCatalog, pakistanCatalogCities, catalogProperties, collectedCatalogStatus, collectedCatalog } from "./pakistanCatalog.js";
export class SeedError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
export const assert = (condition, message, status = 400) => {
  if (!condition) throw new SeedError(message, status);
};
export const entityNames = ["users", "properties", "bookings", "reviews"];
export const cities = [
  "Islamabad",
  "Lahore",
  "Karachi",
  "Murree",
  "Hunza",
  "Skardu",
  "Swat",
  "Rawalpindi",
];
// Shared by the dashboard and CLI. Every preset is a complete recipe so
// switching scenarios cannot retain settings from the previous selection.
const presetBase = {
  owners: 3, guests: 12, properties: 20, reviews: 60,
  seed: 42, cities, minPrice: 4000, maxPrice: 45000,
  approvedPercent: 90, positivePercent: 55, negativePercent: 15,
  neutralPercent: 15,
};
export const presetDescriptions = {
  small: "Quick demo",
  standard: "Large FYP dataset",
  guests: "Guests only",
  owners: "Owners only",
  users: "Guests and owners",
  listings: "Properties with owners",
  budget: "Budget accommodation",
  premium: "Premium accommodation",
  islamabad: "Islamabad city demo",
  lahore: "Lahore city demo",
  mountains: "Mountain destinations",
  positive: "Positive review examples",
  negative: "Negative review examples",
  neutral: "Neutral review examples",
  mixed: "Mixed review examples",
  pakistan: "Real Pakistani properties",
  pakistanCollected: "Collected Pakistani properties",
  pakistan1500: "1500 Pakistani properties from multiple websites",
};
export const presets = Object.fromEntries(Object.entries({
  pakistan: { propertySource: "pakistan_v1", owners: 3, guests: 12, properties: pakistanCatalog.length, reviews: 24, cities: pakistanCatalogCities, approvedPercent: 100 },
  small: {},
  standard: { owners: 50, guests: 450, properties: 1000, reviews: 5000 },
  guests: { owners: 0, guests: 50, properties: 0, reviews: 0 },
  owners: { owners: 20, guests: 0, properties: 0, reviews: 0 },
  users: { owners: 10, guests: 50, properties: 0, reviews: 0 },
  listings: { owners: 10, guests: 0, properties: 50, reviews: 0, approvedPercent: 100 },
  budget: { minPrice: 1500, maxPrice: 5000, approvedPercent: 100 },
  premium: { minPrice: 25000, maxPrice: 80000, approvedPercent: 100 },
  islamabad: { cities: ["Islamabad"], approvedPercent: 100 },
  lahore: { cities: ["Lahore"], approvedPercent: 100 },
  mountains: { cities: ["Murree", "Hunza", "Skardu", "Swat"], approvedPercent: 100 },
  positive: { positivePercent: 100, negativePercent: 0, neutralPercent: 0 },
  negative: { positivePercent: 0, negativePercent: 100, neutralPercent: 0 },
  neutral: { positivePercent: 0, negativePercent: 0, neutralPercent: 100 },
  mixed: { positivePercent: 0, negativePercent: 0, neutralPercent: 0 },
}).map(([key, values]) => [key, { ...presetBase, ...values }]));
export function getSeedPresets() {
  const c = collectedCatalogStatus();
  return { ...presets, ...(c.available > 0 && { pakistanCollected: {
    ...presets.standard, propertySource: "pakistan_collected_v1", catalogDigest: c.digest,
    owners: 50, guests: 450, properties: c.available, reviews: c.available * 4,
    cities: c.cities, approvedPercent: 100,
  } }), ...(c.ready && { pakistan1500: {
    ...presets.standard, propertySource: "pakistan_collected_v1", catalogDigest: c.digest,
    owners: 50, guests: 450, properties: 1500, reviews: 6000, cities: c.cities,
    approvedPercent: 100,
  } }) };
}
export const integer = (value, label, min = 0, max = 20000) => {
  const n = Number(value);
  assert(
    Number.isSafeInteger(n) && n >= min && n <= max,
    `${label} must be an integer from ${min} to ${max}.`,
  );
  return n;
};
export const dateString = (value) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value || "") &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString().slice(0, 10) === value;
export function recipe(input = {}) {
  const allowed = [
    "owners",
    "guests",
    "properties",
    "reviews",
    "seed",
    "referenceDate",
    "cities",
    "minPrice",
    "maxPrice",
    "approvedPercent",
    "positivePercent",
    "negativePercent",
    "neutralPercent",
    "propertySource",
    "catalogDigest",
  ];
  assert(
    Object.keys(input).every((k) => allowed.includes(k)),
    "Unknown generation option.",
  );
  const result = {
    ...presets.small,
    seed: 42,
    referenceDate: new Date().toISOString().slice(0, 10),
    cities,
    minPrice: 4000,
    maxPrice: 45000,
    approvedPercent: 90,
    positivePercent: 55,
    negativePercent: 15,
    neutralPercent: 15,
    ...input,
  };
  for (const key of ["owners", "guests", "properties", "reviews", "seed"])
    result[key] = integer(
      result[key],
      key,
      0,
      key === "seed" ? 2147483647 : 20000,
    );
  assert(
    result.owners + result.guests <= 5000 && result.properties <= 5000,
    "Limit: 5000 users and 5000 properties per request.",
  );
  for (const key of [
    "approvedPercent",
    "positivePercent",
    "negativePercent",
    "neutralPercent",
  ])
    result[key] = integer(result[key], key, 0, 100);
  assert(
    result.positivePercent + result.negativePercent + result.neutralPercent <=
      100,
    "Sentiment percentages must total at most 100. The remainder is mixed.",
  );
  assert(
    dateString(result.referenceDate),
    "A valid reference date is required.",
  );
  assert(
    result.referenceDate <= new Date().toISOString().slice(0, 10),
    "Reference date cannot be in the future.",
  );
  assert(
    Array.isArray(result.cities) &&
      result.cities.length > 0 &&
      result.cities.length <= (input.propertySource === "pakistan_collected_v1" ? 300 : 20) &&
      result.cities.every(
        (c) => typeof c === "string" && c.trim().length > 0 && c.length < 80,
      ),
    `Choose 1 to ${input.propertySource === "pakistan_collected_v1" ? 300 : 20} cities.`,
  );
  result.cities = [...new Set(result.cities.map((c) => c.trim()))];
  assert(input.propertySource === undefined || ["synthetic", "pakistan_v1", "pakistan_collected_v1"].includes(input.propertySource),
    "Choose synthetic properties or the Pakistani catalog.");
  if (result.propertySource === "pakistan_collected_v1") {
    assert(typeof result.catalogDigest === "string" && /^[a-f0-9]{64}$/.test(result.catalogDigest),
      "Collect and package the real property catalog before seeding it.");
    let catalog;
    try { catalog = collectedCatalog(result.catalogDigest); } catch { assert(false, "The selected collected catalog is missing or damaged. Restore its snapshot before retrying."); }
    assert(catalog.properties.length >= result.properties, "The collected catalog has fewer properties than requested.");
  } else assert(result.catalogDigest === undefined, "A catalog digest is only valid for collected properties.");
  if (["pakistan_v1", "pakistan_collected_v1"].includes(result.propertySource)) {
    const available = catalogProperties(result.cities, result.propertySource, result.catalogDigest);
    assert(result.properties > 0 && result.properties <= available.length,
      `The selected cities contain ${available.length} catalog properties. Choose 1 to ${available.length} properties. Real hotel names are never repeated within a generation.`);
  }

  result.minPrice = integer(result.minPrice, "Minimum price", 1, 1000000);
  result.maxPrice = integer(
    result.maxPrice,
    "Maximum price",
    result.minPrice,
    1000000,
  );
  assert(
    !result.properties || result.owners > 0,
    "Properties require at least one owner.",
  );
  const approved = Math.floor(
    (result.properties * result.approvedPercent) / 100,
  );
  assert(
    !result.reviews || (result.guests > 0 && approved > 0),
    "Reviews require guests and approved properties in this generation request.",
  );
  assert(
    result.owners + result.guests + result.properties + result.reviews > 0,
    "Choose at least one record.",
  );
  return result;
}
export const stableId = (...parts) =>
  crypto
    .createHash("sha256")
    .update(parts.join(":"))
    .digest("hex")
    .slice(0, 24);
const canonical = (value) =>
  Array.isArray(value)
    ? value.map(canonical)
    : value && typeof value === "object"
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((key) => [key, canonical(value[key])]),
        )
      : value;
export const digest = (value) =>
  crypto
    .createHash("sha256")
    .update(JSON.stringify(canonical(JSON.parse(JSON.stringify(value)))))
    .digest("hex");
export function fingerprint(doc) {
  const value = JSON.parse(JSON.stringify(doc));
  delete value.__v;
  delete value.updatedAt;
  delete value.sentimentSnapshot;
  delete value.password;
  return digest(value);
}
export function safeError(error) {
  if (error instanceof SeedError) return error.message;
  if (error.code === 11000)
    return "A unique value already exists. Refresh the preview and choose a different value.";
  if (error.name === "ValidationError" || error.name === "CastError")
    return "A record failed schema validation. Check its field types and required values.";
  return "The operation failed. Check the database connection and retry. No credentials are included in this report.";
}
export const enabled = () =>
  process.env.SEED_DASHBOARD_ENABLED === "true" &&
  process.env.NODE_ENV !== "production";
export function demoPassword() {
  const password = process.env.SEED_DEMO_PASSWORD;
  assert(
    typeof password === "string" &&
      password.length >= 10 &&
      Buffer.byteLength(password, "utf8") <= 72,
    "Set SEED_DEMO_PASSWORD to 10 or more characters and at most 72 UTF-8 bytes.",
  );
  return password;
}
