import Stripe from "stripe";

let stripeClient = null;

export const getStripe = () => {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    throw new Error("Stripe test secret key is not configured");
  }

  if (!secretKey.startsWith("sk_test_")) {
    throw new Error("Only Stripe test mode keys (sk_test_) are allowed");
  }

  if (!stripeClient) {
    stripeClient = new Stripe(secretKey);
  }

  return stripeClient;
};

export const isStripeConfigured = () =>
  Boolean(process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_"));
