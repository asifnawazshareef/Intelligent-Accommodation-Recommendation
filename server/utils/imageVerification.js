import crypto from "crypto";
import fs from "fs";
import path from "path";
import Property from "../models/Property.js";
import { PROPERTY_UPLOAD_DIR } from "../middleware/uploadMiddleware.js";
import {
  computeImageAiScore,
  DUPLICATE_SCORE,
  shouldRecalculateAiScore,
} from "./imageAiScore.js";

export const DEFAULT_VALID_SCORE = 0.85;
export { DUPLICATE_SCORE };
export const INVALID_SCORE = 0;export const MAX_IMAGES_PER_PROPERTY = 5;

export const VERIFICATION_STATUSES = [
  "pending",
  "verified",
  "suspicious",
  "rejected",
];

export const computeFileHash = (filePath) => {
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(buffer).digest("hex");
};

export const toPublicImageUrl = (filename) => `/uploads/properties/${filename}`;

export const getAbsoluteUploadPath = (publicUrl) => {
  if (!publicUrl?.startsWith("/uploads/properties/")) {
    return null;
  }

  const filename = path.basename(publicUrl);
  return path.join(PROPERTY_UPLOAD_DIR, filename);
};

export const deleteUploadedImage = (publicUrl) => {
  const absolutePath = getAbsoluteUploadPath(publicUrl);

  if (!absolutePath || !fs.existsSync(absolutePath)) {
    return;
  }

  fs.unlinkSync(absolutePath);
};

export const collectExistingImageHashes = async (excludePropertyId = null) => {
  const filter = excludePropertyId ? { _id: { $ne: excludePropertyId } } : {};
  const properties = await Property.find(filter).select("images.hash images.url");
  const hashes = new Set();

  properties.forEach((property) => {
    property.images.forEach((image) => {
      if (image.hash?.trim()) {
        hashes.add(image.hash.trim());
      }
    });
  });

  return hashes;
};

export const buildVerifiedImagesFromFiles = async (
  files = [],
  propertyId = null,
) => {
  const existingHashes = await collectExistingImageHashes(propertyId);
  const seenInBatch = new Set();
  const results = [];

  for (const file of files) {
    const absolutePath = file.path;
    const hash = computeFileHash(absolutePath);
    const url = toPublicImageUrl(file.filename);
    const uploadedAt = new Date();

    if (seenInBatch.has(hash)) {
      deleteUploadedImage(url);
      continue;
    }

    seenInBatch.add(hash);

    if (existingHashes.has(hash)) {
      results.push({
        url,
        verificationStatus: "suspicious",
        aiScore: computeImageAiScore(absolutePath, { isDuplicate: true }),
        hash,
        uploadedAt,
      });
      continue;
    }

    results.push({
      url,
      verificationStatus: "pending",
      aiScore: computeImageAiScore(absolutePath),
      hash,
      uploadedAt,
    });  }

  return results;
};

export const filterPublicImages = (images = []) =>
  images.filter((image) => image.verificationStatus !== "rejected");

export const filterGuestImages = (images = []) =>
  images.filter((image) => image.verificationStatus === "verified");

export const summarizeImageVerification = (images = []) => {
  const summary = {
    total: images.length,
    pending: 0,
    verified: 0,
    suspicious: 0,
    rejected: 0,
  };

  images.forEach((image) => {
    if (summary[image.verificationStatus] !== undefined) {
      summary[image.verificationStatus] += 1;
    }
  });

  return summary;
};

export const hasVerifiedImage = (images = []) =>
  summarizeImageVerification(images).verified > 0;

export const refreshPendingImageScores = async (property) => {
  if (!property?.images?.length) {
    return false;
  }

  let changed = false;

  property.images.forEach((image) => {
    if (!shouldRecalculateAiScore(image)) {
      return;
    }

    const absolutePath = getAbsoluteUploadPath(image.url);
    if (!absolutePath) {
      return;
    }

    const nextScore = computeImageAiScore(absolutePath);
    if (Math.abs((image.aiScore ?? 0) - nextScore) > 0.0001) {
      image.aiScore = nextScore;
      changed = true;
    }
  });

  if (changed) {
    property.markModified("images");
    await property.save();
  }

  return changed;
};
export const sanitizePropertyImages = (
  property,
  { includeRejected = false, verifiedOnly = false } = {},
) => {
  if (!property) {
    return property;
  }

  const plain =
    typeof property.toObject === "function" ? property.toObject() : { ...property };

  if (verifiedOnly) {
    plain.images = filterGuestImages(plain.images || []);
  } else if (!includeRejected) {
    plain.images = filterPublicImages(plain.images || []);
  }

  return plain;
};

// Legacy URL-based helper kept for backward compatibility with old records.
export const buildVerifiedImages = async (
  imageInputs = [],
  propertyId = null,
  previousImages = [],
) => {
  const previousByUrl = new Map(
    previousImages.map((image) => [image.url.trim().toLowerCase(), image]),
  );
  const results = [];

  for (const input of imageInputs) {
    const trimmed = input?.url?.trim() || "";
    const previous = previousByUrl.get(trimmed.toLowerCase());

    if (previous) {
      results.push({
        url: previous.url,
        verificationStatus: previous.verificationStatus,
        aiScore: previous.aiScore,
        hash: previous.hash || "",
        uploadedAt: previous.uploadedAt || previous.createdAt || new Date(),
      });
      continue;
    }

    if (trimmed.startsWith("/uploads/properties/")) {
      results.push({
        url: trimmed,
        verificationStatus: input.verificationStatus || "pending",
        aiScore: input.aiScore ?? 0,
        hash: input.hash || "",
        uploadedAt: input.uploadedAt || new Date(),
      });
      continue;
    }

    results.push({
      url: trimmed,
      verificationStatus: "rejected",
      aiScore: INVALID_SCORE,
      hash: "",
      uploadedAt: new Date(),
    });
  }

  return results;
};
