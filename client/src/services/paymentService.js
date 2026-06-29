import api from "./api.js";

export const createStripeCheckoutSession = (bookingId) =>
  api.post("/payments/stripe/create-checkout-session", { bookingId });

export const verifyStripeSession = (sessionId) =>
  api.get("/payments/stripe/verify-session", {
    params: { session_id: sessionId },
  });
