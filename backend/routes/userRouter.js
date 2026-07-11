// routes/userRoutes.js

import express from "express";
import {
  deleteMyAccount,
  getAllUsers,
  getUser,
  updateProfile,
  getLeaderboard,
  setMpin,
  hasMpin,
} from "../controllers/userController.js";
import {
  signup,
  login,
  requireAuth,
  updatePassword,
  sendOtp,
  verifyOtp,
} from "../controllers/authControlller.js";

import { getPortfolio } from "../controllers/portfolioController.js";
import { requireAdmin } from "../controllers/adminController.js";
import { watchList } from "../controllers/watchlistController.js";

const router = express.Router();

router.post("/send-otp", sendOtp);
router.post("/verify-otp", verifyOtp);
router.post("/register", signup);
router.post("/login", login);
router.delete("/deleteMe", requireAuth, deleteMyAccount);

router.post("/watchlist", requireAuth, watchList);
router.patch("/updatePassword", requireAuth, updatePassword);
router.patch("/updateME", requireAuth, updateProfile);
router.get("/getMe", requireAuth, getUser);
router.get("/getAllUsers", getAllUsers);

router.get("/leaderboard", requireAuth, getLeaderboard);
router.post("/set-mpin", requireAuth, setMpin);
router.get("/has-mpin", requireAuth, hasMpin);

export default router;
