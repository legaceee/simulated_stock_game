import express from "express";
import {
  getAllStocks,
  getStockBySymbol,
  searchStocks,
} from "../controllers/stockController.js";
import {
  protect,
  requireKycApproved,
  requireMpin,
  requireWalletBalance,
  requireTradingHours,
  requireMarketStatus
} from "../middlewares/auth.js";
import { buyStock, sellStock } from "../controllers/stockController.js";
import { placeOrder, getMyOrders, cancelOrder } from "../controllers/orderController.js";
const router = express.Router();

router.get("/", getAllStocks);

router.get("/:search", searchStocks);
router.get("/sym/:symbol", getStockBySymbol);

router.post("/buy/:symbol", protect, requireKycApproved, requireMpin, requireWalletBalance, requireTradingHours, requireMarketStatus, buyStock);
router.post("/sell/:symbol", protect, requireKycApproved, requireMpin, requireTradingHours, requireMarketStatus, sellStock);

// Advanced Orders
router.post("/order/place", protect, requireKycApproved, requireMpin, requireWalletBalance, requireTradingHours, requireMarketStatus, placeOrder);
router.get("/order/my", protect, getMyOrders);
router.post("/order/:orderId/cancel", protect, requireKycApproved, requireMpin, cancelOrder);

export default router;
