import api from "./api.js";

export const searchProperties = (params) =>
  api.get("/search", { params });

export const getRecommendations = (params) =>
  api.get("/recommendations", { params });
