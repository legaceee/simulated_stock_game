import express from "express";
import { protect, requireKycApproved } from "../middlewares/auth.js";
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
router.post("/buy", protect, requireKycApproved, buyCommodity);
router.post("/sell", protect, requireKycApproved, sellCommodity);

export default router;
