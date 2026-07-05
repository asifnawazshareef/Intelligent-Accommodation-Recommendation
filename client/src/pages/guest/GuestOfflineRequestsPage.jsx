import { useCallback, useEffect, useMemo, useState } from "react";
import { MessageSquare } from "lucide-react";
import { useTranslation } from "react-i18next";
import DashboardLayout from "@/components/layout/DashboardLayout";
import OfflineRequestCard from "@/components/offline/OfflineRequestCard";
import { getGuestOfflineRequests } from "@/services/offlineRequestService";
import ActionLink from "@/components/ui/action-link";
import EmptyState from "@/components/ui/EmptyState";
import FilterChipBar, { FilterChip } from "@/components/ui/FilterChipBar";
import PageHeader from "@/components/ui/PageHeader";
import RefreshButton from "@/components/ui/RefreshButton";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";



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

      <div className="dashboard-page">

        <PageHeader
          title={t("offlinePage.guestTitle")}
          description={t("offlinePage.guestHint")}
          actions={
            <>
              {newResponses > 0 && (
                <Badge className="w-fit whitespace-normal bg-emerald-500/15 px-3 py-1 text-emerald-700 dark:text-emerald-400">
                  {t("offlinePage.newResponses", { count: newResponses })}
                </Badge>
              )}
              <RefreshButton
                onClick={fetchRequests}
                loading={loading}
                label={t("offlinePage.refresh")}
                className="w-full sm:w-auto"
              />
            </>
          }
        />

        <FilterChipBar className="-mx-1 overflow-x-auto pb-1 sm:mx-0 sm:overflow-visible">
          <div
            className="flex w-max min-w-full gap-2 px-1 sm:w-auto sm:flex-wrap"
            role="tablist"
            aria-label={t("offlinePage.guestTitle")}
          >
            {FILTERS.map((value) => (
              <FilterChip
                key={value}
                active={filter === value}
                onClick={() => setFilter(value)}
                count={counts[value]}
              >
                {filterLabel(value)}
              </FilterChip>
            ))}
          </div>
        </FilterChipBar>



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
          <EmptyState
            icon={MessageSquare}
            title={t("offlinePage.guestEmptyTitle")}
            description={t("offlinePage.guestEmptyHint")}
          >
            <ActionLink to="/search" className="w-full sm:w-auto">
              {t("nav.search")}
            </ActionLink>
          </EmptyState>
        )}

        {!loading && requests.length > 0 && filteredRequests.length === 0 && (
          <EmptyState
            compact
            title={t("offlinePage.noFilterResults", { status: filterLabel(filter) })}
          />
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

