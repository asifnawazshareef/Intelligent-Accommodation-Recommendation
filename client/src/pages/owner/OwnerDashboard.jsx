import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  CalendarRange,
  ChevronRight,
  Loader2,
  MessageSquare,
  User,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
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
import { getOwnerOfflineRequests } from "@/services/offlineRequestService";
import { formatDate } from "@/lib/formatters";

const OwnerDashboard = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [offlineRequests, setOfflineRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(true);

  const fetchOfflineRequests = useCallback(async () => {
    setLoadingRequests(true);

    try {
      const response = await getOwnerOfflineRequests();
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

  const pendingCount = offlineRequests.filter(
    (request) => request.status === "pending",
  ).length;

  const recentRequests = offlineRequests.slice(0, 3);

  return (
    <DashboardLayout>
      <div className="dashboard-page">
        <DashboardShell role="owner" user={user} />

        <Card className="glass-card border-border/60">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <MessageSquare className="size-5" />
                {t("offlinePage.ownerTitle")}
              </CardTitle>
              <CardDescription>{t("offlinePage.dashboardHint")}</CardDescription>
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
              <p className="py-6 text-center text-sm text-muted-foreground">
                {t("offlinePage.emptyHint")}
              </p>
            ) : (
              <div className="space-y-3">
                {recentRequests.map((request) => (
                  <div
                    key={String(request._id)}
                    className="rounded-lg border border-border/60 bg-muted/20 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 space-y-1">
                        <p className="font-medium">
                          {request.property?.title ||
                            t("offlinePage.generalRequest")}
                        </p>
                        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <User className="size-3.5 shrink-0" />
                          {request.guestName}
                        </p>
                      </div>
                      <OfflineRequestStatusBadge status={request.status} />
                    </div>
                    <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                      <CalendarRange className="size-3.5 shrink-0" />
                      <span dir="ltr">
                        {formatDate(request.startDate, i18n.language)} –{" "}
                        {formatDate(request.endDate, i18n.language)}
                      </span>
                    </p>
                  </div>
                ))}

                <Link
                  to="/owner/offline-requests"
                  className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                >
                  {t("offlinePage.viewAllRequests", {
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

export default OwnerDashboard;
