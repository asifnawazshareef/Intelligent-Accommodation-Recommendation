import { useCallback, useEffect, useState } from "react";
import {
  CalendarRange,
  CreditCard,
  MapPin,
  MessageSquarePlus,
  RefreshCw,
  Ticket,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import DashboardLayout from "@/components/layout/DashboardLayout";
import BookingStatusBadge from "@/components/bookings/BookingStatusBadge";
import ActionLink from "@/components/ui/action-link";
import { formatDate, formatPrice } from "@/lib/formatters";
import { getMyBookings } from "@/services/bookingService";
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
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const BookingCardSkeleton = () => (
  <Card className="glass-card">
    <CardHeader>
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
    </CardHeader>
    <CardContent>
      <Skeleton className="h-4 w-full" />
    </CardContent>
  </Card>
);

const GuestBookingsPage = () => {
  const { t, i18n } = useTranslation();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await getMyBookings();
      setBookings(response.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || t("bookingPage.historyError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const pendingPaymentCount = bookings.filter(
    (b) => b.paymentStatus === "pending" && b.status !== "cancelled",
  ).length;

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-5xl space-y-5 px-1 sm:space-y-6 sm:px-0">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {t("booking.myBookings")}
            </h1>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground sm:text-base">
              {t("bookingPage.historyHint")}
            </p>
            {pendingPaymentCount > 0 && (
              <p className="mt-2 text-sm font-medium text-amber-700 dark:text-amber-400">
                {t("bookingPage.pendingPaymentCount", { count: pendingPaymentCount })}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <ActionLink to="/search" variant="outline" className="h-10 w-full sm:w-auto">
              {t("nav.search")}
            </ActionLink>
            <Button
              variant="outline"
              onClick={fetchBookings}
              disabled={loading}
              className="h-10 w-full gap-2 sm:w-auto"
            >
              <RefreshCw className={cn("size-4 shrink-0", loading && "animate-spin")} />
              {t("bookingPage.refresh")}
            </Button>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertTitle>{t("bookingPage.errorTitle")}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading && (
          <div className="grid items-start gap-4 md:grid-cols-2">
            {[1, 2, 3].map((item) => (
              <BookingCardSkeleton key={item} />
            ))}
          </div>
        )}

        {!loading && !error && bookings.length === 0 && (
          <Card className="glass-card border-dashed">
            <CardContent className="flex flex-col items-center justify-center gap-4 px-4 py-14 text-center sm:py-16">
              <Ticket className="size-10 text-muted-foreground/50" />
              <div className="max-w-md space-y-1.5">
                <h2 className="text-lg font-semibold">
                  {t("bookingPage.emptyTitle")}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {t("bookingPage.emptyHint")}
                </p>
              </div>
              <ActionLink to="/search" className="h-10 w-full sm:w-auto">
                {t("nav.search")}
              </ActionLink>
            </CardContent>
          </Card>
        )}

        {!loading && bookings.length > 0 && (
          <div className="grid items-start gap-4 md:grid-cols-2">
            {bookings.map((booking) => {
              const property = booking.property;
              const needsPayment =
                booking.paymentStatus === "pending" &&
                booking.status !== "cancelled";
              const canReview = booking.status === "confirmed";

              return (
                <Card key={booking._id} className="glass-card flex flex-col border-border/60">
                  <CardHeader className="space-y-2 pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <CardTitle className="line-clamp-2 min-w-0 flex-1 text-base leading-snug">
                        {property?.title || t("booking.booking")}
                      </CardTitle>
                      <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                        <BookingStatusBadge status={booking.status} />
                        <BookingStatusBadge
                          status={booking.paymentStatus}
                          type="payment"
                        />
                      </div>
                    </div>
                    {property?.location && (
                      <CardDescription className="flex items-start gap-1.5">
                        <MapPin className="mt-0.5 size-3.5 shrink-0" />
                        <span>
                          {property.location.city}, {property.location.country}
                        </span>
                      </CardDescription>
                    )}
                  </CardHeader>

                  <CardContent className="flex-1 space-y-3 text-sm">
                    <div className="flex items-start gap-2 rounded-lg border border-border/50 bg-muted/15 p-3">
                      <CalendarRange className="mt-0.5 size-4 shrink-0 text-primary" />
                      <span dir="ltr" className="font-medium">
                        {formatDate(booking.startDate, i18n.language)} –{" "}
                        {formatDate(booking.endDate, i18n.language)}
                      </span>
                    </div>
                    <p className="font-semibold text-primary" dir="ltr">
                      {formatPrice(
                        booking.totalAmount ?? property?.price,
                        t("common.currency"),
                      )}
                    </p>
                  </CardContent>

                  <CardFooter className="flex flex-col gap-2 border-t border-border/60 bg-muted/10 p-4">
                    <ActionLink
                      to={`/properties/${property?._id}`}
                      variant="outline"
                      className="h-10 w-full"
                    >
                      {t("common.viewDetails")}
                    </ActionLink>
                    {needsPayment && (
                      <ActionLink
                        to={`/bookings/payment/${booking._id}`}
                        className="h-10 w-full gap-2"
                      >
                        <CreditCard className="size-4 shrink-0" />
                        {t("bookingPage.completePayment")}
                      </ActionLink>
                    )}
                    {canReview && (
                      <ActionLink
                        to={`/properties/${property?._id}#reviews`}
                        variant={needsPayment ? "outline" : "default"}
                        className="h-10 w-full gap-2"
                      >
                        <MessageSquarePlus className="size-4 shrink-0" />
                        {t("review.leaveReview")}
                      </ActionLink>
                    )}
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default GuestBookingsPage;
