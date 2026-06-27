import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  CalendarRange,
  ChevronRight,
  Loader2,
  MessageSquare,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import DashboardLayout from "@/components/layout/DashboardLayout";
import DashboardShell from "@/components/dashboard/DashboardShell";
import OfflineRequestStatusBadge from "@/components/offline/OfflineRequestStatusBadge";
import { getGuestOfflineRequests } from "@/services/offlineRequestService";
import { formatDate } from "@/lib/formatters";

const GuestDashboard = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [offlineRequests, setOfflineRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(true);

  const fetchOfflineRequests = useCallback(async () => {
    setLoadingRequests(true);

    try {
      const response = await getGuestOfflineRequests();
      setOfflineRequests(response.data.data || []);
    } catch {
      setOfflineRequests([]);
    } finally {
      setLoadingRequests(false);
    }
  }, []);

  useEffect(() => {
    fetchOfflineRequests();
  }, [fetchOfflineRequests]);

  const respondedCount = offlineRequests.filter(
    (request) =>
      request.status === "responded" &&
      request.responseMessage?.trim(),
  ).length;

  const pendingCount = offlineRequests.filter(
    (request) => request.status === "pending",
  ).length;

  const recentRequests = offlineRequests.slice(0, 3);

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl space-y-6">
        <DashboardShell role="guest" user={user}>
          <p>{t("dashboard.guestInfo1")}</p>
          <p className="pt-2">{t("dashboard.guestInfo2")}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link to="/search">
              <Button size="sm">{t("nav.search")}</Button>
            </Link>
            <Link to="/guest/bookings">
              <Button size="sm" variant="outline">
                {t("booking.myBookings")}
              </Button>
            </Link>
            <Link to="/guest/offline-requests">
              <Button size="sm" variant="outline" className="whitespace-normal">
                {t("offlinePage.guestTitle")}
                {respondedCount > 0 && (
                  <Badge className="ms-1 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                    {respondedCount}
                  </Badge>
                )}
              </Button>
            </Link>
          </div>
        </DashboardShell>

        <Card className="glass-card border-border/60">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <MessageSquare className="size-5" />
                {t("offlinePage.guestTitle")}
              </CardTitle>
              <CardDescription>{t("offlinePage.guestDashboardHint")}</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchOfflineRequests}
              disabled={loadingRequests}
              className="whitespace-normal"
            >
              {loadingRequests ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              {t("offlinePage.refresh")}
            </Button>
          </CardHeader>

          <CardContent>
            {loadingRequests ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                {t("offlinePage.loadingRequests")}
              </div>
            ) : recentRequests.length === 0 ? (
              <div className="space-y-3 py-4 text-center">
                <p className="text-sm text-muted-foreground">
                  {t("offlinePage.guestEmptyHint")}
                </p>
                <Button size="sm" asChild>
                  <Link to="/offline-booking">
                    {t("offline.offlineBookingRequest")}
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingCount > 0 && (
                  <p className="text-sm text-muted-foreground">
                    {t("offlinePage.guestPendingCount", { count: pendingCount })}
                  </p>
                )}

                {recentRequests.map((request) => (
                  <div
                    key={String(request._id)}
                    className="rounded-lg border border-border/60 bg-muted/20 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="font-medium">
                        {request.property?.title || t("offlinePage.generalRequest")}
                      </p>
                      <OfflineRequestStatusBadge status={request.status} />
                    </div>

                    <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                      <CalendarRange className="size-3.5 shrink-0" />
                      <span dir="ltr">
                        {formatDate(request.startDate, i18n.language)} –{" "}
                        {formatDate(request.endDate, i18n.language)}
                      </span>
                    </p>

                    {request.responseMessage &&
                      (request.status === "responded" ||
                        request.status === "closed") && (
                        <p className="mt-2 line-clamp-2 text-sm text-emerald-700 dark:text-emerald-400">
                          {t("offlinePage.ownerResponseTitle")}:{" "}
                          {request.responseMessage}
                        </p>
                      )}
                  </div>
                ))}

                <Link
                  to="/guest/offline-requests"
                  className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                >
                  {t("offlinePage.viewAllGuestRequests", {
                    count: offlineRequests.length,
                  })}
                  <ChevronRight className="size-4" />
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default GuestDashboard;
