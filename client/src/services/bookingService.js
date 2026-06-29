import api from "./api.js";

export const createBooking = (data) => api.post("/bookings", data);

export const getMyBookings = () => api.get("/bookings/my-bookings");

export const getBookingById = (id) => api.get(`/bookings/${id}`);

export const confirmDemoPayment = (id) =>
  api.put(`/bookings/${id}/confirm-demo-payment`);

export const cancelBooking = (id) => api.put(`/bookings/${id}/cancel`);
