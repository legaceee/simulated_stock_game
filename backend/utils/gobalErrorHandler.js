// middleware/globalErrorHandler.js
import AppError from "./appError.js";

const handlePrismaErrors = (err) => {
  // Unique constraint violation
  if (err.code === "P2002") {
    const fields = err.meta?.target?.join(", ") || "field";
    return new AppError(`Duplicate value for ${fields}`, 400);
  }

  // Foreign key constraint failed
  if (err.code === "P2003") {
    return new AppError("Invalid reference (related record not found)", 400);
  }

  // Record not found
  if (err.code === "P2025") {
    return new AppError("Record not found", 404);
  }

  return err;
};

const handleJWTErrors = (err) => {
  if (err.name === "JsonWebTokenError") {
    return new AppError("Invalid token, please log in again", 401);
  }
  if (err.name === "TokenExpiredError") {
    return new AppError("Your token has expired, please log in again", 401);
  }
  return err;
};

const handleSocketErrors = (err) => {
  return new AppError("Socket connection failed", 500);
};

const handleRedisErrors = (err) => {
  return new AppError("Redis connection failed", 500);
};

export default (err, req, res, next) => {
  console.error("Global Error Handler caught:", err);
  // Default values
  err.statusCode = err.statusCode || 500;
  err.status = err.status || "error";

  let error = { ...err };
  error.message = err.message;

  // Prisma
  if (err.code && err.code.startsWith("P2")) error = handlePrismaErrors(err);

  // JWT
  if (
    err.name &&
    (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError")
  ) {
    error = handleJWTErrors(err);
  }

  // Socket.IO
  if (err.type === "SocketError") error = handleSocketErrors(err);

  // Redis
  if (err.command) error = handleRedisErrors(err);

  // Response
  res.status(error.statusCode || 500).json({
    status: error.status || "error",
    message: error.message || "Something went wrong",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};

//ye bhi error derha h need to fix it
