export const datesOverlap = (startA, endA, startB, endB) =>
  Boolean(startA && endA && startB && endB && startA <= endB && endA >= startB);

export const isActiveBooking = (booking) =>
  booking?.status !== "cancelled";

export const findOverlappingBooking = (bookings, startDate, endDate) => {
  if (!startDate || !endDate || !bookings?.length) {
    return null;
  }

  return (
    bookings.find(
      (booking) =>
        isActiveBooking(booking) &&
        datesOverlap(startDate, endDate, booking.startDate, booking.endDate),
    ) || null
  );
};
