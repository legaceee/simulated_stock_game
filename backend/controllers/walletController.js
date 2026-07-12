import prisma from "../config/prismaClient.js";

export const addCash = async (req, res) => {
  try {
    const { amount } = req.body;
    const userId = req.user.id;

    if (!amount || amount <= 0)
      return res.status(400).json({ message: "Invalid amount" });

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: userId },
        data: { cashBalance: { increment: amount } },
        select: { id: true, cashBalance: true },
      });

      await tx.transaction.create({
        data: {
          userId,
          type: "DEPOSIT",
          amount,
          totalValue: amount,
          assetType: "WALLET",
          symbol: "WALLET",
          status: "COMPLETED",
          description: "Deposit Funds via NetBanking"
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: "WALLET_DEPOSIT_SUCCESS",
          ipAddress: req.ip || "127.0.0.1",
          details: `Deposited ₹${amount.toFixed(2)} into wallet.`
        }
      });

      return user;
    });

    res.json({ message: "Cash added", wallet: result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

export const withdrawCash = async (req, res) => {
  try {
    const { amount } = req.body;
    const userId = req.user.id;
    if (!amount || amount <= 0)
      return res.status(400).json({ message: "Invalid amount" });

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (user.cashBalance < amount) throw new Error("Insufficient balance");

      const updated = await tx.user.update({
        where: { id: userId },
        data: { cashBalance: { decrement: amount } },
        select: { id: true, cashBalance: true },
      });

      await tx.transaction.create({
        data: {
          userId,
          type: "WITHDRAW",
          amount,
          totalValue: amount,
          assetType: "WALLET",
          symbol: "WALLET",
          status: "COMPLETED",
          description: "Withdraw Funds to Bank"
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: "WALLET_WITHDRAW_SUCCESS",
          ipAddress: req.ip || "127.0.0.1",
          details: `Withdrew ₹${amount.toFixed(2)} from wallet.`
        }
      });

      return updated;
    });

    res.json({ message: "Cash withdrawn", wallet: result });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};
