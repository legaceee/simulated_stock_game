import Redis from "ioredis";
import prisma from "../config/prismaClient.js";

const sub = new Redis(process.env.REDIS_URL || "redis://localhost:6379"); // subscribe to your price feed
sub.subscribe("stock-prices");

sub.on("message", async (_channel, msg) => {
  const update = JSON.parse(msg); // { stockId, symbol, price, timestamp }
  const { stockId, price } = update;

  // BUY limits that are hit: price <= limitPrice
  const openBuys = await prisma.order.findMany({
    where: {
      stockId,
      side: "BUY",
      type: "LIMIT",
      status: "OPEN",
      limitPrice: { gte: price },
    },
    orderBy: { createdAt: "asc" }, // fair-ish
    take: 50, // batch
  });

  for (const ord of openBuys) {
    await fillLimitBuy(ord, price);
  }

  // Similarly: SELL limits hit when price >= limitPrice
  const openSells = await prisma.order.findMany({
    where: {
      stockId,
      side: "SELL",
      type: "LIMIT",
      status: "OPEN",
      limitPrice: { lte: price },
    },
    orderBy: { createdAt: "asc" },
    take: 50,
  });

  for (const ord of openSells) {
    await fillLimitSell(ord, price);
  }
});

async function fillLimitBuy(order, execPrice) {
  await prisma.$transaction(async (tx) => {
    const reserve = Number(order.limitPrice) * order.qty;
    const spend = execPrice * order.qty;
    const refund = reserve - spend; // refund difference if we executed cheaper

    // 1) Move money from reserved to spent
    await tx.user.update({
      where: { id: order.userId },
      data: {
        reservedCash: { decrement: reserve },
        // cashBalance was already decremented when reserving; refund any leftover
        cashBalance: { increment: refund > 0 ? refund : 0 },
      },
    });

    // 2) Upsert portfolio
    let portfolio = await tx.portfolio.findFirst({
      where: { userId: order.userId },
    });
    if (!portfolio) {
      portfolio = await tx.portfolio.create({
        data: { userId: order.userId, name: "Default Portfolio" },
      });
    }

    let item = await tx.portfolioItem.findFirst({
      where: { portfolioId: portfolio.id, stockId: order.stockId },
    });

    if (item) {
      const newQty = item.quantity + order.qty;
      const newAvg = (item.avgBuyPrice * item.quantity + spend) / newQty;
      await tx.portfolioItem.update({
        where: { id: item.id },
        data: { quantity: newQty, avgBuyPrice: newAvg },
      });
    } else {
      await tx.portfolioItem.create({
        data: {
          portfolioId: portfolio.id,
          stockId: order.stockId,
          quantity: order.qty,
          avgBuyPrice: execPrice,
        },
      });
    }

    // 3) Record transaction
    await tx.transaction.create({
      data: {
        userId: order.userId,
        stockId: order.stockId,
        type: "BUY",
        quantity: order.qty,
        price: execPrice,
        totalValue: spend,
      },
    });

    // 4) Close order
    await tx.order.update({
      where: { id: order.id },
      data: { status: "FILLED", filledQty: order.qty },
    });
  });
}

async function fillLimitSell(order, execPrice) {
  // mirror of fillLimitBuy: check holdings, reserve/unreserve qty (optional),
  // decrease quantity, add cash, create transaction, close order.
}
