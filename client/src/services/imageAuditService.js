import api from "./api.js";

export const getImageAuditList = (status) =>
  api.get("/admin/image-audit", {
    params: status && status !== "all" ? { status } : undefined,
  });

export const updateImageAudit = ({ propertyId, imageId }, data) =>
  api.put(
    `/admin/image-audit/${encodeURIComponent(propertyId)}/${encodeURIComponent(imageId)}`,
    data,
  );
