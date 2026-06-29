export const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

export const errorHandler = (err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;

  res.status(statusCode).json({
    success: false,
    message: err.message,
    ...(err.code && { code: err.code }),
    ...(err.existingBookingId && { existingBookingId: err.existingBookingId }),
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};
