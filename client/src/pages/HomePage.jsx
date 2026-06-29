import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import PropertySearchForm from "@/components/search/PropertySearchForm";
import PropertySearchResults from "@/components/search/PropertySearchResults";
import RecommendedProperties from "@/components/search/RecommendedProperties";
import usePropertySearch from "@/hooks/usePropertySearch";
import { searchParamsFromValues } from "@/lib/searchParams";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const HOME_RESULTS_PREVIEW = 6;

const HomePage = () => {
  const { t } = useTranslation();

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

  const searchPageHref = useMemo(() => {
    const params = searchParamsFromValues(formValues);
    const query = params.toString();
    return query ? `/search?${query}` : "/search";
  }, [formValues]);

  return (
    <>
      <section className="site-container space-y-6 py-8 sm:py-10">
        <div className="max-w-2xl space-y-1">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {t("search.homeSearchTitle")}
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
            {t("search.homeSearchHintLive")}
          </p>
        </div>

        <PropertySearchForm
          values={formValues}
          onChange={setFormValues}
          onSubmit={handleSubmit}
          onReset={handleReset}
          loading={loading}
          showHeader={false}
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
          previewLimit={HOME_RESULTS_PREVIEW}
          searchPageHref={searchPageHref}
        />
      </section>

      <section className="border-t border-border/60 bg-muted/20 py-12 sm:py-16">
        <div className="site-container">
          <RecommendedProperties
            city={recommendationContext.city}
            price={recommendationContext.price}
          />
        </div>
      </section>
    </>
  );
};

export default HomePage;
