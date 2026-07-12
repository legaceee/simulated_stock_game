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

// 1. Get all Mutual Funds
export const getAllFunds = CatchAsync(async (req, res, next) => {
  const funds = await prisma.mutualFund.findMany({
    orderBy: { name: "asc" }
  });

  res.status(200).json({
    status: "success",
    results: funds.length,
    data: { funds }
  });
});

// 2. Get user's Mutual Fund holdings and calculated returns
export const getMfHoldings = CatchAsync(async (req, res, next) => {
  const userId = req.user.id;

  const holdings = await prisma.mfPortfolioItem.findMany({
    where: { userId },
    include: { fund: true }
  });

  let totalInvested = 0;
  let totalCurrentValue = 0;

  const items = holdings.map((h) => {
    const currentPrice = h.fund.nav;
    const currentVal = h.units * currentPrice;
    const investedVal = h.investedValue;
    const returns = currentVal - investedVal;
    const returnsPercentage = investedVal > 0 ? (returns / investedVal) * 100 : 0;

    totalInvested += investedVal;
    totalCurrentValue += currentVal;

    return {
      id: h.id,
      fundId: h.fundId,
      symbol: h.fund.symbol,
      name: h.fund.name,
      category: h.fund.category,
      units: h.units,
      avgNav: h.avgNav,
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

// 3. Buy Mutual Fund (Lumpsum)
export const placeLumpsum = CatchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const { fundId, amount, mpin } = req.body;

  const investAmount = parseFloat(amount);
  if (isNaN(investAmount) || investAmount <= 0) {
    return next(new AppError("Please provide a valid investment amount.", 400));
  }

  // Enforce MPIN
  try {
    await checkUserMpin(userId, mpin);
  } catch (err) {
    return next(new AppError(err.message, 401));
  }

  const fund = await prisma.mutualFund.findUnique({ where: { id: fundId } });
  if (!fund) {
    return next(new AppError("Mutual fund not found.", 404));
  }

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (user.cashBalance < investAmount) {
      throw new Error("Insufficient funds in your account wallet.");
    }

    // 1) Deduct balance
    await tx.user.update({
      where: { id: userId },
      data: { cashBalance: { decrement: investAmount } }
    });

    // 2) Calculate units bought (based on NAV)
    const unitsBought = investAmount / fund.nav;

    // 3) Upsert holding
    let holding = await tx.mfPortfolioItem.findFirst({
      where: { userId, fundId }
    });

    if (holding) {
      const newUnits = holding.units + unitsBought;
      const newInvestedValue = holding.investedValue + investAmount;
      const newAvgNav = newInvestedValue / newUnits;

      holding = await tx.mfPortfolioItem.update({
        where: { id: holding.id },
        data: {
          units: newUnits,
          investedValue: newInvestedValue,
          avgNav: newAvgNav
        }
      });
    } else {
      holding = await tx.mfPortfolioItem.create({
        data: {
          userId,
          fundId,
          units: unitsBought,
          avgNav: fund.nav,
          investedValue: investAmount
        }
      });
    }

    // 4) Record transaction
    await tx.transaction.create({
      data: {
        userId,
        type: "BUY",
        amount: investAmount,
        price: fund.nav,
        quantity: Math.round(unitsBought * 1000) / 1000, // round to 3 decimals
        totalValue: investAmount,
        // Since transaction holds stockId, we can add mutualFund/commodity tags in details if needed
      }
    });

    // 5) Record audit log
    await tx.auditLog.create({
      data: {
        userId,
        action: "MF_LUMPSUM_SUCCESS",
        ipAddress: req.ip || "127.0.0.1",
        details: `Purchased ${unitsBought.toFixed(4)} units of ${fund.symbol} for ₹${investAmount}`,
      }
    });

    return holding;
  });

  res.status(200).json({
    status: "success",
    message: `Lumpsum investment of ₹${investAmount} in ${fund.name} was successful!`,
    data: result
  });
});

// 4. Create Mutual Fund SIP
export const createSip = CatchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const { fundId, amount, frequency, mpin } = req.body; // DAILY, WEEKLY, MONTHLY

  const sipAmount = parseFloat(amount);
  if (isNaN(sipAmount) || sipAmount <= 0) {
    return next(new AppError("Please provide a valid SIP amount.", 400));
  }

  if (!["DAILY", "WEEKLY", "MONTHLY"].includes(frequency)) {
    return next(new AppError("Invalid frequency. Must be DAILY, WEEKLY, or MONTHLY.", 400));
  }

  // Enforce MPIN
  try {
    await checkUserMpin(userId, mpin);
  } catch (err) {
    return next(new AppError(err.message, 401));
  }

  const fund = await prisma.mutualFund.findUnique({ where: { id: fundId } });
  if (!fund) {
    return next(new AppError("Mutual fund not found.", 404));
  }

  // Calculate next date based on frequency
  let nextDate = new Date();
  if (frequency === "DAILY") {
    nextDate.setDate(nextDate.getDate() + 1);
  } else if (frequency === "WEEKLY") {
    nextDate.setDate(nextDate.getDate() + 7);
  } else {
    nextDate.setMonth(nextDate.getMonth() + 1);
  }

  const sip = await prisma.sipItem.create({
    data: {
      userId,
      fundId,
      amount: sipAmount,
      frequency,
      nextDate,
      status: "ACTIVE"
    },
    include: { fund: true }
  });

  await prisma.auditLog.create({
    data: {
      userId,
      action: "MF_SIP_CREATED",
      ipAddress: req.ip || "127.0.0.1",
      details: `Created ${frequency} SIP of ₹${sipAmount} in ${fund.symbol}`,
    }
  });

  res.status(201).json({
    status: "success",
    message: `SIP plan of ₹${sipAmount} ${frequency.toLowerCase()} in ${fund.name} created successfully!`,
    data: sip
  });
});

// 5. Get User's Active SIPs
export const getSips = CatchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const sips = await prisma.sipItem.findMany({
    where: { userId },
    include: { fund: true },
    orderBy: { createdAt: "desc" }
  });

  res.status(200).json({
    status: "success",
    results: sips.length,
    data: { sips }
  });
});

// 6. Cancel Active SIP
export const cancelSip = CatchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const { sipId } = req.params;

  const sip = await prisma.sipItem.findFirst({
    where: { id: sipId, userId }
  });

  if (!sip) {
    return next(new AppError("Active SIP plan not found.", 404));
  }

  await prisma.sipItem.update({
    where: { id: sipId },
    data: { status: "CANCELLED" }
  });

  await prisma.auditLog.create({
    data: {
      userId,
      action: "MF_SIP_CANCELLED",
      ipAddress: req.ip || "127.0.0.1",
      details: `Cancelled SIP id ${sipId}`,
    }
  });

  res.status(200).json({
    status: "success",
    message: "SIP plan cancelled successfully."
  });
});
