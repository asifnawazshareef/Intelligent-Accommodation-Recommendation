export const formatDate = (value, locale) => {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(locale);
};

export const formatPrice = (amount, currencyLabel = "PKR") => {
  if (amount === undefined || amount === null || Number.isNaN(Number(amount))) {
    return "—";
  }
  return `${Number(amount).toLocaleString()} ${currencyLabel}`;
};

export const formatBookingLabel = (booking, locale, translate) => {
  if (!booking) return "";

  return translate("review.bookingOption", {
    start: formatDate(booking.startDate, locale),
    end: formatDate(booking.endDate, locale),
    count: booking.guests ?? 1,
  });
};

export const formatPropertyOption = (property) => {
  if (!property?.title) return "";

  const city = property.location?.city;
  return city ? `${property.title} — ${city}` : property.title;
};
