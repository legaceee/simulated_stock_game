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
import { redisRateLimiter } from "./middlewares/rateLimiter.js";
import cookieParser from "cookie-parser";
import kycRoute from "./routes/kycRoutes.js";
import devRoute from "./routes/devRoutes.js";
import mfRoute from "./routes/mfRoutes.js";
import commodityRoute from "./routes/commodityRoutes.js";
import watchlistRoute from "./routes/watchlistRoutes.js";
import alertRoute from "./routes/alertRoutes.js";

const app = express();

app.use(cookieParser());

// Middleware
app.use(helmet());
app.use("/api", redisRateLimiter(200, 900));
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
app.use("/api/v1/kyc", kycRoute);
app.use("/api/v1/dev", devRoute);
app.use("/api/v1/mf", mfRoute);
app.use("/api/v1/commodity", commodityRoute);
app.use("/api/v1/watchlist", watchlistRoute);
app.use("/api/v1/alert", alertRoute);
app.all(/.*/, (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

app.use(globalErrorHandler);
// Export the app for use in server.js
export default app;
