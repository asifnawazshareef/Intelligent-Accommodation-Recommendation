export const countBookingNights = (startDate, endDate) => {
  if (!startDate || !endDate) {
    return 0;
  }

  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const nights = Math.round((end - start) / (1000 * 60 * 60 * 24));

  return nights > 0 ? nights : 0;
};

export const calculateBookingTotal = (propertyPrice, startDate, endDate) => {
  const nights = countBookingNights(startDate, endDate);

  if (!nights || propertyPrice == null) {
    return 0;
  }

  return Number(propertyPrice) * nights;
};

// FYP demo: convert PKR listing total to USD cents for Stripe test checkout.
export const PKR_TO_USD_DEMO_RATE = 280;

export const toStripeUsdCents = (totalAmountPkr) => {
  const usdAmount = Number(totalAmountPkr) / PKR_TO_USD_DEMO_RATE;
  const cents = Math.round(usdAmount * 100);

  return Math.max(50, cents);
};
