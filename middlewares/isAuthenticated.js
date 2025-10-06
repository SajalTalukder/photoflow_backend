// isAuthenticated.js
const jwt = require("jsonwebtoken");
const User = require("../models/userModel"); // Adjust the path to your user model
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");

const isAuthenticated = catchAsync(async (req, res, next) => {
  const token = req.cookies.token || req.headers.authorization?.split(" ")[1];
  console.log("FROM MIDDLEAREWS", token, "FINISHED.......");

  if (!token) {
    return next(
      new AppError("You are not logged in! Please log in to access.", 401)
    );
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("✅ Token decoded:", decoded);

    const currentUser = await User.findById(decoded.id);

    if (!currentUser) {
      return next(
        new AppError("The user belonging to this token does not exist.", 401)
      );
    }

    console.log("✅ User found:", currentUser.email);
    req.user = currentUser;
    next();
  } catch (err) {
    console.error("❌ JWT verification failed:", err.message);
    return next(
      new AppError("Invalid or expired token. Please log in again.", 401)
    );
  }
});

module.exports = isAuthenticated;
