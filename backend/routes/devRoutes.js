import express from "express";
import {
  requireDevSecret,
  verifyDevSecret,
  getSystemStats,
  triggerSeed,
  resetDemoData,
  toggleSimulation,
} from "../controllers/devController.js";

const router = express.Router();

router.post("/verify", requireDevSecret, verifyDevSecret);
router.get("/stats", requireDevSecret, getSystemStats);
router.post("/seed", requireDevSecret, triggerSeed);
router.post("/reset-data", requireDevSecret, resetDemoData);
router.post("/toggle-sim", requireDevSecret, toggleSimulation);

export default router;
