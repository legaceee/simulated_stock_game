import express from "express";
import { protect, requireKycApproved, requireMpin } from "../middlewares/auth.js";
import { addCash, withdrawCash } from "../controllers/walletController.js";
const router = express.Router();

router.post("/deposit", protect, requireKycApproved, requireMpin, addCash);
router.post("/withdraw", protect, requireKycApproved, requireMpin, withdrawCash);

export default router;
