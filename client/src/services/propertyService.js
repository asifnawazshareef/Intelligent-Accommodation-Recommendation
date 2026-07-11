import api from "./api.js";

export const getApprovedProperties = () => api.get("/properties");

export const getMyProperties = () =>
  api.get("/properties/owner/my-properties");

export const getPropertyById = (id) => api.get(`/properties/${id}`);

export const trackPropertyView = (id) => api.post(`/properties/${id}/view`);

export const createProperty = (formData) => api.post("/properties", formData);

export const updateProperty = (id, formData) =>
  api.put(`/properties/${id}`, formData);
