import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CalendarRange,
  CheckCircle2,
  CreditCard,
  Loader2,
  MapPin,
  Users,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PageLoader from "@/components/layout/PageLoader";
import BookingStatusBadge from "@/components/bookings/BookingStatusBadge";
import { confirmPayment, getBookingById } from "@/services/bookingService";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const formatDate = (value) => {
  if (!value) return "—";
  return new Date(value).toLocaleDateString();
};

const BookingPaymentPage = () => {
  const { t } = useTranslation();
  const { bookingId } = useParams();
  const navigate = useNavigate();

  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fetchBooking = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await getBookingById(bookingId);
      setBooking(response.data.data);
    } catch (err) {
      setBooking(null);
      setError(err.response?.data?.message || t("bookingPage.loadBookingError"));
    } finally {
      setLoading(false);
    }
  }, [bookingId, t]);

  useEffect(() => {
    fetchBooking();
  }, [fetchBooking]);

  const handleConfirmPayment = async () => {
    setConfirming(true);
    setError("");
    setSuccess("");

    try {
      const response = await confirmPayment(bookingId);
      setBooking(response.data.data);
      setSuccess(t("bookingPage.paymentSuccess"));
    } catch (err) {
      setError(err.response?.data?.message || t("bookingPage.paymentError"));
    } finally {
      setConfirming(false);
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
        <div className="mx-auto max-w-lg space-y-4 px-4 py-8">
          <Alert variant="destructive">
            <AlertTitle>{t("bookingPage.errorTitle")}</AlertTitle>
            <AlertDescription>{error || t("bookingPage.bookingNotFound")}</AlertDescription>
          </Alert>
          <Link to="/guest/bookings">
            <Button variant="outline">
              <ArrowLeft className="size-4" />
              {t("booking.myBookings")}
            </Button>
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  const property = booking.property;
  const isPaid = booking.paymentStatus === "confirmed";
  const isCancelled = booking.status === "cancelled";

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-2xl space-y-6">
        <Link to="/guest/bookings">
          <Button variant="ghost" size="sm" className="whitespace-normal">
            <ArrowLeft className="size-4" />
            {t("booking.myBookings")}
          </Button>
        </Link>

        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {t("booking.payment")}
          </h1>
          <p className="mt-1 text-muted-foreground">{t("bookingPage.paymentHint")}</p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertTitle>{t("bookingPage.errorTitle")}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert>
            <CheckCircle2 className="size-4 text-emerald-600" />
            <AlertTitle>{t("bookingPage.successTitle")}</AlertTitle>
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        <Card className="glass-card border-border/60">
          <CardHeader className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <CardTitle>{property?.title || t("booking.booking")}</CardTitle>
              <div className="flex flex-wrap gap-2">
                <BookingStatusBadge status={booking.status} />
                <BookingStatusBadge
                  status={booking.paymentStatus}
                  type="payment"
                />
              </div>
            </div>
            {property?.location && (
              <CardDescription className="flex items-center gap-1">
                <MapPin className="size-3.5 shrink-0" />
                {property.location.city}, {property.location.country}
              </CardDescription>
            )}
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">
                  {t("booking.startDate")}
                </p>
                <p className="font-medium" dir="ltr">
                  {formatDate(booking.startDate)}
                </p>
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">
                  {t("booking.endDate")}
                </p>
                <p className="font-medium" dir="ltr">
                  {formatDate(booking.endDate)}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-sm">
              <span className="flex items-center gap-1.5">
                <Users className="size-4 text-muted-foreground" />
                {t("bookingPage.guestCount", { count: booking.guests })}
              </span>
              <span className="flex items-center gap-1.5">
                <CalendarRange className="size-4 text-muted-foreground" />
                {t("booking.bookingStatus")}: {booking.status}
              </span>
            </div>

            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
              <p className="text-sm text-muted-foreground">
                {t("bookingPage.amountDue")}
              </p>
              <p className="text-2xl font-bold text-primary" dir="ltr">
                {property?.price?.toLocaleString()} PKR
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("bookingPage.mockPaymentNote")}
              </p>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-2 border-t border-border/60 sm:flex-row">
            {!isPaid && !isCancelled && (
              <Button
                size="lg"
                disabled={confirming}
                onClick={handleConfirmPayment}
                className="w-full whitespace-normal sm:flex-1"
              >
                {confirming ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    {t("bookingPage.confirmingPayment")}
                  </>
                ) : (
                  <>
                    <CreditCard className="size-4" />
                    {t("booking.confirmPayment")}
                  </>
                )}
              </Button>
            )}

            {isPaid && (
              <Button
                size="lg"
                className="w-full whitespace-normal sm:flex-1"
                onClick={() => navigate("/guest/bookings")}
              >
                <CheckCircle2 className="size-4" />
                {t("bookingPage.viewMyBookings")}
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default BookingPaymentPage;
