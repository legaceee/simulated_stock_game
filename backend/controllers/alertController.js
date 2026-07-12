import prisma from "../config/prismaClient.js";
import AppError from "../utils/appError.js";
import { CatchAsync } from "../utils/catchAsync.js";

// 1. Create a price alert
export const createAlert = CatchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const { symbol, assetType, condition, value } = req.body;

  if (!symbol || !assetType || !condition || value === undefined) {
    return next(new AppError("Symbol, assetType, condition (GT/LT), and target value are required.", 400));
  }

  if (!["GT", "LT"].includes(condition)) {
    return next(new AppError("Condition must be 'GT' (Greater Than) or 'LT' (Less Than).", 400));
  }

  const alertValue = parseFloat(value);
  if (isNaN(alertValue) || alertValue <= 0) {
    return next(new AppError("Target price alert value must be a positive number.", 400));
  }

  const alert = await prisma.priceAlert.create({
    data: {
      userId,
      symbol: symbol.toUpperCase(),
      assetType,
      condition,
      value: alertValue,
      status: "PENDING",
    },
  });

  await prisma.auditLog.create({
    data: {
      userId,
      action: "ALERT_CREATED",
      ipAddress: req.ip || "127.0.0.1",
      details: `Created alert for ${symbol}: trigger when price is ${condition} ${alertValue}`,
    },
  });

  res.status(201).json({
    status: "success",
    message: `Alert set successfully for ${symbol.toUpperCase()} at ₹${alertValue}!`,
    data: { alert },
  });
});

// 2. Get active & triggered alerts of the user
export const getMyAlerts = CatchAsync(async (req, res, next) => {
  const userId = req.user.id;

  const alerts = await prisma.priceAlert.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  res.status(200).json({
    status: "success",
    results: alerts.length,
    data: { alerts },
  });
});

// 3. Cancel/Delete a pending alert
export const cancelAlert = CatchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const { alertId } = req.params;

  const alert = await prisma.priceAlert.findFirst({
    where: { id: alertId, userId },
  });

  if (!alert) {
    return next(new AppError("Alert not found.", 404));
  }

  await prisma.priceAlert.delete({
    where: { id: alertId },
  });

  res.status(200).json({
    status: "success",
    message: "Alert cancelled and removed successfully.",
  });
});
