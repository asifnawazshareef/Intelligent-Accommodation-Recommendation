import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Building2, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import PropertySearchForm, {
  emptySearchValues,
} from "@/components/search/PropertySearchForm";
import PropertySearchCard from "@/components/search/PropertySearchCard";
import RecommendedProperties from "@/components/search/RecommendedProperties";
import { searchProperties } from "@/services/searchService";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

const valuesFromParams = (params) => ({
  city: params.get("city") || "",
  title: params.get("title") || "",
  minPrice: params.get("minPrice") || "",
  maxPrice: params.get("maxPrice") || "",
  availabilityDate: params.get("availabilityDate") || "",
});

const paramsFromValues = (values) => {
  const params = new URLSearchParams();

  Object.entries(values).forEach(([key, value]) => {
    if (value?.toString().trim()) {
      params.set(key, value.toString().trim());
    }
  });

  return params;
};

const ResultSkeleton = () => (
  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
    {[1, 2, 3, 4, 5, 6].map((item) => (
      <Skeleton key={item} className="aspect-[4/3] w-full rounded-xl" />
    ))}
  </div>
);

const SearchPage = () => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [formValues, setFormValues] = useState(() =>
    valuesFromParams(searchParams),
  );
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);

  const recommendationContext = useMemo(
    () => ({
      city: formValues.city,
      price: formValues.maxPrice || formValues.minPrice,
    }),
    [formValues.city, formValues.maxPrice, formValues.minPrice],
  );

  const fetchResults = useCallback(
    async (values) => {
      setLoading(true);
      setError("");
      setHasSearched(true);

      try {
        const response = await searchProperties({
          city: values.city?.trim() || undefined,
          title: values.title?.trim() || undefined,
          minPrice: values.minPrice || undefined,
          maxPrice: values.maxPrice || undefined,
          availabilityDate: values.availabilityDate || undefined,
        });

        setResults(response.data.data || []);
      } catch (err) {
        setResults([]);
        setError(err.response?.data?.message || t("search.loadError"));
      } finally {
        setLoading(false);
      }
    },
    [t],
  );

  useEffect(() => {
    const nextValues = valuesFromParams(searchParams);
    setFormValues(nextValues);

    if ([...searchParams.keys()].length === 0) {
      return;
    }

    fetchResults(nextValues);
  }, [searchParams, fetchResults]);

  const handleSubmit = (values) => {
    setFormValues(values);
    setSearchParams(paramsFromValues(values), { replace: true });
  };

  const handleReset = () => {
    setFormValues(emptySearchValues);
    setResults([]);
    setHasSearched(false);
    setError("");
    setSearchParams({}, { replace: true });
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
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

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-semibold">{t("search.resultsTitle")}</h2>
          {hasSearched && !loading && (
            <p className="text-sm text-muted-foreground">
              {t("search.resultsCount", { count: results.length })}
            </p>
          )}
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {t("search.searching")}
          </div>
        )}

        {loading && <ResultSkeleton />}

        {!loading && hasSearched && results.length === 0 && !error && (
          <Card className="glass-card border-dashed">
            <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <Building2 className="size-10 text-muted-foreground/50" />
              <div className="max-w-md space-y-1">
                <h3 className="text-lg font-semibold">
                  {t("search.emptyTitle")}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {t("search.emptyHint")}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {!loading && results.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {results.map((property) => (
              <PropertySearchCard key={property._id} property={property} />
            ))}
          </div>
        )}

        {!loading && !hasSearched && (
          <Card className="glass-card border-dashed">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              {t("search.startHint")}
            </CardContent>
          </Card>
        )}
      </section>

      <RecommendedProperties
        city={recommendationContext.city}
        price={recommendationContext.price}
      />
    </div>
  );
};

export default SearchPage;
