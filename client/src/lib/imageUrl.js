export const getApiOrigin = () => {
  const apiBase = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
  return apiBase.replace(/\/api\/?$/, "");
};

export const resolveImageUrl = (url) => {
  if (!url || typeof url !== "string") {
    return "";
  }

  const trimmed = url.trim();
  if (!trimmed) {
    return "";
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  const origin = getApiOrigin();
  return `${origin}${trimmed.startsWith("/") ? trimmed : `/${trimmed}`}`;
};
