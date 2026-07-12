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
  getAllFunds,
  getMfHoldings,
  placeLumpsum,
  createSip,
  getSips,
  cancelSip,
  redeemMf,
} from "../controllers/mfController.js";

const router = express.Router();

// General browsing (authenticated)
router.get("/", protect, getAllFunds);
router.get("/holdings", protect, getMfHoldings);
router.get("/sips", protect, getSips);

// Trading / creation (authenticated & KYC approved)
router.post("/lumpsum", protect, requireKycApproved, requireMpin, requireWalletBalance, requireTradingHours, requireMarketStatus, placeLumpsum);
router.post("/sip", protect, requireKycApproved, requireMpin, requireWalletBalance, requireTradingHours, requireMarketStatus, createSip);
router.post("/sip/:sipId/cancel", protect, requireKycApproved, requireMpin, cancelSip);
router.post("/redeem", protect, requireKycApproved, requireMpin, requireTradingHours, requireMarketStatus, redeemMf);

export default router;
