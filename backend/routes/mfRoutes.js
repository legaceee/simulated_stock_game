import express from "express";
import { protect, requireKycApproved } from "../middlewares/auth.js";
import {
  getAllFunds,
  getMfHoldings,
  placeLumpsum,
  createSip,
  getSips,
  cancelSip,
} from "../controllers/mfController.js";

const router = express.Router();

// General browsing (authenticated)
router.get("/", protect, getAllFunds);
router.get("/holdings", protect, getMfHoldings);
router.get("/sips", protect, getSips);

// Trading / creation (authenticated & KYC approved)
router.post("/lumpsum", protect, requireKycApproved, placeLumpsum);
router.post("/sip", protect, requireKycApproved, createSip);
router.post("/sip/:sipId/cancel", protect, cancelSip);

export default router;
