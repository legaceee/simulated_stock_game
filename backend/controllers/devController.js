import { exec } from "child_process";
import fs from "fs";
import path from "path";
import prisma from "../config/prismaClient.js";
import { publisher } from "../utils/redisClient.js";
import { CatchAsync } from "../utils/catchAsync.js";
import AppError from "../utils/appError.js";

// Helper: Append logs to a local file
export const logDevAction = (message) => {
  try {
    const logPath = path.resolve(process.cwd(), "server_logs.txt");
    const timestamp = new Date().toISOString();
    fs.appendFileSync(logPath, `[${timestamp}] ${message}\n`);
  } catch (err) {
    console.error("Failed to write to dev log file:", err.message);
  }
};

// Middleware to verify Developer Secret
export const requireDevSecret = (req, res, next) => {
  const secret = req.headers["x-developer-secret"] || req.body.developerSecret;
  const expectedSecret = process.env.DEV_SECRET || "danielbryan";

  if (!secret || secret !== expectedSecret) {
    return next(new AppError("Unauthorized: Invalid Developer Secret", 401));
  }
  next();
};

// Verify Developer Access
export const verifyDevSecret = CatchAsync(async (req, res) => {
  logDevAction("Developer verified secret successfully");
  res.status(200).json({
    status: "success",
    message: "Developer secret verified successfully",
  });
});

// Get Developer Dashboard Status Metrics
export const getSystemStats = CatchAsync(async (req, res, next) => {
  // 1) Redis Info
  let redisMemory = "unknown";
  let redisConnectedClients = "unknown";
  try {
    const info = await publisher.info();
    const memMatch = info.match(/used_memory_human:([^\r\n]+)/);
    const clientMatch = info.match(/connected_clients:([^\r\n]+)/);
    if (memMatch) redisMemory = memMatch[1];
    if (clientMatch) redisConnectedClients = clientMatch[1];
  } catch (err) {
    console.error("Error reading Redis info:", err.message);
  }

  // 2) WebSocket clients
  const activeWsClients = await publisher.get("ws:active_clients") || "0";

  // 3) Database counts
  const userCount = await prisma.user.count();
  const sessionCount = await prisma.session.count();
  const auditLogsCount = await prisma.auditLog.count();
  const transactionCount = await prisma.transaction.count();
  const orderCount = await prisma.order.count();

  // 4) Simulation Status
  const simPaused = (await publisher.get("sim:paused")) === "true";

  // 5) Read recent log lines
  let recentLogs = [];
  try {
    const logPath = path.resolve(process.cwd(), "server_logs.txt");
    if (fs.existsSync(logPath)) {
      const logsContent = fs.readFileSync(logPath, "utf8");
      recentLogs = logsContent.trim().split("\n").slice(-50); // Get last 50 lines
    } else {
      recentLogs = ["No logs available yet."];
    }
  } catch (err) {
    recentLogs = [`Failed to read logs: ${err.message}`];
  }

  res.status(200).json({
    status: "success",
    data: {
      redis: {
        memoryUsed: redisMemory,
        connectedClients: redisConnectedClients,
        activeWsClients: parseInt(activeWsClients, 10),
      },
      postgres: {
        status: "CONNECTED",
        userCount,
        sessionCount,
        auditLogsCount,
        transactionCount,
        orderCount,
      },
      simulation: {
        paused: simPaused,
      },
      logs: recentLogs,
    },
  });
});

// Seed Database Trigger
export const triggerSeed = CatchAsync(async (req, res, next) => {
  logDevAction("Seeding database triggered");
  
  exec("npm run seed", { cwd: process.cwd() }, (error, stdout, stderr) => {
    if (error) {
      logDevAction(`Database seeding failed: ${error.message}`);
      return res.status(500).json({ status: "fail", error: error.message });
    }
    logDevAction("Database seeding completed successfully");
    res.status(200).json({
      status: "success",
      message: "Database seeded successfully",
      stdout,
    });
  });
});

// Reset Demo Data
export const resetDemoData = CatchAsync(async (req, res, next) => {
  logDevAction("Database demo data reset triggered");

  await prisma.$transaction(async (tx) => {
    // 1) Delete transactions, holdings, and orders
    await tx.transaction.deleteMany();
    await tx.portfolioItem.deleteMany();
    await tx.portfolio.deleteMany();
    await tx.order.deleteMany();
    await tx.session.deleteMany();
    await tx.emailVerification.deleteMany();
    await tx.wallet.deleteMany();
    await tx.priceAlert.deleteMany();
    await tx.mfPortfolioItem.deleteMany();
    await tx.sipItem.deleteMany();
    await tx.commodityPortfolioItem.deleteMany();
    
    // 2) Reset user balances & credentials lock details
    await tx.user.updateMany({
      data: {
        cashBalance: 100000.0,
        failedLoginAttempts: 0,
        lockUntil: null,
        kycStatus: "PENDING",
        kycDocument: null,
        pan: null,
        aadhaar: null,
        address: null,
        selfieUrl: null,
        signatureUrl: null,
        mpin: null,
      },
    });
  });

  logDevAction("Database demo data reset completed successfully");

  res.status(200).json({
    status: "success",
    message: "Demo data has been reset. All users initialized to 100k cash and pending KYC.",
  });
});

// Toggle Simulation Status
export const toggleSimulation = CatchAsync(async (req, res, next) => {
  const { paused } = req.body; // boolean
  
  await publisher.set("sim:paused", paused ? "true" : "false");
  logDevAction(`Market simulation status toggled to: ${paused ? "PAUSED" : "ACTIVE"}`);

  res.status(200).json({
    status: "success",
    message: `Market simulation is now ${paused ? "paused" : "active"}`,
    data: { paused },
  });
});
