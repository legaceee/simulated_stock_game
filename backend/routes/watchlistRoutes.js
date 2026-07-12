import express from "express";
import { protect } from "../middlewares/auth.js";
import {
  getWatchlists,
  createWatchlist,
  renameWatchlist,
  deleteWatchlist,
  addWatchlistItem,
  removeWatchlistItem,
  updateItemsOrder,
} from "../controllers/watchlistController.js";

const router = express.Router();

router.use(protect);

router.get("/", getWatchlists);
router.post("/", createWatchlist);
router.patch("/:id", renameWatchlist);
router.delete("/:id", deleteWatchlist);
router.post("/item", addWatchlistItem);
router.delete("/item/:itemId", removeWatchlistItem);
router.post("/reorder", updateItemsOrder);

export default router;
