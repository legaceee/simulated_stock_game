import express from "express";
import {
  protect,
  requireKycApproved,
  requireMpin,
  requireWalletBalance,
  requireTradingHours,
  requireMarketStatus
} from "../middlewares/auth.js";
import {
  getAllCommodities,
  getCommodityHoldings,
  buyCommodity,
  sellCommodity,
} from "../controllers/commodityController.js";

const router = express.Router();

// General browsing (authenticated)
router.get("/", protect, getAllCommodities);
router.get("/holdings", protect, getCommodityHoldings);

// Trading / execution (authenticated & KYC approved)
router.post("/buy", protect, requireKycApproved, requireMpin, requireWalletBalance, requireTradingHours, requireMarketStatus, buyCommodity);
router.post("/sell", protect, requireKycApproved, requireMpin, requireTradingHours, requireMarketStatus, sellCommodity);

export default router;
