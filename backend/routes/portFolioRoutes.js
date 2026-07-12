// routes/portfolioRoutes.js
import express from "express";
import { requireAuth } from "../controllers/authControlller.js";
import {
  getPortfolio,
  getPortfolioByName,
  getUnifiedPortfolio,
} from "../controllers/portfolioController.js";

const router = express.Router();

router.get("/", requireAuth, getPortfolio);
router.get("/unified", requireAuth, getUnifiedPortfolio);
router.get("/:name", requireAuth, getPortfolioByName);
export default router;
