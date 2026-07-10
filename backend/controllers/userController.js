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
