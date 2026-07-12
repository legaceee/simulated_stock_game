import prisma from "../config/prismaClient.js";
import AppError from "../utils/appError.js";
import { CatchAsync } from "../utils/catchAsync.js";

export const getPortfolio = async (req, res) => {
  try {
    const userId = req.user.id;
    console.log("User ID:", userId);
    const portfolio = await prisma.portfolio.findFirst({
      where: { userId },
      include: {
        portfolioItems: {
          include: {
            stock: true,
          },
        },
      },
    });

    if (!portfolio) {
      return res.status(404).json({ error: "Portfolio not found" });
    }

    res.json({ portfolio });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getPortfolioByName = CatchAsync(async (req, res, next) => {
  const { name } = req.params;
  const userId = req.user.id;
  if (!name) {
    return next(new AppError("name of portfolio is required ", 400));
  }

  let portfolio;

  if (name === "default") {
    portfolio = await prisma.portfolio.findFirst({
      where: { userId, isDefault: true },
      include: {
        portfolioItems: {
          include: { stock: true },
        },
      },
    });
  } else {
    portfolio = await prisma.portfolio.findFirst({
      where: { userId, name },
      include: {
        portfolioItems: {
          include: { stock: true },
        },
      },
    });
  }

  if (!portfolio) {
    return res.status(404).json({ error: "No such portfolio exists" });
  }

  res.status(200).json({ portfolio });
});

export const getUnifiedPortfolio = CatchAsync(async (req, res, next) => {
  const userId = req.user.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { cashBalance: true }
  });

  // 1) Stocks
  const stockPortfolio = await prisma.portfolio.findFirst({
    where: { userId },
    include: {
      portfolioItems: {
        include: { stock: true }
      }
    }
  });
  const stockHoldings = stockPortfolio ? stockPortfolio.portfolioItems : [];
  
  let stockInvested = 0;
  let stockCurrent = 0;
  stockHoldings.forEach(item => {
    stockInvested += item.avgBuyPrice * item.quantity;
    stockCurrent += (item.stock?.currentPrice || item.avgBuyPrice) * item.quantity;
  });

  // 2) Commodities
  const commodityHoldings = await prisma.commodityPortfolioItem.findMany({
    where: { userId },
    include: { commodity: true }
  });

  let commodityInvested = 0;
  let commodityCurrent = 0;
  commodityHoldings.forEach(item => {
    commodityInvested += item.avgBuyPrice * item.quantity;
    commodityCurrent += (item.commodity?.currentPrice || item.avgBuyPrice) * item.quantity;
  });

  // 3) Mutual Funds
  const mfHoldings = await prisma.mfPortfolioItem.findMany({
    where: { userId },
    include: { fund: true }
  });

  let mfInvested = 0;
  let mfCurrent = 0;
  mfHoldings.forEach(item => {
    mfInvested += item.investedValue;
    mfCurrent += (item.fund?.nav || item.avgNav) * item.units;
  });

  // Summary
  const totalInvested = stockInvested + commodityInvested + mfInvested;
  const totalCurrentValue = stockCurrent + commodityCurrent + mfCurrent;
  const totalReturns = totalCurrentValue - totalInvested;
  const totalPnLPercent = totalInvested > 0 ? (totalReturns / totalInvested) * 100 : 0;

  res.status(200).json({
    status: "success",
    data: {
      cashBalance: user ? user.cashBalance : 0,
      summary: {
        totalInvested,
        totalCurrentValue,
        totalReturns,
        totalPnLPercent
      },
      stocks: {
        invested: stockInvested,
        currentValue: stockCurrent,
        returns: stockCurrent - stockInvested,
        holdings: stockHoldings
      },
      commodities: {
        invested: commodityInvested,
        currentValue: commodityCurrent,
        returns: commodityCurrent - commodityInvested,
        holdings: commodityHoldings
      },
      mutualFunds: {
        invested: mfInvested,
        currentValue: mfCurrent,
        returns: mfCurrent - mfInvested,
        holdings: mfHoldings
      }
    }
  });
});
