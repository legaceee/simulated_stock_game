import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import nodemailer from "nodemailer";
import { z } from "zod";
import prisma from "../config/prismaClient.js";
import { CatchAsync } from "../utils/catchAsync.js";
import AppError from "../utils/appError.js";
import { publisher } from "../utils/redisClient.js";

// Input Validation Schemas
const signupSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters").max(30),
  email: z.string().email("Invalid email format"),
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

const loginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email format"),
});

const resetPasswordSchema = z.object({
  email: z.string().email("Invalid email format"),
  otp: z.string().length(6, "OTP must be exactly 6 digits"),
  newPassword: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),
  confirmPassword: z.string()
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

// Helper: Generate Access and Refresh Tokens
const generateTokens = (userId) => {
  const accessToken = jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: "15m", // Short-lived access token
  });
  
  const refreshToken = crypto.randomBytes(40).toString("hex");
  return { accessToken, refreshToken };
};

// Helper: Setup cookie options
const getCookieOptions = () => {
  const options = {
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    httpOnly: true,
    secure: true,
    sameSite: "none", // support cross-origin cookies in dev
  };
  return options;
};

// Response sender: sets refresh token in cookie and sends access token in JSON
export const sendAuthResponse = async (user, statusCode, req, res) => {
  const { accessToken, refreshToken } = generateTokens(user.id);
  
  // Hash the refresh token before saving to database for protection
  const hashedRefreshToken = crypto.createHash("sha256").update(refreshToken).digest("hex");

  // Create user session in database
  await prisma.session.create({
    data: {
      userId: user.id,
      refreshToken: hashedRefreshToken,
      deviceInfo: req.headers["user-agent"] || "Unknown Device",
      ipAddress: req.ip || req.headers["x-forwarded-for"] || "127.0.0.1",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    },
  });

  // Track security audit log
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "LOGIN_SUCCESS",
      ipAddress: req.ip || req.headers["x-forwarded-for"] || "127.0.0.1",
      details: `User agent: ${req.headers["user-agent"] || "unknown"}`,
    },
  });

  res.cookie("refreshToken", refreshToken, getCookieOptions());

  // Return user info and access token
  res.status(statusCode).json({
    status: "success",
    token: accessToken, // Client stores access token in memory or localStorage
    data: {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        kycStatus: user.kycStatus,
        emailVerified: user.emailVerified,
      },
    },
  });
};

// Middleware wrapper for backward compatibility
export { requireAuth } from "../middlewares/authMiddleware.js";

// SIGNUP
export const signup = CatchAsync(async (req, res, next) => {
  const validatedData = signupSchema.parse(req.body);
  
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [{ username: validatedData.username }, { email: validatedData.email }],
    },
  });
  
  if (existingUser) {
    return next(new AppError("Username or email already taken", 400));
  }

  const hashedPassword = await bcrypt.hash(validatedData.password, 10);

  const user = await prisma.user.create({
    data: {
      username: validatedData.username,
      email: validatedData.email,
      password: hashedPassword,
      role: "USER",
      emailVerified: true, // auto verify for developer sandbox
      cashBalance: 100000.0,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "USER_SIGNUP",
      ipAddress: req.ip || "127.0.0.1",
      details: `Signed up user: ${user.username}`,
    },
  });

  await sendAuthResponse(user, 201, req, res);
});

// LOGIN (with account lock brute force protection)
export const login = CatchAsync(async (req, res, next) => {
  const validatedData = loginSchema.parse(req.body);
  const { email, password } = validatedData;

  const user = await prisma.user.findUnique({ where: { email } });
  
  if (!user) {
    return next(new AppError("Invalid email or password", 401));
  }

  // Check lockout status
  if (user.lockUntil && user.lockUntil > new Date()) {
    const minutesLeft = Math.ceil((user.lockUntil.getTime() - Date.now()) / 60000);
    return next(new AppError(`Account is temporarily locked. Try again in ${minutesLeft} minutes.`, 403));
  }

  const isMatch = await bcrypt.compare(password, user.password);
  
  if (!isMatch) {
    // Increment failed attempts
    const attempts = user.failedLoginAttempts + 1;
    let lockUntil = null;
    
    if (attempts >= 5) {
      lockUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 mins lock
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: attempts,
        lockUntil,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "LOGIN_FAILED",
        ipAddress: req.ip || "127.0.0.1",
        details: `Failed attempt #${attempts}. Account locked: ${attempts >= 5}`,
      },
    });

    if (attempts >= 5) {
      return next(new AppError("Too many failed login attempts. Your account is locked for 15 minutes.", 403));
    }
    
    return next(new AppError("Invalid email or password", 401));
  }

  // Reset login attempt counts on successful login
  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      failedLoginAttempts: 0,
      lockUntil: null,
      // Refill balance if zero for demo
      cashBalance: user.cashBalance <= 0 ? 100000.0 : user.cashBalance,
    },
  });

  await sendAuthResponse(updatedUser, 200, req, res);
});

// REFRESH TOKEN ROTATION
export const refreshToken = CatchAsync(async (req, res, next) => {
  const token = req.cookies.refreshToken;
  if (!token) {
    return next(new AppError("No refresh token provided", 401));
  }

  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

  const session = await prisma.session.findUnique({
    where: { refreshToken: hashedToken },
    include: { user: true },
  });

  // Replay Attack protection: If token is not found, maybe someone is reusing a stolen one.
  // In a robust system, we would log this and potentially revoke all sessions for the user.
  if (!session) {
    return next(new AppError("Session expired or invalid token.", 401));
  }

  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { id: session.id } });
    return next(new AppError("Refresh token expired. Please log in again.", 401));
  }

  // Rotate tokens: Delete old session and create a new one
  await prisma.session.delete({ where: { id: session.id } });

  const { accessToken, refreshToken: newRefreshToken } = generateTokens(session.userId);
  const newHashedToken = crypto.createHash("sha256").update(newRefreshToken).digest("hex");

  await prisma.session.create({
    data: {
      userId: session.userId,
      refreshToken: newHashedToken,
      deviceInfo: req.headers["user-agent"] || "Unknown Device",
      ipAddress: req.ip || "127.0.0.1",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  res.cookie("refreshToken", newRefreshToken, getCookieOptions());

  res.status(200).json({
    status: "success",
    token: accessToken,
  });
});

// LOGOUT (Token Blacklisting & Session Deletion)
export const logout = CatchAsync(async (req, res, next) => {
  const token = req.cookies.refreshToken;
  
  if (token) {
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    // Delete session from DB
    await prisma.session.deleteMany({
      where: { refreshToken: hashedToken },
    });
  }

  // Blacklist the access token in Redis if provided
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer")) {
    const accessToken = authHeader.split(" ")[1];
    const decoded = jwt.decode(accessToken);
    if (decoded && decoded.exp) {
      const ttl = decoded.exp - Math.floor(Date.now() / 1000);
      if (ttl > 0) {
        await publisher.setex(`blacklist:${accessToken}`, ttl, "true");
      }
    }
  }

  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: true,
    sameSite: "none",
  });

  res.status(200).json({
    status: "success",
    message: "Logged out successfully",
  });
});

// FORGOT PASSWORD
export const forgotPassword = CatchAsync(async (req, res, next) => {
  const { email } = forgotPasswordSchema.parse(req.body);

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return next(new AppError("No user found with that email address", 404));
  }

  // Create a 6-digit verification code
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");
  const expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 mins expiry

  await prisma.emailVerification.upsert({
    where: { email },
    update: { otpCode: hashedOtp, expiresAt: expiry },
    create: { email, otpCode: hashedOtp, expiresAt: expiry },
  });

  console.log(`[SECURITY OTP-DEBUG] Password Reset OTP for ${email} is: ${otp}`);

  // Send mail
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  });

  try {
    await transporter.sendMail({
      from: `"INVESTnoww Support" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Reset your trading account password",
      text: `Your password reset OTP is ${otp}. It will expire in 10 minutes.`,
    });
  } catch (err) {
    console.log("Transporter failed to send forgot-password email:", err.message);
  }

  res.status(200).json({
    status: "success",
    message: "OTP code sent to email",
  });
});

// RESET PASSWORD
export const resetPassword = CatchAsync(async (req, res, next) => {
  const validatedData = resetPasswordSchema.parse(req.body);
  const { email, otp, newPassword } = validatedData;

  const record = await prisma.emailVerification.findUnique({ where: { email } });
  if (!record) {
    return next(new AppError("No OTP verification code requested for this email.", 400));
  }

  if (record.expiresAt < new Date()) {
    await prisma.emailVerification.delete({ where: { email } });
    return next(new AppError("OTP verification code has expired.", 400));
  }

  const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");
  if (hashedOtp !== record.otpCode && otp !== "123456") { // keep developer bypass
    return next(new AppError("Invalid OTP verification code.", 400));
  }

  // Update password
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { email },
    data: {
      password: hashedPassword,
      passwordChangedAt: new Date(),
      failedLoginAttempts: 0,
      lockUntil: null,
    },
  });

  // Cleanup verification code
  await prisma.emailVerification.delete({ where: { email } });

  res.status(200).json({
    status: "success",
    message: "Password reset successfully. You can now log in.",
  });
});

// UPDATE PASSWORD (authenticated)
export const updatePassword = CatchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return next(new AppError("Provide current and new password", 400));
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  const isMatch = await bcrypt.compare(currentPassword, user.password);
  
  if (!isMatch) {
    return next(new AppError("Your current password is incorrect.", 401));
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      password: hashedPassword,
      passwordChangedAt: new Date(),
    },
  });

  await prisma.auditLog.create({
    data: {
      userId,
      action: "PASSWORD_CHANGE",
      ipAddress: req.ip || "127.0.0.1",
      details: "Changed account password from settings",
    },
  });

  await sendAuthResponse(updatedUser, 200, req, res);
});

// SEND OTP & VERIFY OTP (General Email Verification)
export const sendOtp = CatchAsync(async (req, res) => {
  const { email } = req.body;
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");
  const expiry = new Date(Date.now() + 10 * 60 * 1000);

  await prisma.emailVerification.upsert({
    where: { email },
    update: { otpCode: hashedOtp, expiresAt: expiry },
    create: { email, otpCode: hashedOtp, expiresAt: expiry },
  });

  console.log(`[OTP-DEBUG] Generated general OTP for ${email} is: ${otp}`);

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  });

  try {
    await transporter.sendMail({
      from: `"INVESTnoww" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Verify your email address",
      text: `Your OTP is ${otp}. It will expire in 10 minutes.`,
    });
  } catch (err) {
    console.log("Transporter failed to send email verification OTP:", err.message);
  }

  res.status(200).json({ message: "OTP sent to email" });
});

export const verifyOtp = CatchAsync(async (req, res, next) => {
  const { email, otp } = req.body;

  if (otp === "123456") { // developer bypass
    try {
      await prisma.emailVerification.delete({ where: { email } });
    } catch (e) {}
    
    // Mark email verified in user if exists
    await prisma.user.updateMany({
      where: { email },
      data: { emailVerified: true }
    });
    
    return res.status(200).json({ message: "Email verified successfully" });
  }

  const record = await prisma.emailVerification.findUnique({ where: { email } });
  if (!record) return res.status(400).json({ error: "No OTP found" });
  if (record.expiresAt < new Date()) return res.status(400).json({ error: "OTP expired" });

  const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");
  if (hashedOtp === record.otpCode) {
    await prisma.emailVerification.delete({ where: { email } });
    
    await prisma.user.updateMany({
      where: { email },
      data: { emailVerified: true }
    });

    return res.status(200).json({ message: "Email verified successfully" });
  }

  return res.status(400).json({ error: "Invalid OTP" });
});
