import { CatchAsync } from "../utils/catchAsync.js";
import prisma from "../config/prismaClient.js"; // Prisma client instance

import Fuse from "fuse.js";
import AppError from "../utils/appError.js";
// Get all stocks
export const getAllStocks = CatchAsync(async (req, res, next) => {
  const stocks = await prisma.stock.findMany({
    orderBy: { id: "asc" },
  });

  res.status(200).json({
    status: "success",
    results: stocks.length,
    data: {
      stocks,
    },
  });
});

// Get a stock by symbol
export const getStockBySymbol = CatchAsync(async (req, res, next) => {
  const { symbol } = req.params;

  if (!symbol) {
    return res.status(400).json({
      status: "fail",
      message: "Stock symbol is required",
    });
  }

  const stock = await prisma.stock.findUnique({
    where: { symbol: symbol.toUpperCase() },
  });

  if (!stock) {
    return res.status(404).json({
      status: "fail",
      message: `Stock with symbol '${symbol}' not found`,
    });
  }

  res.status(200).json({
    status: "success",
    data: {
      stock,
    },
  });
});

export const searchStocks = async (req, res) => {
  try {
    const { search } = req.params;
    if (!search) {
      return res.status(400).json({ message: "Query is required" });
    }

    // 1. Fetch all stocks (cache this in production)
    const stocks = await prisma.stock.findMany({
      select: { id: true, symbol: true, companyName: true },
    });

    // 2. Setup Fuse.js
    const fuse = new Fuse(stocks, {
      keys: ["companyName", "symbol"],
      threshold: 0.3, // lower = stricter matching
    });

    // 3. Search
    const result = fuse.search(search).slice(0, 5); // top 5

    res.json(result.map((r) => r.item));
  } catch (error) {
    res.status(500).json({ message: "Error searching stocks", error });
  }
};

export const buyStock = async (req, res) => {
  try {
    const { stockId, buyQuantity, currentPrice } = req.body;
    const userId = req.user.id;
    console.log(userId);
    const quantity = Number(buyQuantity);
    const price = Number(currentPrice);
    if (isNaN(quantity) || isNaN(price) || quantity <= 0 || price <= 0) {
      return res.status(400).json({ error: "Invalid quantity or price" });
    }

    const totalCost = quantity * price;

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId } });
      console.log("User from DB:", user);
      if (!user || user.cashBalance < totalCost) {
        throw new Error("Insufficient funds");
      }

      // Deduct money
      await tx.user.update({
        where: { id: userId },
        data: { cashBalance: { decrement: totalCost } },
      });

      // Update portfolio (upsert)
      let portfolio = await tx.portfolio.findFirst({
        where: { userId },
      });

      // If no portfolio exists, create one
      if (!portfolio) {
        portfolio = await tx.portfolio.create({
          data: {
            userId,
            name: "Default Portfolio", // or allow custom naming
          },
        });
      }
      let portfolioItem = await tx.portfolioItem.findFirst({
        where: { portfolioId: portfolio.id, stockId },
      });
      console.log("Portfolio Item:", portfolioItem);
      if (portfolioItem) {
        const newQuantity = portfolioItem.quantity + quantity;
        const newAvgPrice =
          (portfolioItem.avgBuyPrice * portfolioItem.quantity + totalCost) /
          newQuantity;

        portfolioItem = await tx.portfolioItem.update({
          where: { id: portfolioItem.id },
          data: { quantity: newQuantity, avgBuyPrice: newAvgPrice },
        });
      } else {
        portfolioItem = await tx.portfolioItem.create({
          data: {
            portfolioId: portfolio.id,
            stockId,
            quantity,
            avgBuyPrice: price,
          },
        });
      }

      // Record transaction
      await tx.transaction.create({
        data: {
          userId,
          stockId,
          type: "BUY",
          quantity,
          price,
          totalValue: totalCost,
        },
      });
      const transaction = await tx.transaction.findFirst({
        where: { userId, stockId, type: "BUY" },
      });
      console.log("transaction created", transaction);
      return { portfolioItem };
    });

    res.json({ message: "Stock purchased", data: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const sellStock = async (req, res) => {
  try {
    const { stockId, sellQuantity, currentPrice } = req.body;
    const userId = req.user.id;

    const quantity = Number(sellQuantity);
    const price = Number(currentPrice);
    if (isNaN(quantity) || isNaN(price) || quantity <= 0 || price <= 0) {
      return res.status(400).json({ error: "Invalid quantity or price" });
    }

    const totalGain = quantity * price;

    const result = await prisma.$transaction(async (tx) => {
      const portfolio = await tx.portfolio.findFirst({ where: { userId } });
      if (!portfolio) {
        throw new Error("Not enough shares to sell");
      }
      const portfolioItem = await tx.portfolioItem.findFirst({
        where: { portfolioId: portfolio.id, stockId },
      });

      if (!portfolioItem || portfolioItem.quantity < quantity) {
        throw new Error("Not enough shares to sell");
      }

      // Update holdings
      const newQuantity = portfolioItem.quantity - quantity;
      if (newQuantity === 0) {
        await tx.portfolioItem.delete({ where: { id: portfolioItem.id } });
      } else {
        await tx.portfolioItem.update({
          where: { id: portfolioItem.id },
          data: { quantity: newQuantity },
        });
      }

      // Credit balance
      await tx.user.update({
        where: { id: userId },
        data: { cashBalance: { increment: totalGain } },
      });

      // Record transaction
      await tx.transaction.create({
        data: {
          userId,
          stockId,
          type: "SELL",
          quantity,
          price,
          totalValue: totalGain,
        },
      });

      return { portfolioItem };
    });

    res.json({ message: "Stock sold", data: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getCandle = CatchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { interval } = req.query;

  if (!id || !interval) {
    return next(new AppError("Stock id and interval are required", 400));
  }

  const candles = await prisma.candle.findMany({
    where: {
      stockId: id.toString(),
      interval: interval,
    },
    orderBy: {
      time: "desc",
    },
    take: 100,
  });

  if (!candles || candles.length === 0) {
    return next(new AppError("No candles found for this stock/interval", 404));
  }

  res.status(200).json({
    status: "success",
    results: candles.length,
    data: {
      candles,
    },
  });
});
