export const formatDate = (value, locale) => {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(locale);
};

export const formatPrice = (amount, currencyLabel = "PKR") => {
  if (amount === undefined || amount === null || Number.isNaN(Number(amount))) {
    return "—";
  }
  return `${Number(amount).toLocaleString()} ${currencyLabel}`;
};
