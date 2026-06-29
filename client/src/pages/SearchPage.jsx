import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Building2, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import PropertySearchForm from "@/components/search/PropertySearchForm";
import PropertySearchResults from "@/components/search/PropertySearchResults";
import RecommendedProperties from "@/components/search/RecommendedProperties";
import usePropertySearch from "@/hooks/usePropertySearch";
import { searchParamsFromValues } from "@/lib/searchParams";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const SearchPage = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();

  const {
    formValues,
    setFormValues,
    results,
    loading,
    error,
    handleSubmit,
    handleReset,
    recommendationContext,
  } = usePropertySearch({ syncUrl: true });

  const fullSearchHref = useMemo(() => {
    const params = searchParamsFromValues(formValues);
    const query = params.toString();
    return query ? `/search?${query}` : "/search";
  }, [formValues]);

  return (
    <div className="site-container space-y-8 py-8 sm:py-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {t("search.pageTitle")}
        </h1>
        <p className="mt-1 max-w-2xl text-muted-foreground">
          {t("search.pageHint")}
        </p>
      </div>

      <PropertySearchForm
        values={formValues}
        onChange={setFormValues}
        onSubmit={handleSubmit}
        onReset={handleReset}
        loading={loading}
      />

      {error && (
        <Alert variant="destructive">
          <AlertTitle>{t("search.errorTitle")}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <PropertySearchResults
        results={results}
        loading={loading}
        error={error}
        formValues={formValues}
        searchPageHref={fullSearchHref}
      />

      <RecommendedProperties
        city={recommendationContext.city}
        price={recommendationContext.price}
      />
    </div>
  );
};

export default SearchPage;
