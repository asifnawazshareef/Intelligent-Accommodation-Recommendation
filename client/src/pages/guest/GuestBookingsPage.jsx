import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarCheck,
  CreditCard,
  RefreshCw,
  Star,
  Ticket,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import DashboardLayout from "@/components/layout/DashboardLayout";
import GuestBookingCard from "@/components/bookings/GuestBookingCard";
import ActionLink from "@/components/ui/action-link";
import { getMyBookings } from "@/services/bookingService";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const FILTERS = ["all", "payment", "review", "reviewed"];

const BookingCardSkeleton = () => (
  <Card className="glass-card overflow-hidden">
    <Skeleton className="aspect-[16/10] rounded-none" />
    <div className="space-y-3 p-4">
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-16 w-full" />
    </div>
  </Card>
);

const SummaryChip = ({ icon: Icon, label, value, tone = "default" }) => (
  <div
    className={cn(
      "flex min-w-[140px] flex-1 items-center gap-3 rounded-xl border px-4 py-3",
      tone === "amber" && "border-amber-500/25 bg-amber-500/5",
      tone === "emerald" && "border-emerald-500/25 bg-emerald-500/5",
      tone === "primary" && "border-primary/25 bg-primary/5",
      tone === "violet" && "border-violet-500/25 bg-violet-500/5",
      tone === "default" && "border-border/60 bg-muted/20",
    )}
  >
    <div
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-lg",
        tone === "amber" && "bg-amber-500/15 text-amber-600 dark:text-amber-400",
        tone === "emerald" && "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
        tone === "primary" && "bg-primary/15 text-primary",
        tone === "violet" && "bg-violet-500/15 text-violet-600 dark:text-violet-400",
        tone === "default" && "bg-muted text-muted-foreground",
      )}
    >
      <Icon className="size-4" />
    </div>
    <div className="min-w-0">
      <p className="truncate text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold leading-tight" dir="ltr">
        {value}
      </p>
    </div>
  </div>
);

const FilterPill = ({ active, onClick, children, count }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
      active
        ? "border-primary bg-primary text-primary-foreground shadow-sm"
        : "border-border/60 bg-background/80 text-muted-foreground hover:border-primary/40 hover:text-foreground",
    )}
  >
    {children}
    {count > 0 && (
      <span
        className={cn(
          "inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
          active ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground",
        )}
      >
        {count}
      </span>
    )}
  </button>
);

const GuestBookingsPage = () => {
  const { t } = useTranslation();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");

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

  const stats = useMemo(() => {
    const active = bookings.filter((b) => b.status !== "cancelled");
    const pendingPayment = active.filter((b) => b.paymentStatus === "pending");
    const needsReview = active.filter(
      (b) =>
        b.status === "confirmed" &&
        b.paymentStatus === "confirmed" &&
        !b.hasReview,
    );
    const reviewed = active.filter((b) => b.hasReview);

    return {
      total: active.length,
      pendingPayment: pendingPayment.length,
      needsReview: needsReview.length,
      reviewed: reviewed.length,
    };
  }, [bookings]);

  const filterCounts = useMemo(
    () => ({
      all: stats.total,
      payment: stats.pendingPayment,
      review: stats.needsReview,
      reviewed: stats.reviewed,
    }),
    [stats],
  );

  const filteredBookings = useMemo(() => {
    const active = bookings.filter((b) => b.status !== "cancelled");

    const filtered = active.filter((booking) => {
      if (activeFilter === "payment") {
        return booking.paymentStatus === "pending";
      }
      if (activeFilter === "review") {
        return (
          booking.status === "confirmed" &&
          booking.paymentStatus === "confirmed" &&
          !booking.hasReview
        );
      }
      if (activeFilter === "reviewed") {
        return booking.hasReview;
      }
      return true;
    });

    const today = new Date().toISOString().slice(0, 10);

    return [...filtered].sort((a, b) => {
      const aUpcoming = a.endDate >= today;
      const bUpcoming = b.endDate >= today;

      if (aUpcoming !== bUpcoming) {
        return aUpcoming ? -1 : 1;
      }

      if (aUpcoming) {
        return a.startDate.localeCompare(b.startDate);
      }

      return b.endDate.localeCompare(a.endDate);
    });
  }, [bookings, activeFilter]);

  const filterLabels = {
    all: t("bookingPage.filterAll"),
    payment: t("bookingPage.filterPayment"),
    review: t("bookingPage.filterReview"),
    reviewed: t("bookingPage.filterReviewed"),
  };

  return (
    <DashboardLayout>
      <div className="dashboard-page">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {t("booking.myBookings")}
            </h1>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground sm:text-base">
              {t("bookingPage.historyHint")}
            </p>
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

        {!loading && bookings.length > 0 && (
          <div className="flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <SummaryChip
              icon={CalendarCheck}
              label={t("bookingPage.statsTotal")}
              value={stats.total}
              tone="primary"
            />
            <SummaryChip
              icon={CreditCard}
              label={t("bookingPage.statsPendingPayment")}
              value={stats.pendingPayment}
              tone={stats.pendingPayment > 0 ? "amber" : "default"}
            />
            <SummaryChip
              icon={Star}
              label={t("bookingPage.statsNeedsReview")}
              value={stats.needsReview}
              tone={stats.needsReview > 0 ? "violet" : "default"}
            />
            <SummaryChip
              icon={Star}
              label={t("bookingPage.statsReviewed")}
              value={stats.reviewed}
              tone="emerald"
            />
          </div>
        )}

        {!loading && bookings.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((filter) => (
              <FilterPill
                key={filter}
                active={activeFilter === filter}
                onClick={() => setActiveFilter(filter)}
                count={filterCounts[filter]}
              >
                {filterLabels[filter]}
              </FilterPill>
            ))}
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertTitle>{t("bookingPage.errorTitle")}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading && (
          <div className="grid items-start gap-4 sm:grid-cols-2 xl:grid-cols-3">
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

        {!loading && bookings.length > 0 && filteredBookings.length === 0 && (
          <Card className="glass-card border-dashed">
            <CardContent className="flex flex-col items-center justify-center gap-3 px-4 py-12 text-center">
              <p className="text-sm font-medium">{t("bookingPage.filterEmptyTitle")}</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                {t("bookingPage.filterEmptyHint")}
              </p>
              <Button variant="outline" onClick={() => setActiveFilter("all")}>
                {t("bookingPage.filterAll")}
              </Button>
            </CardContent>
          </Card>
        )}

        {!loading && filteredBookings.length > 0 && (
          <div className="grid items-start gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filteredBookings.map((booking) => (
              <GuestBookingCard key={booking._id} booking={booking} />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default GuestBookingsPage;
