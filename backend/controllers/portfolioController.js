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
