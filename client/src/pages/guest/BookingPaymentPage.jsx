import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CalendarRange,
  CheckCircle2,
  Loader2,
  Lock,
  MapPin,
  MessageSquarePlus,
  Users,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PageLoader from "@/components/layout/PageLoader";
import BookingStepIndicator from "@/components/bookings/BookingStepIndicator";
import BookingStatusBadge from "@/components/bookings/BookingStatusBadge";
import PropertyCoverImage from "@/components/properties/PropertyCoverImage";
import ReviewSubmittedBanner from "@/components/reviews/ReviewSubmittedBanner";
import { formatDate, formatPrice } from "@/lib/formatters";
import notify from "@/lib/notify";
import { getBookingById } from "@/services/bookingService";
import { createStripeCheckoutSession } from "@/services/paymentService";
import { Button } from "@/components/ui/button";
import ActionLink from "@/components/ui/action-link";
import PageHeader from "@/components/ui/PageHeader";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const BookingPaymentPage = () => {
  const { t, i18n } = useTranslation();
  const { bookingId } = useParams();

  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [redirectingStripe, setRedirectingStripe] = useState(false);
  const [error, setError] = useState("");

  const fetchBooking = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await getBookingById(bookingId);
      setBooking(response.data.data);
    } catch (err) {
      setBooking(null);
      const message =
        err.response?.data?.message || t("bookingPage.loadBookingError");
      setError(message);
      notify.error(message);
    } finally {
      setLoading(false);
    }
  }, [bookingId, t]);

  useEffect(() => {
    fetchBooking();
  }, [fetchBooking]);

  const handleStripePayment = async () => {
    setRedirectingStripe(true);
    setError("");

    try {
      const response = await createStripeCheckoutSession(bookingId);
      const checkoutUrl = response.data.data?.url;

      if (!checkoutUrl) {
        throw new Error(t("bookingPage.stripeSessionError"));
      }

      window.location.href = checkoutUrl;
    } catch (err) {
      const message =
        err.response?.data?.message || t("bookingPage.stripeCheckoutError");
      setError(message);
      notify.error(message);
      setRedirectingStripe(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <PageLoader message={t("bookingPage.loadingBooking")} />
      </DashboardLayout>
    );
  }

  if (!booking) {
    return (
      <DashboardLayout>
        <div className="dashboard-page">
          <Alert variant="destructive">
            <AlertTitle>{t("bookingPage.errorTitle")}</AlertTitle>
            <AlertDescription>{error || t("bookingPage.bookingNotFound")}</AlertDescription>
          </Alert>
          <ActionLink to="/guest/bookings" variant="outline">
            <ArrowLeft className="size-4 shrink-0" />
            {t("booking.myBookings")}
          </ActionLink>
        </div>
      </DashboardLayout>
    );
  }

  const property = booking.property;
  const isPaid = booking.paymentStatus === "confirmed";
  const isCancelled = booking.status === "cancelled";
  const isBusy = redirectingStripe;
  const currentStep = isPaid ? 3 : 2;
  const coverUrl = property?.images?.[0]?.url;
  const displayAmount = booking.totalAmount ?? property?.price ?? 0;

  return (
    <DashboardLayout>
      <div className="dashboard-page">
        <div className="space-y-4">
          <Link
            to="/guest/bookings"
            className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4 shrink-0" />
            {t("booking.myBookings")}
          </Link>

          <PageHeader
            title={
              isPaid ? t("bookingPage.paymentCompleteTitle") : t("booking.payment")
            }
            description={
              isPaid
                ? t("bookingPage.paymentCompleteHint")
                : t("bookingPage.paymentHint")
            }
            meta={<BookingStepIndicator currentStep={currentStep} t={t} />}
          />
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertTitle>{t("bookingPage.errorTitle")}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid items-start gap-6 lg:grid-cols-5 lg:gap-8">
          <Card className="glass-card border-border/60 lg:col-span-3">
            <CardHeader className="space-y-3 pb-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <CardTitle className="text-lg">
                  {isPaid
                    ? t("bookingPage.confirmedBookingTitle")
                    : t("bookingPage.reviewAndPayTitle")}
                </CardTitle>
                <div className="flex flex-wrap gap-2">
                  <BookingStatusBadge status={booking.status} />
                  <BookingStatusBadge
                    status={booking.paymentStatus}
                    type="payment"
                  />
                </div>
              </div>
              <CardDescription>{t("bookingPage.reviewAndPayHint")}</CardDescription>
            </CardHeader>

            <CardContent className="space-y-4 pt-0">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-border/50 bg-muted/20 p-3 sm:p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {t("booking.startDate")}
                  </p>
                  <p className="mt-1 font-medium" dir="ltr">
                    {formatDate(booking.startDate, i18n.language)}
                  </p>
                </div>
                <div className="rounded-lg border border-border/50 bg-muted/20 p-3 sm:p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {t("booking.endDate")}
                  </p>
                  <p className="mt-1 font-medium" dir="ltr">
                    {formatDate(booking.endDate, i18n.language)}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-2">
                  <Users className="size-4 shrink-0 text-primary" />
                  {t("bookingPage.guestCount", { count: booking.guests })}
                </span>
                <span className="inline-flex items-center gap-2">
                  <CalendarRange className="size-4 shrink-0 text-primary" />
                  {property?.location?.city}, {property?.location?.country}
                </span>
              </div>

              <div className="rounded-lg border border-primary/25 bg-primary/5 p-4 lg:hidden">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("bookingPage.amountDue")}
                </p>
                <p className="mt-1 text-2xl font-bold text-primary" dir="ltr">
                  {formatPrice(displayAmount, t("common.currency"))}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  {t("bookingPage.secureCheckoutHint")}
                </p>
              </div>
            </CardContent>

            <CardFooter className="flex flex-col gap-3 border-t border-border/60 bg-muted/10 px-6 py-5">
              {!isPaid && !isCancelled && (
                <>
                  <Button
                    size="lg"
                    disabled={isBusy}
                    onClick={handleStripePayment}
                    className="h-12 w-full gap-2.5 rounded-lg bg-[#635BFF] text-base font-semibold text-white shadow-md transition-colors hover:bg-[#5851E3] disabled:opacity-70"
                  >
                    {redirectingStripe ? (
                      <>
                        <Loader2 className="size-5 shrink-0 animate-spin" />
                        <span>{t("bookingPage.processingPayment")}</span>
                      </>
                    ) : (
                      <>
                        <Lock className="size-4 shrink-0 opacity-90" />
                        <span>{t("bookingPage.payNow")}</span>
                        <span
                          className="rounded-md bg-white/15 px-2 py-0.5 text-sm font-bold"
                          dir="ltr"
                        >
                          {formatPrice(displayAmount, t("common.currency"))}
                        </span>
                      </>
                    )}
                  </Button>

                  <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
                    <Lock className="size-3 shrink-0" />
                    {t("bookingPage.securePaymentFooter")}
                  </p>
                </>
              )}

              {isPaid && !booking.hasReview && (
                <div className="flex w-full flex-col gap-2 sm:flex-row">
                  <ActionLink
                    to={`/properties/${property?._id}#reviews`}
                    className="h-11 w-full flex-1"
                  >
                    <MessageSquarePlus className="size-4 shrink-0" />
                    {t("review.leaveReview")}
                  </ActionLink>
                  <ActionLink
                    to="/guest/bookings"
                    variant="outline"
                    className="h-11 w-full sm:w-auto"
                  >
                    {t("bookingPage.viewMyBookings")}
                  </ActionLink>
                </div>
              )}

              {isPaid && booking.hasReview && (
                <div className="flex w-full flex-col gap-3">
                  <ReviewSubmittedBanner propertyId={property?._id} />
                  <ActionLink
                    to="/guest/bookings"
                    variant="outline"
                    className="h-11 w-full sm:w-auto"
                  >
                    {t("bookingPage.viewMyBookings")}
                  </ActionLink>
                </div>
              )}
            </CardFooter>
          </Card>

          <div className="space-y-4 lg:col-span-2">
            <Card className="glass-card overflow-hidden border-border/60 lg:sticky lg:top-24">
              <PropertyCoverImage
                src={coverUrl}
                alt={property?.title}
                className="aspect-[16/10] rounded-none border-0"
              />

              <CardHeader className="space-y-2 pb-3">
                <CardTitle className="line-clamp-2 text-lg leading-snug">
                  {property?.title || t("booking.booking")}
                </CardTitle>
                {property?.location && (
                  <CardDescription className="flex items-start gap-1.5">
                    <MapPin className="mt-0.5 size-3.5 shrink-0" />
                    <span>
                      {property.location.city}, {property.location.country}
                    </span>
                  </CardDescription>
                )}
              </CardHeader>

              <CardContent className="space-y-4 pt-0">
                <div className="hidden rounded-lg border border-primary/25 bg-primary/5 p-4 lg:block">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {t("bookingPage.amountDue")}
                  </p>
                  <p className="mt-1 text-2xl font-bold text-primary" dir="ltr">
                    {formatPrice(displayAmount, t("common.currency"))}
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    {t("bookingPage.secureCheckoutHint")}
                  </p>
                </div>

                {isPaid && !booking.hasReview && (
                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
                    <p className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 className="size-4 shrink-0" />
                      {t("bookingPage.bookingConfirmedShort")}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {t("bookingPage.reviewPrompt")}
                    </p>
                  </div>
                )}

                {isPaid && booking.hasReview && (
                  <ReviewSubmittedBanner propertyId={property?._id} />
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default BookingPaymentPage;
