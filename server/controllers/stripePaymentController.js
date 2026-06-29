import Booking from "../models/Booking.js";
import { getStripe, isStripeConfigured } from "../config/stripe.js";
import { toStripeUsdCents } from "../utils/bookingAmount.js";
import { attachHasReviewToBookings } from "../utils/bookingReviewStatus.js";

const populateBookingQuery = (query) =>
  query
    .populate("guest", "name email")
    .populate({
      path: "property",
      select: "title price location status owner images",
      populate: { path: "owner", select: "name email" },
    })
    .sort({ createdAt: -1 });

export const markBookingStripePaid = async (booking, session) => {
  if (!booking) {
    return null;
  }

  if (booking.paymentStatus === "confirmed") {
    return await populateBookingQuery(Booking.findById(booking._id));
  }

  booking.paymentStatus = "confirmed";
  booking.status = "confirmed";
  booking.paymentMethod = "stripe_test";
  booking.stripeSessionId = session.id || booking.stripeSessionId;
  booking.stripePaymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id || booking.stripePaymentIntentId;
  booking.paymentConfirmedAt = new Date();

  await booking.save();

  return await populateBookingQuery(Booking.findById(booking._id));
};

export const createCheckoutSession = async (req, res, next) => {
  try {
    if (!isStripeConfigured()) {
      res.status(503);
      throw new Error(
        "Stripe test mode is not configured. Add STRIPE_SECRET_KEY (sk_test_) to server .env",
      );
    }

    const { bookingId } = req.body;

    if (!bookingId) {
      res.status(400);
      throw new Error("bookingId is required");
    }

    const booking = await Booking.findById(bookingId).populate(
      "property",
      "title price status",
    );

    if (!booking) {
      res.status(404);
      throw new Error("Booking not found");
    }

    if (booking.guest.toString() !== req.user._id.toString()) {
      res.status(403);
      throw new Error("Not authorized to pay for this booking");
    }

    if (booking.status === "cancelled") {
      res.status(400);
      throw new Error("Cancelled bookings cannot be paid");
    }

    if (booking.paymentStatus === "confirmed") {
      res.status(400);
      throw new Error("Payment is already confirmed");
    }

    const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
    const stripe = getStripe();
    const propertyTitle = booking.property?.title || "IARS Property Booking";
    const amountCents = toStripeUsdCents(booking.totalAmount);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: amountCents,
            product_data: {
              name: propertyTitle,
              description: `Booking ${booking.startDate} to ${booking.endDate} (${booking.guests} guest(s))`,
            },
          },
        },
      ],
      metadata: {
        bookingId: booking._id.toString(),
        guestId: req.user._id.toString(),
        propertyId: booking.property._id.toString(),
      },
      success_url: `${clientUrl}/bookings/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${clientUrl}/bookings/payment/${booking._id}`,
    });

    booking.stripeSessionId = session.id;
    await booking.save();

    res.json({
      success: true,
      data: {
        sessionId: session.id,
        url: session.url,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const verifyCheckoutSession = async (req, res, next) => {
  try {
    const { session_id: sessionId } = req.query;

    if (!sessionId) {
      res.status(400);
      throw new Error("session_id is required");
    }

    if (!isStripeConfigured()) {
      res.status(503);
      throw new Error("Stripe test mode is not configured");
    }

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.metadata?.guestId !== req.user._id.toString()) {
      res.status(403);
      throw new Error("Not authorized to verify this payment session");
    }

    const booking = await Booking.findById(session.metadata?.bookingId);

    if (!booking) {
      res.status(404);
      throw new Error("Booking not found for this payment session");
    }

    if (session.payment_status === "paid") {
      const populatedBooking = await markBookingStripePaid(booking, session);
      const data = await attachHasReviewToBookings(populatedBooking);

      return res.json({
        success: true,
        message: "Payment verified and booking confirmed",
        data,
      });
    }

    if (session.payment_status === "unpaid") {
      res.status(400);
      throw new Error("Payment is not completed yet");
    }

    booking.paymentStatus = "failed";
    await booking.save();

    res.status(400);
    throw new Error("Payment failed or was not completed");
  } catch (error) {
    next(error);
  }
};

export const handleStripeWebhook = async (req, res) => {
  if (!isStripeConfigured()) {
    return res.status(503).send("Stripe is not configured");
  }

  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  let event = req.body;

  if (webhookSecret) {
    const signature = req.headers["stripe-signature"];

    try {
      event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
    } catch (error) {
      return res.status(400).send(`Webhook Error: ${error.message}`);
    }
  } else if (Buffer.isBuffer(req.body)) {
    try {
      event = JSON.parse(req.body.toString("utf8"));
    } catch {
      return res.status(400).send("Invalid webhook payload");
    }
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    if (session.payment_status === "paid" && session.metadata?.bookingId) {
      const booking = await Booking.findById(session.metadata.bookingId);

      if (booking) {
        await markBookingStripePaid(booking, session);
      }
    }
  }

  res.json({ received: true });
};
