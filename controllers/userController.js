import catchAsync from "../utils/catchAsync.js";
import AppError from "../utils/appError.js";
import User from "../models/userModel.js";
import getDataUri from "../utils/datauri.js";
import { uploadToCloudinary } from "../utils/cloudinary.js";

// Get user profile by ID
export const getProfile = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const user = await User.findById(id)
    .select(
      "-password -otp -otpExpires -resetPasswordOTP -resetPasswordOTPExpires -passwordConfirm",
    )
    .populate({
      path: "posts",
      options: { sort: { createdAt: -1 } },
    })
    .populate({
      path: "savedPosts",
      options: { sort: { createdAt: -1 } },
    });

  if (!user) {
    return next(new AppError("User not found", 404));
  }

  res.status(200).json({
    status: "success",
    data: { user },
  });
});

// Edit Profile
export const editProfile = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const { bio } = req.body;
  const profilePicture = req.file;
  console.log(bio, profilePicture);

  let cloudResponse;

  if (profilePicture) {
    const fileUri = getDataUri(profilePicture);
    cloudResponse = await uploadToCloudinary(fileUri);
  }

  const user = await User.findById(userId).select("-password");
  if (!user) return next(new AppError("User Not Found", 404));

  if (bio) user.bio = bio;
  if (profilePicture) user.profilePicture = cloudResponse.secure_url;

  await user.save({ validateBeforeSave: false });

  return res.status(200).json({
    message: "Profile updated.",
    success: "success",
    data: { user },
  });
});

// Get suggested users
export const suggestedUser = catchAsync(async (req, res, next) => {
  const loginUserId = req.user.id;
  const users = await User.find({ _id: { $ne: loginUserId } }).select(
    "-password -otp -otpExpires -resetPasswordOTP -resetPasswordOTPExpires -passwordConfirm",
  );

  res.status(200).json({
    status: "success",
    data: { users },
  });
});

// Follow/Unfollow user
export const followUnfollow = catchAsync(async (req, res, next) => {
  const loggedInUserId = req.user._id;
  const targetUserId = req.params.id;

  if (loggedInUserId.toString() === targetUserId)
    return next(new AppError("You cannot follow/unfollow yourself", 400));

  const targetUser = await User.findById(targetUserId);
  if (!targetUser) return next(new AppError("User not found", 404));

  const isFollowing = targetUser.followers.includes(loggedInUserId);

  if (isFollowing) {
    await Promise.all([
      User.updateOne(
        { _id: loggedInUserId },
        { $pull: { following: targetUserId } },
      ),
      User.updateOne(
        { _id: targetUserId },
        { $pull: { followers: loggedInUserId } },
      ),
    ]);
  } else {
    await Promise.all([
      User.updateOne(
        { _id: loggedInUserId },
        { $addToSet: { following: targetUserId } },
      ),
      User.updateOne(
        { _id: targetUserId },
        { $addToSet: { followers: loggedInUserId } },
      ),
    ]);
  }

  const updatedLoggedInUser =
    await User.findById(loggedInUserId).select("-password");

  res.status(200).json({
    message: isFollowing ? "Unfollowed successfully" : "Followed successfully",
    status: "success",
    data: { user: updatedLoggedInUser },
  });
});

// Search users
export const searchUsers = catchAsync(async (req, res, next) => {
  const { query } = req.query;
  const loggedInUserId = req.user._id;

  if (!query || query.trim() === "") {
    return next(new AppError("Search query cannot be empty", 400));
  }

  const users = await User.find({
    username: { $regex: query, $options: "i" },
    _id: { $ne: loggedInUserId },
  }).select("username profilePicture bio");

  res.status(200).json({
    status: "success",
    results: users.length,
    data: { users },
  });
});

// Get authenticated user's own profile
export const getMe = catchAsync(async (req, res, next) => {
  console.log("getMe called");
  const user = req.user;

  if (!user) return next(new AppError("User not authenticated", 404));

  res.status(200).json({
    status: "success",
    message: "Authenticated User",
    data: { user },
  });
});
