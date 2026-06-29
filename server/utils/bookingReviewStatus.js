import Review from "../models/Review.js";

export const getReviewedBookingIds = async (bookingIds) => {
  if (!bookingIds?.length) {
    return new Set();
  }

  const reviewedIds = await Review.find({
    booking: { $in: bookingIds },
  }).distinct("booking");

  return new Set(reviewedIds.map((id) => id.toString()));
};

export const attachHasReviewToBookings = async (bookings) => {
  const list = Array.isArray(bookings) ? bookings : [bookings];

  if (!list.length) {
    return Array.isArray(bookings) ? [] : null;
  }

  const reviewedSet = await getReviewedBookingIds(
    list.map((booking) => booking._id).filter(Boolean),
  );

  const enrich = (booking) => {
    const plain = booking.toObject ? booking.toObject() : { ...booking };
    plain.hasReview = reviewedSet.has(plain._id.toString());
    return plain;
  };

  if (Array.isArray(bookings)) {
    return list.map(enrich);
  }

  return enrich(list[0]);
};
