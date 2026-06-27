export const emptySearchValues = {
  city: "",
  title: "",
  minPrice: "",
  maxPrice: "",
  availabilityDate: "",
};

export const valuesFromSearchParams = (params) => ({
  city: params.get("city") || "",
  title: params.get("title") || "",
  minPrice: params.get("minPrice") || "",
  maxPrice: params.get("maxPrice") || "",
  availabilityDate: params.get("availabilityDate") || "",
});

export const searchParamsFromValues = (values) => {
  const params = new URLSearchParams();

  Object.entries(values).forEach(([key, value]) => {
    if (value?.toString().trim()) {
      params.set(key, value.toString().trim());
    }
  });

  return params;
};

export const toSearchApiParams = (values) => ({
  city: values.city?.trim() || undefined,
  title: values.title?.trim() || undefined,
  minPrice: values.minPrice || undefined,
  maxPrice: values.maxPrice || undefined,
  availabilityDate: values.availabilityDate || undefined,
});

export const hasActiveFilters = (values) =>
  Object.values(values).some((value) => value?.toString().trim());
