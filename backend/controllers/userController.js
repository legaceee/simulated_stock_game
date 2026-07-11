// controllers/userController.js
import { z } from "zod";
import prisma from "../config/prismaClient.js";
import AppError from "../utils/appError.js";
import { CatchAsync } from "../utils/catchAsync.js";
import bcrypt from "bcryptjs";

const updateProfileSchema = z.object({
  username: z.string().min(3).max(30).optional(),
  avatarUrl: z.string().url().optional(),
});

export const getAllUsers = CatchAsync(async (req, res) => {
  const users = await prisma.user.findMany({
    select: { id: true, username: true, email: true, createdAt: true },
  });

  res.status(200).json({
    status: "success",
    results: users.length,
    data: { users },
  });
});

export const updateProfile = CatchAsync(async (req, res, next) => {
  if (req.body.newPassword) {
    return next(
      new AppError("to change password use /passwordChange route", 400)
    );
  }
  const userId = req.user.id;
  if (!userId) {
    return next(new AppError("you must be login ", 400));
  }
  const parsedData = updateProfileSchema.parse(req.body);
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: parsedData,
  });

  res
    .status(200)
    .json({ message: "Profile updated", data: { user: updatedUser } });
});

export const deleteMyAccount = CatchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const { password } = req.body;
  if (!userId) {
    return next(new AppError("You must be logged in", 401));
  }
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const isPasswordCorrect = await bcrypt.compare(password, user.password);
  if (!isPasswordCorrect) {
    return next(new AppError("Incorrect password", 401));
  }
  await prisma.user.delete({
    where: { id: userId },
  });

  res.status(200).json({
    status: "success",
    message: "Your account has been deleted",
  });
});

export const getUser = CatchAsync(async (req, res, next) => {
  const userId = req.user.id;
  if (!userId) {
    return next(new AppError("You must be logged in", 401));
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, email: true, createdAt: true, cashBalance: true },
  });
  if (!user) {
    return next(new AppError("User not found", 404));
  }
  res.status(200).json({
    status: "success",
    data: {
      user,
    },
  });
});

export const getLeaderboard = CatchAsync(async (req, res) => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      email: true,
      cashBalance: true,
      avatarUrl: true,
      portfolios: {
        select: {
          portfolioItems: {
            select: {
              quantity: true,
              stock: {
                select: {
                  currentPrice: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const leaderboard = users.map((user) => {
    let stockValue = 0;
    if (user.portfolios && user.portfolios.length > 0) {
      user.portfolios.forEach((portfolio) => {
        portfolio.portfolioItems.forEach((item) => {
          if (item.stock) {
            stockValue += item.quantity * item.stock.currentPrice;
          }
        });
      });
    }
    const netWorth = user.cashBalance + stockValue;
    return {
      id: user.id,
      username: user.username || user.email.split("@")[0],
      cashBalance: user.cashBalance,
      stockValue: stockValue,
      netWorth: Number(netWorth.toFixed(2)),
      avatarUrl: user.avatarUrl,
    };
  });

  leaderboard.sort((a, b) => b.netWorth - a.netWorth);

  const rankedLeaderboard = leaderboard.map((user, index) => ({
    ...user,
    rank: index + 1,
  }));

  res.status(200).json({
    status: "success",
    data: {
      leaderboard: rankedLeaderboard,
    },
  });
});

export const setMpin = CatchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const { mpin } = req.body;

  if (!mpin || !/^\d{4}$/.test(mpin)) {
    return next(new AppError("MPIN must be a 4-digit number", 400));
  }

  const hashedMpin = await bcrypt.hash(mpin, 10);

  await prisma.user.update({
    where: { id: userId },
    data: { mpin: hashedMpin },
  });

  res.status(200).json({
    status: "success",
    message: "MPIN set successfully",
  });
});

export const hasMpin = CatchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { mpin: true },
  });

  res.status(200).json({
    status: "success",
    data: {
      hasMpin: !!user?.mpin,
    },
  });
});
