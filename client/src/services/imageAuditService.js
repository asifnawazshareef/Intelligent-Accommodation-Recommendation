import api from "./api.js";

export const getImageAuditList = (status) =>
  api.get("/admin/image-audit", {
    params: status && status !== "all" ? { status } : undefined,
  });

export const updateImageAudit = (id, data) =>
  api.put(`/admin/image-audit/${id}`, data);
