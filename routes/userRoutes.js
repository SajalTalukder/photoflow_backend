const express = require("express");
const {
  signup,
  verifyAccount,
  resendOTP,
  login,
  forgetPassword,
  resetPassword,
  changePassword,
  resendPasswordResetOTP,
  logout,
} = require("../controllers/authController");
const isAuthenticated = require("../middlewares/isAuthenticated");
const {
  getProfile,
  editProfile,
  suggestedUser,
  followUnfollow,
  searchUsers,
  getMe,
} = require("../controllers/userController");
const upload = require("../middlewares/multer");

const router = express.Router();

// Authentication Router
router.post("/signup", signup);
router.post("/verify", isAuthenticated, verifyAccount);
router.post("/resend-otp", isAuthenticated, resendOTP);
router.post("/login", login);
router.post("/logout", logout);
router.post("/forget-password", forgetPassword);
// router.post("/resend-password-reset-otp", resendPasswordResetOTP);
router.post("/reset-password", resetPassword);
router.post("/change-password", isAuthenticated, changePassword);

// User related Router
router.get("/profile/:id", getProfile);
router.post(
  "/edit-profile",
  isAuthenticated,
  upload.single("profilePicture"),
  editProfile
);

router.get("/suggested-user", isAuthenticated, suggestedUser);
router.post("/follow-unfollow/:id", isAuthenticated, followUnfollow);
router.get("/search-users", isAuthenticated, searchUsers);

router.get("/me", isAuthenticated, getMe);

module.exports = router;
