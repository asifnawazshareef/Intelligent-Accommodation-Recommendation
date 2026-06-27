import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarRange,
  Loader2,
  MapPin,
  MessageSquare,
  RefreshCw,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import DashboardLayout from "@/components/layout/DashboardLayout";
import OfflineRequestStatusBadge from "@/components/offline/OfflineRequestStatusBadge";
import { getGuestOfflineRequests } from "@/services/offlineRequestService";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/formatters";
import { cn } from "@/lib/utils";

const FILTERS = ["all", "pending", "responded", "closed"];

const RequestCardSkeleton = () => (
  <Card className="glass-card">
    <CardHeader>
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
    </CardHeader>
    <CardContent>
      <Skeleton className="h-20 w-full" />
    </CardContent>
  </Card>
);

const GuestOfflineRequestsPage = () => {
  const { t, i18n } = useTranslation();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await getGuestOfflineRequests();
      setRequests(response.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || t("offlinePage.guestLoadError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const filteredRequests = useMemo(() => {
    if (filter === "all") return requests;
    return requests.filter((request) => request.status === filter);
  }, [requests, filter]);

  const counts = useMemo(() => {
    const tally = { all: requests.length, pending: 0, responded: 0, closed: 0 };
    requests.forEach((request) => {
      if (tally[request.status] !== undefined) {
        tally[request.status] += 1;
      }
    });
    return tally;
  }, [requests]);

  const filterLabel = (value) => {
    if (value === "all") return t("offlinePage.filterAll");
    return t(`offline.${value}`, value);
  };

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {t("offlinePage.guestTitle")}
            </h1>
            <p className="mt-1 max-w-2xl text-muted-foreground">
              {t("offlinePage.guestHint")}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={fetchRequests}
            disabled={loading}
            className="w-full min-w-fit whitespace-normal sm:w-auto"
          >
            <RefreshCw className={cn("size-4", loading && "animate-spin")} />
            {t("offlinePage.refresh")}
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {FILTERS.map((value) => (
            <Button
              key={value}
              size="sm"
              variant={filter === value ? "default" : "outline"}
              onClick={() => setFilter(value)}
              className="whitespace-normal"
            >
              {filterLabel(value)}
              {!loading && (
                <span className="ms-1 rounded-full bg-background/20 px-1.5 text-xs">
                  {counts[value]}
                </span>
              )}
            </Button>
          ))}
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertTitle>{t("offlinePage.errorTitle")}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading && (
          <div className="grid gap-4 lg:grid-cols-2">
            {[1, 2].map((item) => (
              <RequestCardSkeleton key={item} />
            ))}
          </div>
        )}

        {!loading && requests.length === 0 && (
          <Card className="glass-card border-dashed">
            <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <MessageSquare className="size-10 text-muted-foreground/50" />
              <div className="max-w-md space-y-1">
                <h2 className="text-lg font-semibold">
                  {t("offlinePage.guestEmptyTitle")}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {t("offlinePage.guestEmptyHint")}
                </p>
              </div>
              <Button asChild>
                <Link to="/offline-booking">{t("offline.offlineBookingRequest")}</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {!loading && requests.length > 0 && filteredRequests.length === 0 && (
          <Card className="glass-card border-dashed">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              {t("offlinePage.noFilterResults", { status: filterLabel(filter) })}
            </CardContent>
          </Card>
        )}

        {!loading && filteredRequests.length > 0 && (
          <div className="grid gap-4 lg:grid-cols-2">
            {filteredRequests.map((request) => {
              const requestId = String(request._id);
              const hasResponse =
                request.responseMessage &&
                (request.status === "responded" || request.status === "closed");

              return (
                <Card key={requestId} className="glass-card flex flex-col">
                  <CardHeader className="space-y-2">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <CardTitle className="text-base">
                        {request.property?.title || t("offlinePage.generalRequest")}
                      </CardTitle>
                      <OfflineRequestStatusBadge status={request.status} />
                    </div>
                    {request.property?.location && (
                      <CardDescription className="flex items-center gap-1">
                        <MapPin className="size-3.5 shrink-0" />
                        {request.property.location.city},{" "}
                        {request.property.location.country}
                      </CardDescription>
                    )}
                  </CardHeader>

                  <CardContent className="flex-1 space-y-3 text-sm">
                    <p className="flex items-center gap-1.5">
                      <CalendarRange className="size-4 text-muted-foreground" />
                      <span dir="ltr">
                        {formatDate(request.startDate, i18n.language)} –{" "}
                        {formatDate(request.endDate, i18n.language)}
                      </span>
                    </p>

                    <p>
                      <span className="font-medium">{t("offline.roomType")}:</span>{" "}
                      {request.roomType}
                    </p>

                    <p className="text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {t("offlinePage.preferredLocation")}:
                      </span>{" "}
                      {request.location}
                    </p>

                    {request.status === "pending" && (
                      <Alert>
                        <AlertDescription>
                          {t("offlinePage.guestPendingHint")}
                        </AlertDescription>
                      </Alert>
                    )}

                    {hasResponse && (
                      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
                        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                          <MessageSquare className="size-3.5" />
                          {t("offlinePage.ownerResponseTitle")}
                        </p>
                        <p className="mt-2 leading-relaxed">{request.responseMessage}</p>
                      </div>
                    )}

                    {request.status === "closed" && !request.responseMessage && (
                      <p className="text-sm text-muted-foreground">
                        {t("offlinePage.guestClosedHint")}
                      </p>
                    )}

                    {request.property?._id && (
                      <Button variant="link" size="sm" className="h-auto p-0" asChild>
                        <Link to={`/properties/${request.property._id}`}>
                          {t("offlinePage.viewProperty")}
                        </Link>
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default GuestOfflineRequestsPage;
