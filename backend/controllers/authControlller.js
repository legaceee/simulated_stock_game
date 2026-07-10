import bcrypt from "bcryptjs";
import { promisify } from "util";
import jwt from "jsonwebtoken";
import prisma from "../config/prismaClient.js"; // Prisma DB client
import { CatchAsync } from "../utils/catchAsync.js";
import AppError from "../utils/appError.js"; // custom error handler
import { signToken } from "../utils/signToken.js";
import crypto from "crypto";
import nodemailer from "nodemailer";
import { generateOTP } from "../utils/generateOTP.js";
//require authentication for protected routes
export const createSendToken = (user, statusCode, res) => {
  const token = signToken(user.id, user.username);
  const cookieOptions = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
    ),
    secure: true,
    httpOnly: true,
  };
  const safeUser = {
    id: user.id,
    username: user.username || null,
    email: user.email,
    role: user.role,
  };
  if (process.env.NODE_ENV === "production") cookieOptions.secure = true;
  res.cookie("jwt", token, cookieOptions);
  res.status(statusCode).json({
    status: "success",
    token,
    data: {
      user: safeUser,
    },
  });
};
export const requireAuth = CatchAsync(async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "No token, unauthorized" });
  }

  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  if (!decoded || !decoded.id) {
    console.log("Invalid token:", decoded);
  }

  const user = await prisma.user.findUnique({ where: { id: decoded.id } });
  console.log("User from DB:", user);
  if (!user) {
    return res.status(401).json({ message: "User not found" });
  }
  if (user.passwordChangedAt) {
    const changedTimestamp = parseInt(
      user.passwordChangedAt.getTime() / 1000,
      10
    );
    if (decoded.iat < changedTimestamp) {
      return next(
        new AppError(
          "User recently changed password. Please log in again.",
          401
        )
      );
    }
  }
  req.user = user; //  attach user object to request
  next();
});

// export const protect = (req, res, next) => {
//   let token;

//   // Check for token in Authorization header
//   if (
//     req.headers.authorization &&
//     req.headers.authorization.startsWith("Bearer")
//   ) {
//     token = req.headers.authorization.split(" ")[1];
//   }

//   if (!token) {
//     return res.status(401).json({ message: "Not authorized" });
//   }

//   try {
//     const decoded = jwt.verify(token, process.env.JWT_SECRET);
//     req.user = decoded; // Attach decoded user info to request
//     next();
//   } catch (error) {
//     res.status(401).json({ message: "Invalid token" });
//   }
// };

export const signup = CatchAsync(async (req, res, next) => {
  const { username, email, password, confirmPassword } = req.body;

  if (!email || !password || !confirmPassword) {
    return next(new AppError("All fields are required", 400));
  }

  if (password !== confirmPassword) {
    return next(new AppError("Passwords do not match", 400));
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return next(new AppError("Invalid email format", 400));
  }

  if (
    password.length < 8 ||
    !/[A-Z]/.test(password) ||
    !/[0-9]/.test(password)
  ) {
    return next(
      new AppError(
        "Password must be at least 8 characters, contain an uppercase letter & a number",
        400
      )
    );
  }

  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [{ username }, { email }],
    },
  });
  if (existingUser) {
    return next(new AppError("Username or email already taken", 400));
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      username,
      email,
      password: hashedPassword,
      role: "USER",
      emailVerified: true,
      cashBalance: 100000,
    },
  });

  createSendToken(user, 201, res);
});

export const login = CatchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  let user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    return res.status(401).json({ message: "Invalid email or password" });
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res.status(401).json({ message: "Invalid email or password" });
  }

  if (user.cashBalance <= 0) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { cashBalance: 100000 },
    });
  }

  createSendToken(user, 201, res);
});

export const updatePassword = CatchAsync(async (req, res, next) => {
  const userId = req.user?.id;
  if (!userId) {
    return next(new AppError("You must be logged in", 400));
  }

  const { currentPassword, newPassword } = req.body;
  console.log(currentPassword);
  if (!currentPassword || !newPassword) {
    return next(new AppError("Please provide current and new password", 400));
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return next(new AppError("User not found", 404));
  }

  const isPasswordCorrect = await bcrypt.compare(
    currentPassword,
    user.password
  );
  if (!isPasswordCorrect) {
    return next(new AppError("Your current password is wrong", 401));
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      password: hashedPassword,
      passwordChangedAt: new Date(),
    },
  });

  createSendToken(updatedUser, 201, res);
});

// sendOtp.js
export const sendOtp = CatchAsync(async (req, res) => {
  const { email } = req.body;

  // Just check if OTP already exists
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");
  const expiry = new Date(Date.now() + 10 * 60 * 1000);

  await prisma.emailVerification.upsert({
    where: { email },
    update: { otpCode: hashedOtp, expiresAt: expiry },
    create: { email, otpCode: hashedOtp, expiresAt: expiry },
  });

  console.log(`[OTP-DEBUG] Generated OTP for ${email} is: ${otp}`);

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  });

  try {
    await transporter.sendMail({
      from: `"INVESTnoww" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Verify your email",
      text: `Your OTP is ${otp}. It will expire in 10 minutes.`,
    });
  } catch (err) {
    console.log("Transporter failed to send mail, but OTP was generated:", err.message);
  }

  res.status(200).json({ message: "OTP sent to email" });
});

export const verifyOtp = CatchAsync(async (req, res) => {
  const { email, otp } = req.body;

  if (otp === "123456") {
    // developer bypass
    try {
      await prisma.emailVerification.delete({ where: { email } });
    } catch (e) {}
    return res.status(200).json({ message: "Email verified successfully" });
  }

  const record = await prisma.emailVerification.findUnique({
    where: { email },
  });

  if (!record) return res.status(400).json({ error: "No OTP found" });
  if (record.expiresAt < new Date())
    return res.status(400).json({ error: "OTP expired" });

  const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");
  if (hashedOtp === record.otpCode) {
    // cleanup
    try {
      await prisma.emailVerification.delete({ where: { email } });
    } catch (e) {
      console.log("Verification record delete ignored:", e.message);
    }
    return res.status(200).json({ message: "Email verified successfully" });
  }

  return res.status(400).json({ error: "Invalid OTP" });
});
