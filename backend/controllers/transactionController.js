import prisma from "../config/prismaClient.js";
import { CatchAsync } from "../utils/catchAsync.js";
export const getTransactions = CatchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const { page = 1, limit = 10, assetType, type, search, startDate, endDate } = req.query;

  const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const take = parseInt(limit, 10);

  const whereClause = { userId };

  if (assetType) {
    whereClause.assetType = assetType;
  }
  if (type) {
    whereClause.type = type.toUpperCase();
  }

  if (startDate || endDate) {
    whereClause.createdAt = {};
    if (startDate) whereClause.createdAt.gte = new Date(startDate);
    if (endDate) whereClause.createdAt.lte = new Date(endDate);
  }

  if (search) {
    whereClause.OR = [
      { symbol: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } }
    ];
  }

  const transactions = await prisma.transaction.findMany({
    where: whereClause,
    orderBy: { createdAt: "desc" },
    skip,
    take,
    include: {
      stock: {
        select: {
          symbol: true,
          companyName: true
        },
      },
    },
  });

  const totalCount = await prisma.transaction.count({ where: whereClause });

  res.json({
    success: true,
    data: transactions,
    pagination: {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      totalCount,
      totalPages: Math.ceil(totalCount / take)
    }
  });
});

export const withdrawTransaction = CatchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const transaction = await prisma.transaction.findMany({
    where: { userId, type: "WITHDRAW" },
  });
  if (!transaction || transaction.length === 0) {
    return res.status(404).json({ message: "No withdraw transactions found" });
  }
  res.json({ success: true, data: transaction });
});

export const depositTransaction = CatchAsync(async (req, res, next) => {
  const userId = req.user.id;

  const transaction = await prisma.transaction.findMany({
    where: { userId, type: "DEPOSIT" },
  });

  if (!transaction || transaction.length === 0) {
    return res.status(404).json({ message: "No deposit transactions found" });
  }
  res.json({ success: true, data: transaction });
});
export const buyTransaction = CatchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const transaction = await prisma.transaction.findMany({
    where: { userId, type: "BUY" },
  });
  if (!transaction || transaction.length === 0) {
    return res.status(404).json({ message: "No buy transactions found" });
  }
  res.json({ success: true, data: transaction });
});

export const sellTransaction = CatchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const transaction = await prisma.transaction.findMany({
    where: { userId, type: "SELL" },
  });
  if (!transaction || transaction.length === 0) {
    return res.status(404).json({ message: "No sell transactions found" });
  }
  res.json({ success: true, data: transaction });
});
