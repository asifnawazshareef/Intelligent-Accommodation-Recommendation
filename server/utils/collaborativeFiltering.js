import Booking from "../models/Booking.js";
import PropertyView from "../models/PropertyView.js";

const addPairScore = (matrix, sourceId, targetId, weight) => {
  if (!sourceId || !targetId || sourceId === targetId) {
    return;
  }

  if (!matrix[sourceId]) {
    matrix[sourceId] = {};
  }

  matrix[sourceId][targetId] = (matrix[sourceId][targetId] || 0) + weight;
};

const buildPairsFromUserItems = (matrix, itemIds, weight) => {
  const uniqueIds = [...new Set(itemIds.filter(Boolean))];

  for (let i = 0; i < uniqueIds.length; i += 1) {
    for (let j = 0; j < uniqueIds.length; j += 1) {
      if (i === j) {
        continue;
      }
      addPairScore(matrix, uniqueIds[i], uniqueIds[j], weight);
    }
  }
};

export const buildCoOccurrenceMatrix = async () => {
  const matrix = {};

  const [bookings, views] = await Promise.all([
    Booking.find({
      status: { $in: ["confirmed", "pending"] },
    })
      .select("guest property")
      .lean(),
    PropertyView.find().select("user property").lean(),
  ]);

  const bookingsByGuest = new Map();
  bookings.forEach((booking) => {
    const guestId = booking.guest?.toString();
    const propertyId = booking.property?.toString();
    if (!guestId || !propertyId) {
      return;
    }

    if (!bookingsByGuest.has(guestId)) {
      bookingsByGuest.set(guestId, []);
    }
    bookingsByGuest.get(guestId).push(propertyId);
  });

  bookingsByGuest.forEach((propertyIds) => {
    buildPairsFromUserItems(matrix, propertyIds, 1);
  });

  const viewsByGuest = new Map();
  views.forEach((view) => {
    const guestId = view.user?.toString();
    const propertyId = view.property?.toString();
    if (!guestId || !propertyId) {
      return;
    }

    if (!viewsByGuest.has(guestId)) {
      viewsByGuest.set(guestId, []);
    }
    viewsByGuest.get(guestId).push(propertyId);
  });

  viewsByGuest.forEach((propertyIds) => {
    buildPairsFromUserItems(matrix, propertyIds, 0.35);
  });

  return matrix;
};

export const computeCollaborativeScore = (
  candidateId,
  interactionPropertyIds = [],
  coOccurrenceMatrix = {},
) => {
  const candidateKey = candidateId?.toString?.() || "";
  if (!candidateKey || interactionPropertyIds.length === 0) {
    return 0;
  }

  let score = 0;
  let comparisons = 0;

  interactionPropertyIds.forEach((sourceId) => {
    const related = coOccurrenceMatrix[sourceId]?.[candidateKey];
    if (related) {
      score += Math.min(related / 4, 1);
      comparisons += 1;
    }
  });

  if (comparisons === 0) {
    return 0;
  }

  return Math.min(score / comparisons, 1);
};
