import api from "./api.js";

export const loginRequest = (credentials) =>
  api.post("/auth/login", credentials);

export const registerRequest = (userData) =>
  api.post("/auth/register", userData);

export const getMeRequest = () => api.get("/auth/me");

export const getDashboardPath = (role) => {
  switch (role) {
    case "guest":
      return "/guest/dashboard";
    case "owner":
      return "/owner/dashboard";
    case "admin":
      return "/admin/dashboard";
    default:
      return "/login";
  }
};
