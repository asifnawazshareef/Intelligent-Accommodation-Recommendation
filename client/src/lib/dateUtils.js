/** Application timezone — listings and bookings are in Pakistan. */
export const APP_TIMEZONE = "Asia/Karachi";

/**
 * YYYY-MM-DD for <input type="date"> in the app timezone (not UTC).
 * UTC-based dates show "yesterday" in Pakistan after midnight local time.
 */
export const todayInputValue = (timeZone = APP_TIMEZONE) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
