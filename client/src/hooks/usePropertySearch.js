import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { searchProperties } from "@/services/searchService";
import {
  emptySearchValues,
  searchParamsFromValues,
  toSearchApiParams,
  valuesFromSearchParams,
} from "@/lib/searchParams";

const usePropertySearch = ({ syncUrl = true } = {}) => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [formValues, setFormValues] = useState(() =>
    syncUrl ? valuesFromSearchParams(searchParams) : emptySearchValues,
  );
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchResults = useCallback(
    async (values) => {
      setLoading(true);
      setError("");

      try {
        const response = await searchProperties(toSearchApiParams(values));
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
    if (!syncUrl) {
      fetchResults(emptySearchValues);
      return;
    }

    const nextValues = valuesFromSearchParams(searchParams);
    setFormValues(nextValues);
    fetchResults(nextValues);
  }, [searchParams, fetchResults, syncUrl]);

  const handleSubmit = useCallback(
    (values) => {
      setFormValues(values);

      if (syncUrl) {
        setSearchParams(searchParamsFromValues(values), { replace: true });
        return;
      }

      fetchResults(values);
    },
    [syncUrl, setSearchParams, fetchResults],
  );

  const handleReset = useCallback(() => {
    setFormValues(emptySearchValues);
    setError("");

    if (syncUrl) {
      setSearchParams({}, { replace: true });
      return;
    }

    fetchResults(emptySearchValues);
  }, [syncUrl, setSearchParams, fetchResults]);

  const recommendationContext = useMemo(
    () => ({
      city: formValues.city,
      minPrice: formValues.minPrice,
      maxPrice: formValues.maxPrice,
      price: formValues.maxPrice || formValues.minPrice,
      availabilityDate: formValues.availabilityDate,
    }),
    [
      formValues.city,
      formValues.minPrice,
      formValues.maxPrice,
      formValues.availabilityDate,
    ],
  );

  return {
    formValues,
    setFormValues,
    results,
    loading,
    error,
    fetchResults,
    handleSubmit,
    handleReset,
    recommendationContext,
  };
};

export default usePropertySearch;
