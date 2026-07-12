import jwt from "jsonwebtoken";
import prisma from "../config/prismaClient.js";
import { publisher, subscriber } from "../utils/redisClient.js";
import AppError from "../utils/appError.js";
import { CatchAsync } from "../utils/catchAsync.js";

// Check if token is blacklisted in Redis
const isTokenBlacklisted = async (token) => {
  const blacklisted = await publisher.get(`blacklist:${token}`);
  return !!blacklisted;
};

export const requireAuth = CatchAsync(async (req, res, next) => {
  let token;
  
  // 1) Read token from Authorization header or cookies
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.cookies && req.cookies.jwt) {
    token = req.cookies.jwt;
  }

  if (!token) {
    return next(new AppError("You are not logged in. Please log in to get access.", 401));
  }

  // 2) Check if token is blacklisted
  const blacklisted = await isTokenBlacklisted(token);
  if (blacklisted) {
    return next(new AppError("This session has expired or has been logged out. Please log in again.", 401));
  }

  // 3) Verify token
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return next(new AppError("Invalid or expired session token. Please log in again.", 401));
  }

  // 4) Check if user still exists
  const user = await prisma.user.findUnique({ 
    where: { id: decoded.id },
    select: {
      id: true,
      email: true,
      username: true,
      role: true,
      kycStatus: true,
      kycDocument: true,
      failedLoginAttempts: true,
      lockUntil: true,
      passwordChangedAt: true,
      cashBalance: true,
    }
  });

  if (!user) {
    return next(new AppError("The user belonging to this token no longer exists.", 401));
  }

  // 5) Check if account is currently locked
  if (user.lockUntil && user.lockUntil > new Date()) {
    return next(new AppError("This account is temporarily locked due to multiple failed login attempts.", 403));
  }

  // 6) Check if password was changed after token was issued
  if (user.passwordChangedAt) {
    const changedTimestamp = parseInt(user.passwordChangedAt.getTime() / 1000, 10);
    if (decoded.iat < changedTimestamp) {
      return next(new AppError("User recently changed password. Please log in again.", 401));
    }
  }

  // 7) Set token and user context
  req.token = token;
  req.user = user;
  next();
});

export const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== "ADMIN") {
    return next(new AppError("Forbidden: You do not have permission to perform this action.", 403));
  }
  next();
};

export const requireKycApproved = (req, res, next) => {
  if (!req.user || req.user.kycStatus !== "APPROVED") {
    return next(new AppError("KYC verification is mandatory before you can perform trading or wallet transactions.", 403));
  }
  next();
};
