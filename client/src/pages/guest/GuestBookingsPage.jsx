import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarCheck, CreditCard, Star, Ticket } from "lucide-react";
import { useTranslation } from "react-i18next";
import DashboardLayout from "@/components/layout/DashboardLayout";
import GuestBookingCard from "@/components/bookings/GuestBookingCard";
import ActionLink from "@/components/ui/action-link";
import EmptyState from "@/components/ui/EmptyState";
import FilterChipBar, { FilterChip } from "@/components/ui/FilterChipBar";
import PageHeader from "@/components/ui/PageHeader";
import RefreshButton from "@/components/ui/RefreshButton";
import StatSummaryBar, { StatChip } from "@/components/ui/StatSummaryBar";
import { getMyBookings } from "@/services/bookingService";
import { todayInputValue } from "@/lib/dateUtils";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

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
    return {
      total: active.length,
      pendingPayment: active.filter((b) => b.paymentStatus === "pending").length,
      needsReview: active.filter(
        (b) =>
          b.status === "confirmed" &&
          b.paymentStatus === "confirmed" &&
          !b.hasReview,
      ).length,
      reviewed: active.filter((b) => b.hasReview).length,
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
      if (activeFilter === "payment") return booking.paymentStatus === "pending";
      if (activeFilter === "review") {
        return (
          booking.status === "confirmed" &&
          booking.paymentStatus === "confirmed" &&
          !booking.hasReview
        );
      }
      if (activeFilter === "reviewed") return booking.hasReview;
      return true;
    });

    const today = todayInputValue();
    return [...filtered].sort((a, b) => {
      const aUpcoming = a.endDate >= today;
      const bUpcoming = b.endDate >= today;
      if (aUpcoming !== bUpcoming) return aUpcoming ? -1 : 1;
      if (aUpcoming) return a.startDate.localeCompare(b.startDate);
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
        <PageHeader
          title={t("booking.myBookings")}
          description={t("bookingPage.historyHint")}
          actions={
            <>
              <ActionLink to="/search" variant="outline" className="h-10 w-full sm:w-auto">
                {t("nav.search")}
              </ActionLink>
              <RefreshButton
                onClick={fetchBookings}
                loading={loading}
                className="w-full sm:w-auto"
              />
            </>
          }
        />

        {!loading && bookings.length > 0 && (
          <StatSummaryBar>
            <StatChip icon={CalendarCheck} label={t("bookingPage.statsTotal")} value={stats.total} tone="primary" />
            <StatChip icon={CreditCard} label={t("bookingPage.statsPendingPayment")} value={stats.pendingPayment} tone={stats.pendingPayment > 0 ? "amber" : "default"} />
            <StatChip icon={Star} label={t("bookingPage.statsNeedsReview")} value={stats.needsReview} tone={stats.needsReview > 0 ? "violet" : "default"} />
            <StatChip icon={Star} label={t("bookingPage.statsReviewed")} value={stats.reviewed} tone="emerald" />
          </StatSummaryBar>
        )}

        {!loading && bookings.length > 0 && (
          <FilterChipBar>
            {FILTERS.map((filter) => (
              <FilterChip
                key={filter}
                active={activeFilter === filter}
                onClick={() => setActiveFilter(filter)}
                count={filterCounts[filter]}
              >
                {filterLabels[filter]}
              </FilterChip>
            ))}
          </FilterChipBar>
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
          <EmptyState
            icon={Ticket}
            title={t("bookingPage.emptyTitle")}
            description={t("bookingPage.emptyHint")}
          >
            <ActionLink to="/search" className="h-10 w-full sm:w-auto">
              {t("nav.search")}
            </ActionLink>
          </EmptyState>
        )}

        {!loading && bookings.length > 0 && filteredBookings.length === 0 && (
          <EmptyState
            compact
            title={t("bookingPage.filterEmptyTitle")}
            description={t("bookingPage.filterEmptyHint")}
          >
            <Button variant="outline" onClick={() => setActiveFilter("all")}>
              {t("bookingPage.filterAll")}
            </Button>
          </EmptyState>
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
