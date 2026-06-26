import api from "./api.js";

export const createOfflineRequest = (data) =>
  api.post("/offline-requests", data);

export const getOwnerOfflineRequests = () =>
  api.get("/offline-requests/owner");

export const respondToOfflineRequest = (id, data) =>
  api.put(`/offline-requests/${id}/respond`, data);
