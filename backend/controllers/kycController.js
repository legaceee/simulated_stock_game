import prisma from "../config/prismaClient.js";
import AppError from "../utils/appError.js";
import { CatchAsync } from "../utils/catchAsync.js";

// Submit KYC details
export const uploadKyc = CatchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const { pan, aadhaar, address, selfieUrl, signatureUrl, autoApprove } = req.body;

  if (!pan || !aadhaar || !address) {
    return next(new AppError("PAN, Aadhaar, and Address details are required for KYC.", 400));
  }

  // Demo auto approval check or custom request parameter
  const shouldApprove = autoApprove === true || autoApprove === "true" || process.env.AUTO_APPROVE_KYC === "true" || true;
  const kycStatus = shouldApprove ? "APPROVED" : "PENDING";

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      pan,
      aadhaar,
      address,
      selfieUrl: selfieUrl || null,
      signatureUrl: signatureUrl || null,
      kycStatus,
      kycDocument: selfieUrl || "submitted",
    },
    select: {
      id: true,
      username: true,
      email: true,
      kycStatus: true,
      pan: true,
      aadhaar: true,
      address: true,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId,
      action: shouldApprove ? "KYC_AUTO_APPROVED" : "KYC_SUBMITTED",
      ipAddress: req.ip || "127.0.0.1",
      details: `Submitted KYC. Status set to ${kycStatus}.`,
    },
  });

  res.status(200).json({
    status: "success",
    message: shouldApprove ? "KYC automatically approved!" : "KYC documents submitted successfully. Pending review.",
    data: {
      user: updatedUser,
    },
  });
});

// Admin Review KYC
export const reviewKyc = CatchAsync(async (req, res, next) => {
  const { userId } = req.params;
  const { decision } = req.body; // "APPROVED" | "REJECTED"

  if (!["APPROVED", "REJECTED"].includes(decision)) {
    return next(new AppError("Invalid KYC review decision. Must be APPROVED or REJECTED.", 400));
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { kycStatus: decision },
    select: { id: true, username: true, email: true, kycStatus: true },
  });

  await prisma.auditLog.create({
    data: {
      userId,
      action: `KYC_REVIEW_${decision}`,
      ipAddress: req.ip || "127.0.0.1",
      details: `Admin reviewed user KYC: status set to ${decision}`,
    },
  });

  res.status(200).json({
    status: "success",
    message: `KYC status has been updated to ${decision}`,
    data: {
      user: updatedUser,
    },
  });
});

// Get My KYC Status
export const getMyKyc = CatchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      kycStatus: true,
      pan: true,
      aadhaar: true,
      address: true,
      selfieUrl: true,
      signatureUrl: true,
      mpin: true,
    },
  });

  if (!user) {
    return next(new AppError("User not found", 404));
  }

  res.status(200).json({
    status: "success",
    data: {
      kycStatus: user.kycStatus,
      pan: user.pan,
      aadhaar: user.aadhaar,
      address: user.address,
      selfieUrl: user.selfieUrl,
      signatureUrl: user.signatureUrl,
      hasMpin: !!user.mpin,
    },
  });
});
