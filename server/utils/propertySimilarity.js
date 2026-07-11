import { computeAmenityScore } from "./propertySignals.js";

const AMENITY_KEYWORDS = [
  "wifi",
  "wi-fi",
  "internet",
  "parking",
  "pool",
  "breakfast",
  "kitchen",
  "ac",
  "air condition",
  "heater",
  "elevator",
  "lift",
  "restaurant",
  "gym",
  "spa",
  "balcony",
  "garden",
  "laundry",
];

export const extractAmenitySet = (description = "") => {
  const lower = description.toLowerCase();
  return new Set(
    AMENITY_KEYWORDS.filter((keyword) => lower.includes(keyword)),
  );
};

const PROPERTY_TYPE_KEYWORDS = [
  { type: "chalet", keywords: ["chalet", "cottage", "cabin", "lodge"] },
  { type: "villa", keywords: ["villa", "bungalow", "mansion"] },
  { type: "apartment", keywords: ["apartment", "flat", "studio", "condo"] },
  { type: "resort", keywords: ["resort", "hotel", "inn", "guest house"] },
];

export const inferPropertyType = (title = "", description = "") => {
  const text = `${title} ${description}`.toLowerCase();

  for (const entry of PROPERTY_TYPE_KEYWORDS) {
    if (entry.keywords.some((keyword) => text.includes(keyword))) {
      return entry.type;
    }
  }

  return "property";
};

export const computeAmenityOverlapScore = (candidateDescription = "", preferredAmenities = []) => {
  if (!preferredAmenities.length) {
    return 0;
  }

  const candidateAmenities = extractAmenitySet(candidateDescription);
  const preferredSet = new Set(preferredAmenities);
  return jaccardSimilarity(candidateAmenities, preferredSet);
};

const jaccardSimilarity = (setA, setB) => {
  if (setA.size === 0 && setB.size === 0) {
    return 0.5;
  }

  if (setA.size === 0 || setB.size === 0) {
    return 0.15;
  }

  let intersection = 0;
  setA.forEach((item) => {
    if (setB.has(item)) {
      intersection += 1;
    }
  });

  const union = setA.size + setB.size - intersection;
  return union > 0 ? intersection / union : 0;
};

const priceSimilarity = (priceA, priceB) => {
  if (!priceA || !priceB) {
    return 0.35;
  }

  const difference = Math.abs(priceA - priceB) / Math.max(priceA, priceB);
  if (difference <= 0.1) return 1;
  if (difference <= 0.2) return 0.85;
  if (difference <= 0.35) return 0.65;
  if (difference <= 0.5) return 0.4;
  return Math.max(0, 1 - difference);
};

const citySimilarity = (cityA = "", cityB = "") => {
  const a = cityA.trim().toLowerCase();
  const b = cityB.trim().toLowerCase();

  if (!a || !b) {
    return 0.2;
  }

  return a === b ? 1 : 0.1;
};

const sentimentSimilarity = (propertyA, propertyB) => {
  const a =
    propertyA.sentimentSummary?.positivePercent ??
    propertyA.sentimentSnapshot?.positivePercent ??
    50;
  const b =
    propertyB.sentimentSummary?.positivePercent ??
    propertyB.sentimentSnapshot?.positivePercent ??
    50;
  const diff = Math.abs(a - b) / 100;
  return 1 - diff;
};

export const computePropertyContentSimilarity = (candidate, reference) => {
  const candidateAmenities = extractAmenitySet(candidate.description);
  const referenceAmenities = extractAmenitySet(reference.description);

  const cityScore = citySimilarity(
    candidate.location?.city,
    reference.location?.city,
  );
  const priceScore = priceSimilarity(candidate.price, reference.price);
  const amenityScore = jaccardSimilarity(candidateAmenities, referenceAmenities);
  const sentimentScore = sentimentSimilarity(candidate, reference);

  return (
    cityScore * 0.32 +
    priceScore * 0.28 +
    amenityScore * 0.22 +
    sentimentScore * 0.18
  );
};

export const computeWeightedContentSimilarity = (candidate, interactions = []) => {
  if (!interactions.length) {
    return 0;
  }

  let weightedSum = 0;
  let totalWeight = 0;

  interactions.forEach((interaction) => {
    const reference = interaction.property;
    if (!reference) {
      return;
    }

    const similarity = computePropertyContentSimilarity(candidate, reference);
    weightedSum += similarity * interaction.weight;
    totalWeight += interaction.weight;
  });

  return totalWeight > 0 ? weightedSum / totalWeight : 0;
};

export const amenityRichnessScore = (description = "") =>
  Math.min(extractAmenitySet(description).size / 4, 1);
