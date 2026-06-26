import api from "./api.js";

export const getApprovedProperties = () => api.get("/properties");

export const getMyProperties = () =>
  api.get("/properties/owner/my-properties");

export const getPropertyById = (id) => api.get(`/properties/${id}`);

export const createProperty = (data) => api.post("/properties", data);

export const updateProperty = (id, data) => api.put(`/properties/${id}`, data);
