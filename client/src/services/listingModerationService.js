import api from "./api.js";

export const getPendingListings = () => api.get("/admin/listings/pending");

export const approveListing = (id) => api.put(`/admin/listings/${id}/approve`);

export const rejectListing = (id) => api.put(`/admin/listings/${id}/reject`);
