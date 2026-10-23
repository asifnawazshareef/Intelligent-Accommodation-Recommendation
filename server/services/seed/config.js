import crypto from "node:crypto";
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
export const presets = {
  small: { owners: 3, guests: 12, properties: 20, reviews: 60 },
  standard: { owners: 50, guests: 450, properties: 1000, reviews: 5000 },
};
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
      result.cities.length <= 20 &&
      result.cities.every(
        (c) => typeof c === "string" && c.trim().length > 0 && c.length < 80,
      ),
    "Choose 1 to 20 cities.",
  );
  result.cities = [...new Set(result.cities.map((c) => c.trim()))];
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
