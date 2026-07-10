// app.js
import express from "express";
import cors from "cors";
import morgan from "morgan";
import helmet from "helmet";
import userRoute from "./routes/userRouter.js";
import orderRoute from "./routes/orderRoutes.js";
import portfolioRoute from "./routes/portFolioRoutes.js";
import walletRoute from "./routes/walletRoute.js";
import transactionRoute from "./routes/transactionRoutes.js";
import stockRoute from "./routes/stockRoutes.js";
import AppError from "./utils/appError.js";
import globalErrorHandler from "./utils/gobalErrorHandler.js";
import rateLimit from "express-rate-limit";
const app = express();

// Middleware
app.use(helmet());
const limiter = rateLimit({
  max: 100000, // relaxed for development and testing
  windowMs: 60 * 60 * 1000,
  message: "too many req from this ip ,please try again in an hour",
});
app.use("/api", limiter);
app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));
// for parsing application/json
app.use(morgan("dev")); // logs incoming requests

// Example route

app.use("/api/v1/users", userRoute);
app.use("/api/v1/stocks", orderRoute);
app.use("/api/v1/portfolio", portfolioRoute);
app.use("/api/v1/wallet", walletRoute);
app.use("/api/v1/transactions", transactionRoute);
app.use("/api/v1/candle", stockRoute);
app.all(/.*/, (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

app.use(globalErrorHandler);
// Export the app for use in server.js
export default app;
