import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
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

const formatDate = (value) => {
  if (!value) return "—";
  return new Date(value).toLocaleDateString();
};

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
  const { t } = useTranslation();
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

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {t("booking.myBookings")}
            </h1>
            <p className="mt-1 text-muted-foreground">
              {t("bookingPage.historyHint")}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={fetchBookings}
            disabled={loading}
            className="w-full min-w-fit whitespace-normal sm:w-auto"
          >
            <RefreshCw className={cn("size-4", loading && "animate-spin")} />
            {t("bookingPage.refresh")}
          </Button>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertTitle>{t("bookingPage.errorTitle")}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading && (
          <div className="grid gap-4 md:grid-cols-2">
            {[1, 2, 3].map((item) => (
              <BookingCardSkeleton key={item} />
            ))}
          </div>
        )}

        {!loading && !error && bookings.length === 0 && (
          <Card className="glass-card border-dashed">
            <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <Ticket className="size-10 text-muted-foreground/50" />
              <div className="max-w-md space-y-1">
                <h2 className="text-lg font-semibold">
                  {t("bookingPage.emptyTitle")}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {t("bookingPage.emptyHint")}
                </p>
              </div>
              <Link to="/search">
                <Button>{t("nav.search")}</Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {!loading && bookings.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2">
            {bookings.map((booking) => {
              const property = booking.property;
              const needsPayment =
                booking.paymentStatus === "pending" &&
                booking.status !== "cancelled";
              const canReview = booking.status === "confirmed";

              return (
                <Card key={booking._id} className="glass-card flex flex-col">
                  <CardHeader className="space-y-2">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <CardTitle className="line-clamp-2 text-base">
                        {property?.title || t("booking.booking")}
                      </CardTitle>
                      <div className="flex flex-wrap gap-1.5">
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

                  <CardContent className="flex-1 space-y-3 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <CalendarRange className="size-4 shrink-0" />
                      <span dir="ltr">
                        {formatDate(booking.startDate)} –{" "}
                        {formatDate(booking.endDate)}
                      </span>
                    </div>
                    <p className="font-semibold text-primary" dir="ltr">
                      {property?.price?.toLocaleString()} PKR
                    </p>
                  </CardContent>

                  <CardFooter className="flex flex-col gap-2 border-t border-border/60 sm:flex-row">
                    <Link
                      to={`/properties/${property?._id}`}
                      className="w-full sm:flex-1"
                    >
                      <Button variant="outline" className="w-full whitespace-normal">
                        {t("common.viewDetails")}
                      </Button>
                    </Link>
                    {needsPayment && (
                      <Link
                        to={`/bookings/payment/${booking._id}`}
                        className="w-full sm:flex-1"
                      >
                        <Button className="w-full whitespace-normal">
                          <CreditCard className="size-4" />
                          {t("booking.confirmPayment")}
                        </Button>
                      </Link>
                    )}
                    {canReview && (
                      <Link
                        to={`/properties/${property?._id}#reviews`}
                        className="w-full sm:flex-1"
                      >
                        <Button
                          variant={needsPayment ? "outline" : "default"}
                          className="w-full whitespace-normal"
                        >
                          <MessageSquarePlus className="size-4" />
                          {t("review.leaveReview")}
                        </Button>
                      </Link>
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
