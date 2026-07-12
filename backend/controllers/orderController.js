import bcrypt from "bcryptjs";
import prisma from "../config/prismaClient.js";
import AppError from "../utils/appError.js";
import { CatchAsync } from "../utils/catchAsync.js";

// Verify MPIN helper
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

// Place a new trade order
export const placeOrder = CatchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const {
    symbol,
    assetType, // STOCK, MUTUAL_FUND, COMMODITY
    side, // BUY, SELL
    type, // MARKET, LIMIT, STOP_LOSS, STOP_LIMIT, GTT, BRACKET, COVER
    qty,
    limitPrice,
    triggerPrice,
    stopPrice,
    targetPrice,
    mpin
  } = req.body;

  // Basic validation
  if (!symbol || !assetType || !side || !type || !qty) {
    return next(new AppError("Missing required order fields: symbol, assetType, side, type, and qty.", 400));
  }

  const orderQty = parseInt(qty, 10);
  if (isNaN(orderQty) || orderQty <= 0) {
    return next(new AppError("Quantity must be a positive integer.", 400));
  }

  // Validate MPIN
  try {
    await checkUserMpin(userId, mpin);
  } catch (err) {
    return next(new AppError(err.message, 401));
  }

  // Determine current price from DB
  let currentPrice = 0;
  let stockId = null;

  if (assetType === "STOCK") {
    const stock = await prisma.stock.findUnique({ where: { symbol: symbol.toUpperCase() } });
    if (!stock) return next(new AppError("Stock symbol not found.", 404));
    currentPrice = stock.currentPrice;
    stockId = stock.id;
  } else if (assetType === "COMMODITY") {
    const comm = await prisma.commodity.findUnique({ where: { symbol: symbol.toUpperCase() } });
    if (!comm) return next(new AppError("Commodity symbol not found.", 404));
    currentPrice = comm.currentPrice;
  } else {
    return next(new AppError("Direct order placement only supported for Stocks and Commodities. Use MF portal for Mutual Funds.", 400));
  }

  const executionPrice = type === "MARKET" ? currentPrice : parseFloat(limitPrice || currentPrice);
  const totalValue = orderQty * executionPrice;

  // MARKET ORDER: Execute immediately
  if (type === "MARKET") {
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId } });

      if (side === "BUY") {
        if (user.cashBalance < totalValue) {
          throw new Error("Insufficient funds in your account wallet.");
        }

        // Deduct balance
        await tx.user.update({
          where: { id: userId },
          data: { cashBalance: { decrement: totalValue } }
        });

        // Upsert portfolio holdings
        if (assetType === "STOCK") {
          let portfolio = await tx.portfolio.findFirst({ where: { userId } });
          if (!portfolio) {
            portfolio = await tx.portfolio.create({ data: { userId, name: "Default Portfolio" } });
          }

          let holding = await tx.portfolioItem.findFirst({
            where: { portfolioId: portfolio.id, stockId }
          });

          if (holding) {
            const newQty = holding.quantity + orderQty;
            const newAvg = (holding.avgBuyPrice * holding.quantity + totalValue) / newQty;
            await tx.portfolioItem.update({
              where: { id: holding.id },
              data: { quantity: newQty, avgBuyPrice: newAvg }
            });
          } else {
            await tx.portfolioItem.create({
              data: { portfolioId: portfolio.id, stockId, quantity: orderQty, avgBuyPrice: executionPrice }
            });
          }
        } else if (assetType === "COMMODITY") {
          const comm = await tx.commodity.findUnique({ where: { symbol: symbol.toUpperCase() } });
          let holding = await tx.commodityPortfolioItem.findFirst({
            where: { userId, commodityId: comm.id }
          });

          if (holding) {
            const newQty = holding.quantity + orderQty;
            const newAvg = (holding.avgBuyPrice * holding.quantity + totalValue) / newQty;
            await tx.commodityPortfolioItem.update({
              where: { id: holding.id },
              data: { quantity: newQty, avgBuyPrice: newAvg }
            });
          } else {
            await tx.commodityPortfolioItem.create({
              data: { userId, commodityId: comm.id, quantity: orderQty, avgBuyPrice: executionPrice }
            });
          }
        }

        // Record transaction
        await tx.transaction.create({
          data: {
            userId,
            stockId: assetType === "STOCK" ? stockId : null,
            type: "BUY",
            quantity: orderQty,
            price: executionPrice,
            totalValue
          }
        });
      } else {
        // SELL Side
        if (assetType === "STOCK") {
          const portfolio = await tx.portfolio.findFirst({ where: { userId } });
          const holding = portfolio
            ? await tx.portfolioItem.findFirst({ where: { portfolioId: portfolio.id, stockId } })
            : null;

          if (!holding || holding.quantity < orderQty) {
            throw new Error(`Insufficient shares to sell. You own ${holding ? holding.quantity : 0} shares.`);
          }

          if (holding.quantity === orderQty) {
            await tx.portfolioItem.delete({ where: { id: holding.id } });
          } else {
            await tx.portfolioItem.update({
              where: { id: holding.id },
              data: { quantity: { decrement: orderQty } }
            });
          }
        } else if (assetType === "COMMODITY") {
          const comm = await tx.commodity.findUnique({ where: { symbol: symbol.toUpperCase() } });
          const holding = await tx.commodityPortfolioItem.findFirst({
            where: { userId, commodityId: comm.id }
          });

          if (!holding || holding.quantity < orderQty) {
            throw new Error(`Insufficient commodity holding. You own ${holding ? holding.quantity : 0} units.`);
          }

          if (holding.quantity === orderQty) {
            await tx.commodityPortfolioItem.delete({ where: { id: holding.id } });
          } else {
            await tx.commodityPortfolioItem.update({
              where: { id: holding.id },
              data: { quantity: { decrement: orderQty } }
            });
          }
        }

        // Add cash balance
        await tx.user.update({
          where: { id: userId },
          data: { cashBalance: { increment: totalValue } }
        });

        // Record transaction
        await tx.transaction.create({
          data: {
            userId,
            stockId: assetType === "STOCK" ? stockId : null,
            type: "SELL",
            quantity: orderQty,
            price: executionPrice,
            totalValue
          }
        });
      }

      // Save order log as COMPLETED
      return await tx.order.create({
        data: {
          userId,
          symbol: symbol.toUpperCase(),
          assetType,
          side,
          type,
          qty: orderQty,
          filledQty: orderQty,
          limitPrice: executionPrice,
          status: "COMPLETED",
          stockId: assetType === "STOCK" ? stockId : null,
        }
      });
    });

    await prisma.auditLog.create({
      data: {
        userId,
        action: `TRADE_${side}_MARKET`,
        ipAddress: req.ip || "127.0.0.1",
        details: `Successfully completed market ${side.toLowerCase()} order of ${orderQty} ${symbol} at ₹${executionPrice}`
      }
    });

    return res.status(200).json({
      status: "success",
      message: `Market order executed successfully!`,
      data: { order: result }
    });
  }

  // LIMIT, STOP_LOSS, GTT, BRACKET, COVER: Create pending order in DB and reserve resources
  const pendingResult = await prisma.$transaction(async (tx) => {
    // If buying: Reserve cash margin
    if (side === "BUY") {
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (user.cashBalance < totalValue) {
        throw new Error("Insufficient funds to place this order and reserve cash.");
      }

      // Reserve funds
      await tx.user.update({
        where: { id: userId },
        data: {
          cashBalance: { decrement: totalValue },
          reservedCash: { increment: totalValue }
        }
      });
    } else {
      // If selling: verify holdings exist
      if (assetType === "STOCK") {
        const portfolio = await tx.portfolio.findFirst({ where: { userId } });
        const holding = portfolio
          ? await tx.portfolioItem.findFirst({ where: { portfolioId: portfolio.id, stockId } })
          : null;

        if (!holding || holding.quantity < orderQty) {
          throw new Error("Insufficient share holdings to place sell limit/stop order.");
        }
      } else if (assetType === "COMMODITY") {
        const comm = await tx.commodity.findUnique({ where: { symbol: symbol.toUpperCase() } });
        const holding = await tx.commodityPortfolioItem.findFirst({
          where: { userId, commodityId: comm.id }
        });

        if (!holding || holding.quantity < orderQty) {
          throw new Error("Insufficient commodity holdings to place sell limit/stop order.");
        }
      }
    }

    // Save pending order record
    return await tx.order.create({
      data: {
        userId,
        symbol: symbol.toUpperCase(),
        assetType,
        side,
        type,
        qty: orderQty,
        limitPrice: limitPrice ? parseFloat(limitPrice) : null,
        triggerPrice: triggerPrice ? parseFloat(triggerPrice) : null,
        stopPrice: stopPrice ? parseFloat(stopPrice) : null,
        targetPrice: targetPrice ? parseFloat(targetPrice) : null,
        status: "PENDING",
        stockId: assetType === "STOCK" ? stockId : null,
      }
    });
  });

  await prisma.auditLog.create({
    data: {
      userId,
      action: `ORDER_PLACED_${type}`,
      ipAddress: req.ip || "127.0.0.1",
      details: `Placed pending ${side.toLowerCase()} ${type.toLowerCase()} order for ${orderQty} ${symbol}`
    }
  });

  res.status(200).json({
    status: "success",
    message: `Pending ${type} order placed successfully! Margin reserved.`,
    data: { order: pendingResult }
  });
});

// Retrieve User's Order History
export const getMyOrders = CatchAsync(async (req, res, next) => {
  const userId = req.user.id;

  const orders = await prisma.order.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" }
  });

  res.status(200).json({
    status: "success",
    results: orders.length,
    data: { orders }
  });
});

// Cancel a pending order
export const cancelOrder = CatchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const { orderId } = req.params;

  const order = await prisma.order.findFirst({
    where: { id: orderId, userId }
  });

  if (!order) {
    return next(new AppError("Order not found.", 404));
  }

  if (order.status !== "PENDING" && order.status !== "OPEN") {
    return next(new AppError("Only pending orders can be cancelled.", 400));
  }

  await prisma.$transaction(async (tx) => {
    // If it was a buy order, release the reserved cash
    if (order.side === "BUY") {
      const orderPrice = order.limitPrice ? Number(order.limitPrice) : 0;
      const refund = order.qty * orderPrice;

      await tx.user.update({
        where: { id: userId },
        data: {
          cashBalance: { increment: refund },
          reservedCash: { decrement: refund }
        }
      });
    }

    // Cancel order
    await tx.order.update({
      where: { id: orderId },
      data: { status: "CANCELLED" }
    });
  });

  await prisma.auditLog.create({
    data: {
      userId,
      action: "ORDER_CANCELLED",
      ipAddress: req.ip || "127.0.0.1",
      details: `Cancelled pending order id ${orderId}`
    }
  });

  res.status(200).json({
    status: "success",
    message: "Order cancelled successfully. Reserved margins refunded."
  });
});
