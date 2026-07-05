import { todayInputValue } from "@/lib/dateUtils";

export { todayInputValue };

export const emptySearchValues = {
  city: "",
  title: "",
  minPrice: "",
  maxPrice: "",
  availabilityDate: todayInputValue(),
};

export const valuesFromSearchParams = (params) => ({
  city: params.get("city") || "",
  title: params.get("title") || "",
  minPrice: params.get("minPrice") || "",
  maxPrice: params.get("maxPrice") || "",
  availabilityDate: params.get("availabilityDate") || todayInputValue(),
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

export const hasActiveFilters = (values) => {
  const today = todayInputValue();

  return Object.entries(values).some(([key, value]) => {
    if (!value?.toString().trim()) {
      return false;
    }

    if (key === "availabilityDate" && value === today) {
      return false;
    }

    return true;
  });
};
