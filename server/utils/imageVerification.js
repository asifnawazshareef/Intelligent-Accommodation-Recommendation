import Property from "../models/Property.js";

export const DEFAULT_VALID_SCORE = 0.85;
export const DUPLICATE_SCORE = 0.45;
export const INVALID_SCORE = 0;

export const VERIFICATION_STATUSES = [
  "pending",
  "verified",
  "suspicious",
  "rejected",
];

export const isValidImageUrl = (url) => {
  if (!url || typeof url !== "string" || !url.trim()) {
    return false;
  }

  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

export const collectExistingImageUrls = async (excludePropertyId = null) => {
  const filter = excludePropertyId ? { _id: { $ne: excludePropertyId } } : {};
  const properties = await Property.find(filter).select("images.url");
  const urls = [];

  properties.forEach((property) => {
    property.images.forEach((image) => {
      if (image.url?.trim()) {
        urls.push(image.url.trim().toLowerCase());
      }
    });
  });

  return urls;
};

export const buildVerifiedImages = async (
  imageInputs = [],
  propertyId = null,
  previousImages = [],
) => {
  const existingUrls = await collectExistingImageUrls(propertyId);
  const previousByUrl = new Map(
    previousImages.map((image) => [image.url.trim().toLowerCase(), image]),
  );
  const seenInBatch = new Set();
  const results = [];

  for (const input of imageInputs) {
    const trimmed = input?.url?.trim() || "";

    if (!trimmed || !isValidImageUrl(trimmed)) {
      results.push({
        url: trimmed || input?.url || "",
        verificationStatus: "rejected",
        aiScore: INVALID_SCORE,
      });
      continue;
    }

    const normalized = trimmed.toLowerCase();

    if (seenInBatch.has(normalized)) {
      results.push({
        url: trimmed,
        verificationStatus: "suspicious",
        aiScore: DUPLICATE_SCORE,
      });
      continue;
    }

    seenInBatch.add(normalized);

    const previous = previousByUrl.get(normalized);
    if (previous) {
      results.push({
        url: trimmed,
        verificationStatus: previous.verificationStatus,
        aiScore: previous.aiScore,
      });
      continue;
    }

    if (existingUrls.includes(normalized)) {
      results.push({
        url: trimmed,
        verificationStatus: "suspicious",
        aiScore: DUPLICATE_SCORE,
      });
      continue;
    }

    results.push({
      url: trimmed,
      verificationStatus: "pending",
      aiScore: DEFAULT_VALID_SCORE,
    });
  }

  return results;
};
