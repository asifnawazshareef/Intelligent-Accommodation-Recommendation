import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  MessageSquarePlus,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PageLoader from "@/components/layout/PageLoader";
import BookingStepIndicator from "@/components/bookings/BookingStepIndicator";
import BookingStatusBadge from "@/components/bookings/BookingStatusBadge";
import ActionLink from "@/components/ui/action-link";
import { formatDate, formatPrice } from "@/lib/formatters";
import notify from "@/lib/notify";
import { verifyStripeSession } from "@/services/paymentService";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const BookingPaymentSuccessPage = () => {
  const { t, i18n } = useTranslation();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");

  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const verifyPayment = useCallback(async () => {
    if (!sessionId) {
      setError(t("bookingPage.stripeMissingSession"));
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await verifyStripeSession(sessionId);
      setBooking(response.data.data);
      notify.success(t("bookingPage.stripePaymentSuccess"));
    } catch (err) {
      const message =
        err.response?.data?.message || t("bookingPage.stripeVerifyError");
      setError(message);
      notify.error(message);
    } finally {
      setLoading(false);
    }
  }, [sessionId, t]);

  useEffect(() => {
    verifyPayment();
  }, [verifyPayment]);

  if (loading) {
    return (
      <DashboardLayout>
        <PageLoader message={t("bookingPage.stripeVerifyingPayment")} />
      </DashboardLayout>
    );
  }

  if (error || !booking) {
    return (
      <DashboardLayout>
        <div className="mx-auto max-w-lg space-y-4 px-1 py-4 sm:px-0 sm:py-8">
          <Alert variant="destructive">
            <AlertTitle>{t("bookingPage.errorTitle")}</AlertTitle>
            <AlertDescription>
              {error || t("bookingPage.stripeVerifyError")}
            </AlertDescription>
          </Alert>
          <ActionLink to="/guest/bookings" variant="outline">
            <ArrowLeft className="size-4 shrink-0" />
            {t("bookingPage.viewMyBookings")}
          </ActionLink>
        </div>
      </DashboardLayout>
    );
  }

  const property = booking.property;
  const displayAmount =
    booking.totalAmount ?? property?.price ?? 0;

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-2xl space-y-6 px-1 sm:px-0">
        <BookingStepIndicator currentStep={3} t={t} />

        <Card className="glass-card border-emerald-500/30">
          <CardHeader className="space-y-3 text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
              <CheckCircle2 className="size-8" />
            </div>
            <CardTitle className="text-2xl">
              {t("bookingPage.stripeSuccessTitle")}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {t("bookingPage.stripeSuccessHint")}
            </p>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="flex flex-wrap justify-center gap-2">
              <BookingStatusBadge status={booking.status} />
              <BookingStatusBadge status={booking.paymentStatus} type="payment" />
            </div>

            <div className="rounded-lg border border-border/60 bg-muted/20 p-4 text-sm">
              <p className="font-medium">{property?.title}</p>
              <p className="mt-2 text-muted-foreground" dir="ltr">
                {formatDate(booking.startDate, i18n.language)} –{" "}
                {formatDate(booking.endDate, i18n.language)}
              </p>
              <p className="mt-2 font-semibold text-primary" dir="ltr">
                {formatPrice(displayAmount, t("common.currency"))}
              </p>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-2 sm:flex-row">
            <ActionLink to="/guest/bookings" className="h-11 w-full flex-1">
              {t("bookingPage.viewMyBookings")}
            </ActionLink>
            {property?._id && (
              <ActionLink
                to={`/properties/${property._id}#reviews`}
                variant="outline"
                className="h-11 w-full flex-1"
              >
                <MessageSquarePlus className="size-4 shrink-0" />
                {t("review.leaveReview")}
              </ActionLink>
            )}
          </CardFooter>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          <Link to="/guest/bookings" className="underline-offset-4 hover:underline">
            {t("booking.myBookings")}
          </Link>
        </p>
      </div>
    </DashboardLayout>
  );
};

export default BookingPaymentSuccessPage;
