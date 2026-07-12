import bcrypt from "bcryptjs";
import prisma from "../config/prismaClient.js";
import AppError from "../utils/appError.js";
import { CatchAsync } from "../utils/catchAsync.js";

// Verify MPIN Helper
const checkUserMpin = async (userId, inputMpin) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { mpin: true }
  });

  if (!user || !user.mpin) {
    throw new Error("Please set your transaction MPIN first.");
  }
  if (!inputMpin) {
    throw new Error("Transaction MPIN is required for this operation.");
  }
  const isMatch = await bcrypt.compare(inputMpin, user.mpin);
  if (!isMatch) {
    throw new Error("Incorrect transaction MPIN.");
  }
};

// 1. Get all Commodities
export const getAllCommodities = CatchAsync(async (req, res, next) => {
  const commodities = await prisma.commodity.findMany({
    orderBy: { symbol: "asc" }
  });

  res.status(200).json({
    status: "success",
    results: commodities.length,
    data: { commodities }
  });
});

// 2. Get user's Commodity holdings
export const getCommodityHoldings = CatchAsync(async (req, res, next) => {
  const userId = req.user.id;

  const holdings = await prisma.commodityPortfolioItem.findMany({
    where: { userId },
    include: { commodity: true }
  });

  let totalInvested = 0;
  let totalCurrentValue = 0;

  const items = holdings.map((h) => {
    const currentPrice = h.commodity.currentPrice;
    const currentVal = h.quantity * currentPrice;
    const investedVal = h.quantity * h.avgBuyPrice;
    const returns = currentVal - investedVal;
    const returnsPercentage = investedVal > 0 ? (returns / investedVal) * 100 : 0;

    totalInvested += investedVal;
    totalCurrentValue += currentVal;

    return {
      id: h.id,
      commodityId: h.commodityId,
      symbol: h.commodity.symbol,
      name: h.commodity.name,
      unit: h.commodity.unit,
      quantity: h.quantity,
      avgBuyPrice: h.avgBuyPrice,
      investedValue: investedVal,
      currentValue: currentVal,
      returns,
      returnsPercentage
    };
  });

  const totalReturns = totalCurrentValue - totalInvested;
  const totalReturnsPercentage = totalInvested > 0 ? (totalReturns / totalInvested) * 100 : 0;

  res.status(200).json({
    status: "success",
    data: {
      holdings: items,
      summary: {
        totalInvested,
        totalCurrentValue,
        totalReturns,
        totalReturnsPercentage
      }
    }
  });
});

// 3) Buy Commodity
export const buyCommodity = CatchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const { commodityId, quantity } = req.body;

  const buyQty = parseFloat(quantity);
  if (isNaN(buyQty) || buyQty <= 0) {
    return next(new AppError("Please provide a valid quantity to buy.", 400));
  }

  const comm = await prisma.commodity.findUnique({ where: { id: commodityId } });
  if (!comm) {
    return next(new AppError("Commodity not found.", 404));
  }

  const totalCost = buyQty * comm.currentPrice;

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (user.cashBalance < totalCost) {
      throw new Error("Insufficient funds in your account wallet.");
    }

    // 1) Deduct balance
    await tx.user.update({
      where: { id: userId },
      data: { cashBalance: { decrement: totalCost } }
    });

    // 2) Upsert commodity holding
    let holding = await tx.commodityPortfolioItem.findFirst({
      where: { userId, commodityId }
    });

    if (holding) {
      const newQty = holding.quantity + buyQty;
      const newAvgPrice = (holding.avgBuyPrice * holding.quantity + totalCost) / newQty;

      holding = await tx.commodityPortfolioItem.update({
        where: { id: holding.id },
        data: {
          quantity: newQty,
          avgBuyPrice: newAvgPrice
        }
      });
    } else {
      holding = await tx.commodityPortfolioItem.create({
        data: {
          userId,
          commodityId,
          quantity: buyQty,
          avgBuyPrice: comm.currentPrice
        }
      });
    }

    // Calculate fees
    const brokerage = Math.min(20, totalCost * 0.0005);
    const charges = totalCost * 0.0002;
    const gst = (brokerage + charges) * 0.18;

    // 3) Record transaction
    await tx.transaction.create({
      data: {
        userId,
        type: "BUY",
        price: comm.currentPrice,
        quantity: Math.round(buyQty * 1000) / 1000,
        totalValue: totalCost,
        assetType: "COMMODITY",
        symbol: comm.symbol,
        brokerage,
        charges,
        gst,
        status: "COMPLETED",
        description: `Purchase of ${buyQty} ${comm.unit} of ${comm.symbol}`
      }
    });

    // 4) Record Audit Log
    await tx.auditLog.create({
      data: {
        userId,
        action: "COMMODITY_BUY_SUCCESS",
        ipAddress: req.ip || "127.0.0.1",
        details: `Bought ${buyQty} ${comm.unit} of ${comm.symbol} for ₹${totalCost.toFixed(2)}`,
      }
    });

    return holding;
  });

  res.status(200).json({
    status: "success",
    message: `Successfully purchased ${buyQty} ${comm.unit} of ${comm.name}!`,
    data: result
  });
});

// 4. Sell Commodity
export const sellCommodity = CatchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const { commodityId, quantity } = req.body;

  const sellQty = parseFloat(quantity);
  if (isNaN(sellQty) || sellQty <= 0) {
    return next(new AppError("Please provide a valid quantity to sell.", 400));
  }

  const comm = await prisma.commodity.findUnique({ where: { id: commodityId } });
  if (!comm) {
    return next(new AppError("Commodity not found.", 404));
  }

  const totalGain = sellQty * comm.currentPrice;

  const result = await prisma.$transaction(async (tx) => {
    const holding = await tx.commodityPortfolioItem.findFirst({
      where: { userId, commodityId }
    });

    if (!holding || holding.quantity < sellQty) {
      throw new Error(`Insufficient commodity holdings. You own ${holding ? holding.quantity : 0} ${comm.unit}.`);
    }

    // 1) Credit balance
    await tx.user.update({
      where: { id: userId },
      data: { cashBalance: { increment: totalGain } }
    });

    // 2) Update or Delete holding
    const newQty = holding.quantity - sellQty;
    let updatedHolding = null;

    if (newQty <= 0.0001) {
      await tx.commodityPortfolioItem.delete({
        where: { id: holding.id }
      });
    } else {
      updatedHolding = await tx.commodityPortfolioItem.update({
        where: { id: holding.id },
        data: { quantity: newQty }
      });
    }

    // Calculate fees & PNL
    const brokerage = Math.min(20, totalGain * 0.0005);
    const charges = totalGain * 0.0002;
    const gst = (brokerage + charges) * 0.18;
    const pnl = (comm.currentPrice - holding.avgBuyPrice) * sellQty;

    // 3) Record transaction
    await tx.transaction.create({
      data: {
        userId,
        type: "SELL",
        price: comm.currentPrice,
        quantity: Math.round(sellQty * 1000) / 1000,
        totalValue: totalGain,
        assetType: "COMMODITY",
        symbol: comm.symbol,
        brokerage,
        charges,
        gst,
        profitOrLoss: pnl,
        status: "COMPLETED",
        description: `Sale of ${sellQty} ${comm.unit} of ${comm.symbol}`
      }
    });

    // 4) Record Audit Log
    await tx.auditLog.create({
      data: {
        userId,
        action: "COMMODITY_SELL_SUCCESS",
        ipAddress: req.ip || "127.0.0.1",
        details: `Sold ${sellQty} ${comm.unit} of ${comm.symbol} for ₹${totalGain.toFixed(2)}. P&L: ₹${pnl.toFixed(2)}`,
      }
    });

    return updatedHolding;
  });

  res.status(200).json({
    status: "success",
    message: `Successfully sold ${sellQty} ${comm.unit} of ${comm.name}!`,
    data: result
  });
});
