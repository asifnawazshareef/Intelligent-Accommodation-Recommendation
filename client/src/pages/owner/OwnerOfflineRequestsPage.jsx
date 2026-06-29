import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, MessageSquare, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import DashboardLayout from "@/components/layout/DashboardLayout";
import OfflineRequestCard from "@/components/offline/OfflineRequestCard";
import {
  getOwnerOfflineRequests,
  respondToOfflineRequest,
} from "@/services/offlineRequestService";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const FILTERS = ["all", "pending", "responded", "closed"];

const RequestCardSkeleton = () => (
  <Card className="glass-card">
    <div className="space-y-3 p-6">
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-20 w-full" />
    </div>
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
        nextDrafts[String(request._id)] = {
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
    const requestKey = String(requestId);
    const draft = drafts[requestKey];
    if (!draft?.responseMessage?.trim()) {
      setError(t("offlinePage.responseRequired"));
      return;
    }

    setSavingId(requestKey);
    setError("");
    setSuccessId("");

    try {
      const response = await respondToOfflineRequest(requestKey, {
        responseMessage: draft.responseMessage.trim(),
        status,
      });

      const updated = response.data.data;
      setRequests((prev) =>
        prev.map((item) =>
          String(item._id) === requestKey ? updated : item,
        ),
      );
      setDrafts((prev) => ({
        ...prev,
        [requestKey]: { responseMessage: updated.responseMessage || "" },
      }));
      setSuccessId(requestKey);
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
      <div className="dashboard-page">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {t("offlinePage.ownerTitle")}
            </h1>
            <p className="mt-1 max-w-2xl text-muted-foreground">
              {t("offlinePage.ownerHint")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {counts.pending > 0 && (
              <Badge className="whitespace-normal bg-amber-500/15 text-amber-800 dark:text-amber-300">
                {t("offlinePage.pendingCount", { count: counts.pending })}
              </Badge>
            )}
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
          <div className="grid gap-4 sm:gap-5 md:grid-cols-2">
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
          <div className="grid items-start gap-4 sm:gap-5 md:grid-cols-2">
            {filteredRequests.map((request) => {
              const requestId = String(request._id);
              const isSaving = savingId === requestId;
              const draft = drafts[requestId] || { responseMessage: "" };

              return (
                <OfflineRequestCard
                  key={requestId}
                  request={request}
                  variant="owner"
                  successMessage={
                    successId === requestId
                      ? t("offlinePage.respondSuccess")
                      : null
                  }
                  footer={
                    request.status === "pending" ? (
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label htmlFor={`response-${requestId}`}>
                            {t("offline.responseMessage")}
                          </Label>
                          <Textarea
                            id={`response-${requestId}`}
                            value={draft.responseMessage}
                            onChange={(e) =>
                              setDrafts((prev) => ({
                                ...prev,
                                [requestId]: { responseMessage: e.target.value },
                              }))
                            }
                            placeholder={t("offlinePage.responsePlaceholder")}
                            disabled={isSaving}
                            rows={3}
                            className="w-full resize-y"
                          />
                        </div>
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <Button
                            className="w-full whitespace-normal sm:flex-1"
                            disabled={isSaving}
                            onClick={() => handleRespond(requestId, "responded")}
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
                            onClick={() => handleRespond(requestId, "closed")}
                          >
                            {t("offlinePage.closeRequest")}
                          </Button>
                        </div>
                      </div>
                    ) : null
                  }
                />
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default OwnerOfflineRequestsPage;
