import api from "./api.js";

export const createReview = (data) => api.post("/reviews", data);

export const getPropertyReviews = (propertyId) =>
  api.get(`/reviews/property/${propertyId}`);

export const getEligibleBookings = (propertyId) =>
  api.get(`/reviews/eligible/${propertyId}`);

export const getPropertySentimentSummary = (propertyId) =>
  api.get(`/sentiment/property/${propertyId}`);
