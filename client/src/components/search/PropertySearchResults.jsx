import { Building2, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import PropertySearchCard from "@/components/search/PropertySearchCard";
import ActionLink from "@/components/ui/action-link";
import EmptyState from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { hasActiveFilters } from "@/lib/searchParams";

const ResultSkeleton = ({ count = 6 }) => (
  <div className="property-grid">
    {Array.from({ length: count }, (_, index) => (
      <Skeleton key={index} className="aspect-[4/3] w-full rounded-xl" />
    ))}
  </div>
);

const PropertySearchResults = ({
  results,
  loading,
  error,
  formValues,
  previewLimit = null,
  searchPageHref = "/search",
  className = "",
}) => {
  const { t } = useTranslation();
  const filtered = hasActiveFilters(formValues);
  const visibleResults = previewLimit
    ? results.slice(0, previewLimit)
    : results;
  const hasMore = previewLimit != null && results.length > previewLimit;

  return (
    <section className={`space-y-4 ${className}`}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold sm:text-2xl">
            {filtered ? t("search.resultsTitle") : t("home.availableStaysTitle")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {filtered
              ? t("search.homeFilteredHint")
              : t("home.availableStaysHint")}
          </p>
        </div>
        {!loading && (
          <p className="text-sm font-medium text-muted-foreground">
            {t("search.resultsCount", { count: results.length })}
          </p>
        )}
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 shrink-0 animate-spin" />
          {t("search.searching")}
        </div>
      )}

      {loading && <ResultSkeleton count={previewLimit || 6} />}

      {!loading && !error && results.length === 0 && (
        <EmptyState
          icon={Building2}
          title={t("search.emptyTitle")}
          description={t("search.emptyHint")}
        />
      )}

      {!loading && results.length > 0 && (
        <>
          <div className="property-grid">
            {visibleResults.map((property) => (
              <PropertySearchCard key={property._id} property={property} />
            ))}
          </div>

          {hasMore && (
            <div className="flex justify-center pt-2">
              <ActionLink
                to={searchPageHref}
                variant="outline"
                className="h-10 w-full gap-2 sm:w-auto"
              >
                {t("home.viewAllProperties", { count: results.length })}
              </ActionLink>
            </div>
          )}
        </>
      )}
    </section>
  );
};

export default PropertySearchResults;
