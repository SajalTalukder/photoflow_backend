import jwt from "jsonwebtoken";
import catchAsync from "../utils/catchAsync.js";
import AppError from "../utils/appError.js";
import generateOTP from "../utils/generateOTP.js";

import User from "../models/userModel.js";
import fs from "fs";
import path from "path";
import hbs from "hbs";
import { fileURLToPath } from "url";
import { sendEmail } from "../utils/email.js";

// Fix __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to load email template
const loadTemplate = (templateName, replacements) => {
  const templatePath = path.join(__dirname, "../emailTemplate", templateName);
  const source = fs.readFileSync(templatePath, "utf-8");
  const template = hbs.compile(source);
  return template(replacements);
};

// JWT helpers
const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });

const createSendToken = (user, statusCode, res, message) => {
  const token = signToken(user._id);
  const cookieOptions = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000,
    ),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "Lax",
    path: "/",
  };

  res.cookie("token", token, cookieOptions);
  user.password = undefined;
  user.otp = undefined;

  res.status(statusCode).json({
    status: "success",
    message,
    token,
    data: { user },
  });
};

// SIGNUP
export const signup = catchAsync(async (req, res, next) => {
  const { email, password, passwordConfirm, username } = req.body;
  const existingUser = await User.findOne({ email });
  if (existingUser) return next(new AppError("Email already registered", 400));

  const otp = generateOTP();
  const otpExpires = Date.now() + 24 * 60 * 60 * 1000;

  const newUser = await User.create({
    username,
    email,
    password,
    passwordConfirm,
    otp,
    otpExpires,
  });

  const htmlTemplate = loadTemplate("otpTemplate.hbs", {
    title: "Otp Verification",
    username: newUser.username,
    otp,
    message: "Your one-time password (OTP) for account verification is:",
  });

  try {
    await sendEmail({
      email: newUser.email,
      subject: "OTP for Email Verification",
      html: htmlTemplate,
    });
    createSendToken(
      newUser,
      200,
      res,
      "Registration successful. Check your email for OTP verification.",
    );
  } catch (error) {
    await User.findByIdAndDelete(newUser.id);
    return next(
      new AppError("There was an error creating the account. Try again later!"),
      500,
    );
  }
});

// VERIFY ACCOUNT
export const verifyAccount = catchAsync(async (req, res, next) => {
  const { otp } = req.body;
  if (!otp) return next(new AppError("OTP is required for verification", 400));

  const user = req.user;
  if (user.otp !== otp) return next(new AppError("Invalid OTP", 400));
  if (Date.now() > user.otpExpires)
    return next(
      new AppError("OTP has expired. Please request a new OTP.", 400),
    );

  user.isVerified = true;
  user.otp = undefined;
  user.otpExpires = undefined;
  await user.save({ validateBeforeSave: false });

  createSendToken(user, 200, res, "Email has been verified.");
});

// RESEND OTP
export const resendOTP = catchAsync(async (req, res, next) => {
  const { email } = req.user;
  if (!email) return next(new AppError("Email is required to resend OTP", 400));

  const user = await User.findOne({ email });
  if (!user) return next(new AppError("User not found", 404));
  if (user.isVerified)
    return next(new AppError("This account is already verified", 400));

  const newOtp = generateOTP();
  user.otp = newOtp;
  user.otpExpires = Date.now() + 24 * 60 * 60 * 1000;
  await user.save({ validateBeforeSave: false });

  const htmlTemplate = loadTemplate("otpTemplate.hbs", {
    title: "Otp Verification",
    username: user.username,
    otp: newOtp,
    message: "Your one-time password (OTP) for account verification is:",
  });

  try {
    await sendEmail({
      email: user.email,
      subject: "Resend OTP for Email Verification",
      html: htmlTemplate,
    });
    res.status(200).json({
      status: "success",
      message: "A new OTP has been sent to your email.",
    });
  } catch (error) {
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save({ validateBeforeSave: false });
    return next(
      new AppError(
        "There was an error sending the email. Try again later!",
        500,
      ),
    );
  }
});

// LOGIN
export const login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;
  if (!email || !password)
    return next(new AppError("Please Provide your email and password", 400));

  const user = await User.findOne({ email }).select("+password");
  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(new AppError("Incorrect email or password", 401));
  }

  createSendToken(user, 200, res, "Login Successful");
});

// LOGOUT
export const logout = catchAsync(async (req, res, next) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "Lax",
    path: "/",
  });

  res
    .status(200)
    .json({ status: "success", message: "Logged out successfully." });
});

// FORGET PASSWORD
export const forgetPassword = catchAsync(async (req, res, next) => {
  const { email } = req.body;
  const user = await User.findOne({ email });
  if (!user) return next(new AppError("No User Found", 404));

  const otp = generateOTP();
  user.resetPasswordOTP = otp;
  user.resetPasswordOTPExpires = Date.now() + 5 * 60 * 1000; // 5 min
  await user.save({ validateBeforeSave: false });

  const htmlTemplate = loadTemplate("otpTemplate.hbs", {
    title: "Reset Password OTP",
    username: user.username,
    otp,
    message: "Your password reset otp is ",
  });

  try {
    await sendEmail({
      email: user.email,
      subject: "Your Password Reset OTP (Valid for 5min)",
      html: htmlTemplate,
    });
    res.status(200).json({
      status: "success",
      message: "Password Reset OTP sent to your email",
    });
  } catch (err) {
    user.resetPasswordOTP = undefined;
    user.resetPasswordOTPExpires = undefined;
    await user.save({ validateBeforeSave: false });
    return res.status(500).json({
      status: "error",
      message: "There was an error sending the email. Try again later!",
      data: { err },
    });
  }
});

// RESET PASSWORD
export const resetPassword = catchAsync(async (req, res, next) => {
  const { email, otp, password, passwordConfirm } = req.body;

  const user = await User.findOne({
    email,
    resetPasswordOTP: otp,
    resetPasswordOTPExpires: { $gt: Date.now() },
  });

  if (!user) return next(new AppError("No User Found!", 400));

  user.password = password;
  user.passwordConfirm = passwordConfirm;
  user.resetPasswordOTP = undefined;
  user.resetPasswordOTPExpires = undefined;
  await user.save();

  createSendToken(user, 200, res, "Password Reset Successful");
});

// CHANGE PASSWORD (Authenticated user)
export const changePassword = catchAsync(async (req, res, next) => {
  const { currentPassword, newPassword, newPasswordConfirm } = req.body;
  const { email } = req.user;

  const user = await User.findOne({ email }).select("+password");
  if (!user) return next(new AppError("User not found", 404));

  if (!(await user.correctPassword(currentPassword, user.password))) {
    return next(new AppError("Incorrect current password", 400));
  }

  if (newPassword !== newPasswordConfirm) {
    return next(
      new AppError("New password and confirm password do not match", 400),
    );
  }

  user.password = newPassword;
  user.passwordConfirm = newPasswordConfirm;
  await user.save();

  createSendToken(user, 200, res, "Password changed successfully");
});
