import express from "express";
import { protect } from "../middlewares/auth.js";
import {
  createAlert,
  getMyAlerts,
  cancelAlert,
} from "../controllers/alertController.js";

const router = express.Router();

router.use(protect);

router.post("/", createAlert);
router.get("/", getMyAlerts);
router.delete("/:alertId", cancelAlert);

export default router;
