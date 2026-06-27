import { Building2, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import PropertySearchCard from "@/components/search/PropertySearchCard";
import ActionLink from "@/components/ui/action-link";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { hasActiveFilters } from "@/lib/searchParams";

const ResultSkeleton = ({ count = 6 }) => (
  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
        <Card className="glass-card border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-3 px-4 py-14 text-center sm:py-16">
            <Building2 className="size-10 text-muted-foreground/50" />
            <div className="max-w-md space-y-1.5">
              <h3 className="text-lg font-semibold">{t("search.emptyTitle")}</h3>
              <p className="text-sm text-muted-foreground">
                {t("search.emptyHint")}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {!loading && results.length > 0 && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
