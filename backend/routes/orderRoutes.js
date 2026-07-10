import express from "express";
import {
  getAllStocks,
  getStockBySymbol,
  searchStocks,
} from "../controllers/stockController.js";
import { requireAuth } from "../controllers/authControlller.js";
import { buyStock, sellStock } from "../controllers/stockController.js";
import { placeOrder } from "../controllers/orderController.js";
const router = express.Router();

router.get("/", getAllStocks);

router.get("/:search", searchStocks);
router.get("/sym/:symbol", getStockBySymbol);
router.post("/buy/:symbol", requireAuth, buyStock);
router.post("/sell/:symbol", requireAuth, sellStock);
export default router;
