import { useCallback, useEffect, useMemo, useState } from "react";

import { Link } from "react-router-dom";

import { MessageSquare, RefreshCw } from "lucide-react";

import { useTranslation } from "react-i18next";

import DashboardLayout from "@/components/layout/DashboardLayout";

import OfflineRequestCard from "@/components/offline/OfflineRequestCard";

import { getGuestOfflineRequests } from "@/services/offlineRequestService";

import { Button } from "@/components/ui/button";

import { Badge } from "@/components/ui/badge";

import { Card, CardContent } from "@/components/ui/card";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import { Skeleton } from "@/components/ui/skeleton";

import { cn } from "@/lib/utils";



const FILTERS = ["all", "pending", "responded", "closed"];



const RequestCardSkeleton = () => (

  <Card className="glass-card">

    <div className="space-y-4 p-5 sm:p-6">

      <div className="flex items-start justify-between gap-3">

        <Skeleton className="h-6 w-3/4" />

        <Skeleton className="h-6 w-20 shrink-0" />

      </div>

      <Skeleton className="h-4 w-1/2" />

      <Skeleton className="h-24 w-full rounded-lg" />

      <Skeleton className="h-16 w-full rounded-lg" />

    </div>

  </Card>

);



const GuestOfflineRequestsPage = () => {

  const { t } = useTranslation();

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



  const newResponses = counts.responded;



  const filterLabel = (value) => {

    if (value === "all") return t("offlinePage.filterAll");

    return t(`offline.${value}`, value);

  };



  return (

    <DashboardLayout>

      <div className="mx-auto w-full max-w-6xl space-y-5 px-1 sm:space-y-6 sm:px-0">

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">

          <div className="min-w-0">

            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">

              {t("offlinePage.guestTitle")}

            </h1>

            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">

              {t("offlinePage.guestHint")}

            </p>

          </div>

          <div className="flex shrink-0 flex-col gap-2 sm:items-end">

            {newResponses > 0 && (

              <Badge className="w-fit whitespace-normal bg-emerald-500/15 px-3 py-1 text-emerald-700 dark:text-emerald-400">

                {t("offlinePage.newResponses", { count: newResponses })}

              </Badge>

            )}

            <Button

              variant="outline"

              onClick={fetchRequests}

              disabled={loading}

              className="w-full gap-2 sm:w-auto"

            >

              <RefreshCw className={cn("size-4 shrink-0", loading && "animate-spin")} />

              {t("offlinePage.refresh")}

            </Button>

          </div>

        </div>



        <div className="-mx-1 overflow-x-auto pb-1 sm:mx-0 sm:overflow-visible">

          <div

            className="flex w-max min-w-full gap-2 px-1 sm:w-auto sm:flex-wrap"

            role="tablist"

            aria-label={t("offlinePage.guestTitle")}

          >

            {FILTERS.map((value) => (

              <Button

                key={value}

                size="sm"

                variant={filter === value ? "default" : "outline"}

                onClick={() => setFilter(value)}

                className="shrink-0 gap-1.5 whitespace-nowrap"

                role="tab"

                aria-selected={filter === value}

              >

                {filterLabel(value)}

                {!loading && (

                  <span

                    className={cn(

                      "rounded-full px-1.5 py-0.5 text-xs tabular-nums",

                      filter === value

                        ? "bg-primary-foreground/20"

                        : "bg-muted text-muted-foreground",

                    )}

                  >

                    {counts[value]}

                  </span>

                )}

              </Button>

            ))}

          </div>

        </div>



        {error && (

          <Alert variant="destructive">

            <AlertTitle>{t("offlinePage.errorTitle")}</AlertTitle>

            <AlertDescription>{error}</AlertDescription>

          </Alert>

        )}



        {loading && (

          <div className="grid gap-4 sm:gap-5 md:grid-cols-2">

            {[1, 2, 3, 4].map((item) => (

              <RequestCardSkeleton key={item} />

            ))}

          </div>

        )}



        {!loading && requests.length === 0 && (

          <Card className="glass-card border-dashed">

            <CardContent className="flex flex-col items-center justify-center gap-4 px-4 py-14 text-center sm:py-16">

              <MessageSquare className="size-10 text-muted-foreground/50" />

              <div className="max-w-md space-y-1.5">

                <h2 className="text-lg font-semibold">

                  {t("offlinePage.guestEmptyTitle")}

                </h2>

                <p className="text-sm leading-relaxed text-muted-foreground">

                  {t("offlinePage.guestEmptyHint")}

                </p>

              </div>

              <Button asChild className="w-full sm:w-auto">

                <Link to="/search">{t("nav.search")}</Link>

              </Button>

            </CardContent>

          </Card>

        )}



        {!loading && requests.length > 0 && filteredRequests.length === 0 && (

          <Card className="glass-card border-dashed">

            <CardContent className="px-4 py-10 text-center text-sm text-muted-foreground">

              {t("offlinePage.noFilterResults", { status: filterLabel(filter) })}

            </CardContent>

          </Card>

        )}



        {!loading && filteredRequests.length > 0 && (

          <div className="grid items-start gap-4 sm:gap-5 md:grid-cols-2">

            {filteredRequests.map((request) => (

              <OfflineRequestCard

                key={String(request._id)}

                request={request}

                variant="guest"

              />

            ))}

          </div>

        )}

      </div>

    </DashboardLayout>

  );

};



export default GuestOfflineRequestsPage;

