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
  forgotMpin,
  resetMpinWithOtp,
} from "../controllers/userController.js";
import {
  signup,
  login,
  requireAuth,
  updatePassword,
  sendOtp,
  verifyOtp,
  refreshToken,
  logout,
  forgotPassword,
  resetPassword,
} from "../controllers/authControlller.js";

import { getPortfolio } from "../controllers/portfolioController.js";
import { requireAdmin } from "../controllers/adminController.js";
import { watchList } from "../controllers/watchlistController.js";

const router = express.Router();

router.post("/send-otp", sendOtp);
router.post("/verify-otp", verifyOtp);
router.post("/register", signup);
router.post("/login", login);
router.post("/refresh-token", refreshToken);
router.post("/logout", logout);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.delete("/deleteMe", requireAuth, deleteMyAccount);

router.post("/watchlist", requireAuth, watchList);
router.patch("/updatePassword", requireAuth, updatePassword);
router.patch("/updateME", requireAuth, updateProfile);
router.get("/getMe", requireAuth, getUser);
router.get("/getAllUsers", getAllUsers);

router.get("/leaderboard", requireAuth, getLeaderboard);
router.post("/set-mpin", requireAuth, setMpin);
router.get("/has-mpin", requireAuth, hasMpin);
router.post("/forgot-mpin", requireAuth, forgotMpin);
router.post("/reset-mpin", requireAuth, resetMpinWithOtp);

export default router;
