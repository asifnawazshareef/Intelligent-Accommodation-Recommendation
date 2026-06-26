import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarRange,
  Loader2,
  MapPin,
  MessageSquare,
  Phone,
  RefreshCw,
  User,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import DashboardLayout from "@/components/layout/DashboardLayout";
import OfflineRequestStatusBadge from "@/components/offline/OfflineRequestStatusBadge";
import {
  getOwnerOfflineRequests,
  respondToOfflineRequest,
} from "@/services/offlineRequestService";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

const FILTERS = ["all", "pending", "responded", "closed"];

const formatDate = (value) => {
  if (!value) return "—";
  return new Date(value).toLocaleDateString();
};

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

const OwnerOfflineRequestsPage = () => {
  const { t } = useTranslation();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [drafts, setDrafts] = useState({});
  const [savingId, setSavingId] = useState("");
  const [successId, setSuccessId] = useState("");

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await getOwnerOfflineRequests();
      const data = response.data.data || [];
      setRequests(data);

      const nextDrafts = {};
      data.forEach((request) => {
        nextDrafts[request._id] = {
          responseMessage: request.responseMessage || "",
        };
      });
      setDrafts(nextDrafts);
    } catch (err) {
      setError(err.response?.data?.message || t("offlinePage.ownerLoadError"));
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

  const handleRespond = async (requestId, status = "responded") => {
    const draft = drafts[requestId];
    if (!draft?.responseMessage?.trim()) {
      setError(t("offlinePage.responseRequired"));
      return;
    }

    setSavingId(requestId);
    setError("");
    setSuccessId("");

    try {
      const response = await respondToOfflineRequest(requestId, {
        responseMessage: draft.responseMessage.trim(),
        status,
      });

      const updated = response.data.data;
      setRequests((prev) =>
        prev.map((item) => (item._id === requestId ? updated : item)),
      );
      setSuccessId(requestId);
    } catch (err) {
      setError(err.response?.data?.message || t("offlinePage.respondError"));
    } finally {
      setSavingId("");
    }
  };

  const filterLabel = (value) => {
    if (value === "all") return t("offlinePage.filterAll");
    return t(`offline.${value}`, value);
  };

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {t("offlinePage.ownerTitle")}
            </h1>
            <p className="mt-1 max-w-2xl text-muted-foreground">
              {t("offlinePage.ownerHint")}
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
              {!loading && value !== "all" && counts[value] > 0 && (
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
            <CardContent className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <MessageSquare className="size-10 text-muted-foreground/50" />
              <h2 className="text-lg font-semibold">{t("offlinePage.emptyTitle")}</h2>
              <p className="max-w-md text-sm text-muted-foreground">
                {t("offlinePage.emptyHint")}
              </p>
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
              const isSaving = savingId === request._id;
              const draft = drafts[request._id] || { responseMessage: "" };

              return (
                <Card key={request._id} className="glass-card flex flex-col">
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
                    <div className="grid gap-2 sm:grid-cols-2">
                      <p className="flex items-center gap-1.5">
                        <User className="size-4 text-muted-foreground" />
                        {request.guestName}
                      </p>
                      <p className="flex items-center gap-1.5" dir="ltr">
                        <Phone className="size-4 text-muted-foreground" />
                        {request.phone}
                      </p>
                    </div>

                    <p className="flex items-start gap-1.5 text-muted-foreground">
                      <MapPin className="mt-0.5 size-4 shrink-0" />
                      {request.location}
                    </p>

                    <p className="flex items-center gap-1.5">
                      <CalendarRange className="size-4 text-muted-foreground" />
                      <span dir="ltr">
                        {formatDate(request.startDate)} – {formatDate(request.endDate)}
                      </span>
                    </p>

                    <p>
                      <span className="font-medium">{t("offline.roomType")}:</span>{" "}
                      {request.roomType}
                    </p>

                    {request.responseMessage && request.status !== "pending" && (
                      <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {t("offline.responseMessage")}
                        </p>
                        <p className="mt-1">{request.responseMessage}</p>
                      </div>
                    )}

                    {successId === request._id && (
                      <Alert>
                        <AlertDescription>{t("offlinePage.respondSuccess")}</AlertDescription>
                      </Alert>
                    )}

                    {request.status === "pending" && (
                      <div className="space-y-2 pt-2">
                        <Label htmlFor={`response-${request._id}`}>
                          {t("offline.responseMessage")}
                        </Label>
                        <Textarea
                          id={`response-${request._id}`}
                          value={draft.responseMessage}
                          onChange={(e) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [request._id]: { responseMessage: e.target.value },
                            }))
                          }
                          placeholder={t("offlinePage.responsePlaceholder")}
                          disabled={isSaving}
                          rows={3}
                          className="w-full resize-y"
                        />
                      </div>
                    )}
                  </CardContent>

                  {request.status === "pending" && (
                    <CardFooter className="flex flex-col gap-2 border-t border-border/60 sm:flex-row">
                      <Button
                        className="w-full whitespace-normal sm:flex-1"
                        disabled={isSaving}
                        onClick={() => handleRespond(request._id, "responded")}
                      >
                        {isSaving ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <MessageSquare className="size-4" />
                        )}
                        {t("offlinePage.sendResponse")}
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full whitespace-normal sm:flex-1"
                        disabled={isSaving}
                        onClick={() => handleRespond(request._id, "closed")}
                      >
                        {t("offlinePage.closeRequest")}
                      </Button>
                    </CardFooter>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default OwnerOfflineRequestsPage;
