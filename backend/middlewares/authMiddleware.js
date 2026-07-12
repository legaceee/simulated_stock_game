import jwt from "jsonwebtoken";
import prisma from "../config/prismaClient.js";
import { publisher, subscriber } from "../utils/redisClient.js";
import AppError from "../utils/appError.js";
import { CatchAsync } from "../utils/catchAsync.js";
import bcrypt from "bcryptjs";

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
      mpin: true,
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

export const requireKycApproved = CatchAsync(async (req, res, next) => {
  if (!req.user || req.user.kycStatus !== "APPROVED") {
    if (req.user) {
      await prisma.auditLog.create({
        data: {
          userId: req.user.id,
          action: "UNAUTHORIZED_TRADING_ATTEMPT",
          ipAddress: req.ip || "127.0.0.1",
          details: `Blocked trading attempt on ${req.method} ${req.originalUrl}. Reason: KYC status is ${req.user.kycStatus}`,
        }
      });
    }
    return next(new AppError("KYC verification is mandatory before you can perform trading or wallet transactions.", 403));
  }
  next();
});

export const requireKycApproval = requireKycApproved;

export const requireMpin = CatchAsync(async (req, res, next) => {
  const user = req.user;
  if (!user) {
    return next(new AppError("You must be logged in.", 401));
  }
  
  if (!user.mpin) {
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "UNAUTHORIZED_TRADING_ATTEMPT",
        ipAddress: req.ip || "127.0.0.1",
        details: `Blocked trade attempt on ${req.method} ${req.originalUrl}. Reason: MPIN not created.`,
      }
    });
    return next(new AppError("Please set your transaction MPIN first.", 403));
  }

  if (req.method === "POST") {
    const isMpinAction = req.originalUrl.includes("set-mpin") || 
                         req.originalUrl.includes("forgot-mpin") || 
                         req.originalUrl.includes("reset-mpin");
    
    if (!isMpinAction) {
      const { mpin } = req.body;
      if (!mpin) {
        return next(new AppError("Transaction MPIN is required for this operation.", 400));
      }
      const isMatch = await bcrypt.compare(mpin, user.mpin);
      if (!isMatch) {
        await prisma.auditLog.create({
          data: {
            userId: user.id,
            action: "FAILED_TRADING_ATTEMPT",
            ipAddress: req.ip || "127.0.0.1",
            details: `Incorrect MPIN provided during ${req.method} ${req.originalUrl}`,
          }
        });
        return next(new AppError("Incorrect transaction MPIN.", 401));
      }
    }
  }
  next();
});

export const requireWalletBalance = CatchAsync(async (req, res, next) => {
  const user = req.user;
  if (!user) return next();

  if (req.method === "POST" && (
    req.originalUrl.includes("buy") || 
    req.originalUrl.includes("order/place") || 
    req.originalUrl.includes("lumpsum") || 
    req.originalUrl.includes("sip")
  )) {
    const { qty, quantity, amount, buyQuantity, limitPrice, symbol, fundId, commodityId } = req.body;
    let requiredAmount = 0;
    
    const tradeQty = parseFloat(qty || quantity || buyQuantity || 0);
    const investAmount = parseFloat(amount || 0);

    if (investAmount > 0) {
      requiredAmount = investAmount;
    } else if (tradeQty > 0) {
      let price = parseFloat(limitPrice || 0);
      
      if (!price) {
        let searchSymbol = symbol || req.params.symbol;
        if (searchSymbol) {
          const stock = await prisma.stock.findUnique({ where: { symbol: searchSymbol.toUpperCase() } });
          if (stock) {
            price = stock.currentPrice;
          } else {
            const comm = await prisma.commodity.findUnique({ where: { symbol: searchSymbol.toUpperCase() } });
            if (comm) price = comm.currentPrice;
          }
        } else if (commodityId) {
          const comm = await prisma.commodity.findUnique({ where: { id: commodityId } });
          if (comm) price = comm.currentPrice;
        } else if (fundId) {
          const fund = await prisma.mutualFund.findUnique({ where: { id: fundId } });
          if (fund) price = fund.nav;
        }
      }
      requiredAmount = tradeQty * price;
    }

    if (requiredAmount > 0 && user.cashBalance < requiredAmount) {
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: "FAILED_TRADING_ATTEMPT",
          ipAddress: req.ip || "127.0.0.1",
          details: `Blocked trade attempt on ${req.method} ${req.originalUrl}. Reason: Insufficient funds (Required: ₹${requiredAmount.toFixed(2)}, Available: ₹${user.cashBalance.toFixed(2)})`,
        }
      });
      return next(new AppError("Insufficient funds in your account wallet.", 400));
    }
  }
  next();
});

export const requireTradingHours = (req, res, next) => {
  const now = new Date();
  const day = now.getDay();
  if (day === 0 || day === 6) {
    if (req.user) {
      prisma.auditLog.create({
        data: {
          userId: req.user.id,
          action: "FAILED_TRADING_ATTEMPT",
          ipAddress: req.ip || "127.0.0.1",
          details: `Blocked trading attempt outside trading hours (weekend).`,
        }
      }).catch(err => console.error(err));
    }
    return next(new AppError("Market is closed on weekends.", 403));
  }

  const hours = now.getHours();
  const mins = now.getMinutes();
  const totalMins = hours * 60 + mins;

  const openMins = 9 * 60 + 15;
  const closeMins = 15 * 60 + 30;

  if (totalMins < openMins || totalMins > closeMins) {
    if (req.user) {
      prisma.auditLog.create({
        data: {
          userId: req.user.id,
          action: "FAILED_TRADING_ATTEMPT",
          ipAddress: req.ip || "127.0.0.1",
          details: `Blocked trading attempt outside trading hours (9:15 AM - 3:30 PM).`,
        }
      }).catch(err => console.error(err));
    }
    return next(new AppError("Market is closed. Trading hours are 9:15 AM to 3:30 PM, Monday to Friday.", 403));
  }
  next();
};

export const requireMarketStatus = CatchAsync(async (req, res, next) => {
  const simPaused = (await publisher.get("sim:paused")) === "true";
  if (simPaused) {
    if (req.user) {
      await prisma.auditLog.create({
        data: {
          userId: req.user.id,
          action: "FAILED_TRADING_ATTEMPT",
          ipAddress: req.ip || "127.0.0.1",
          details: `Blocked trading attempt. Reason: Market simulation is paused.`,
        }
      });
    }
    return next(new AppError("Trading is temporarily disabled as the market simulation is paused.", 403));
  }
  next();
});
