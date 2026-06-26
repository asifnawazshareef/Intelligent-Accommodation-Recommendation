import api from "./api.js";

export const getAllUsers = (role) => {
  const params = role && role !== "all" ? { role } : undefined;
  return api.get("/admin/users", { params });
};

export const updateUserVerification = (id, isVerified) =>
  api.put(`/admin/users/${id}/verify`, { isVerified });

export const updateUserRole = (id, role) =>
  api.put(`/admin/users/${id}/role`, { role });
