const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");
const User = require("../models/userModel");
const getDataUri = require("../utils/datauri");
const { uploadToCloudinary } = require("../utils/cloudinary");

exports.getProfile = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  // Fetch the user data from the database using the user ID from the token
  const user = await User.findById(id)
    .select(
      "-password -otp -otpExpires -resetPasswordOTP -resetPasswordOTPExpires -passwordConfirm"
    )
    .populate({
      path: "posts", // Populate the 'posts' field
      options: { sort: { createdAt: -1 } }, // Sort posts by 'createdAt' in descending order
    })
    .populate({
      path: "savedPosts", // Populate the 'savedPosts' field
      options: { sort: { createdAt: -1 } }, // Sort savedPosts by 'createdAt' in descending order
    });

  // If no user is found, return an error
  if (!user) {
    return next(new AppError("User not found", 404));
  }

  // Send the user profile data
  res.status(200).json({
    status: "success",
    data: {
      user,
    },
  });
});

// Edit Profile Functionality
exports.editProfile = catchAsync(async (req, res, next) => {
  const userId = req.user.id; // Assuming user is authenticated and ID is available in req.user
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

  // Update user profile fields
  if (bio) user.bio = bio;
  if (profilePicture) user.profilePicture = cloudResponse.secure_url;

  await user.save({ validateBeforeSave: false });

  return res.status(200).json({
    message: "Profile updated.",
    success: "success",
    data: {
      user,
    },
  });
});

// get suggested users
exports.suggestedUser = catchAsync(async (req, res, next) => {
  const loginUserId = req.user.id;
  const users = await User.find({ _id: { $ne: loginUserId } }).select(
    "-password -otp -otpExpires -resetPasswordOTP -resetPasswordOTPExpires -passwordConfirm"
  );
  res.status(200).json({
    status: "success",
    data: {
      users,
    },
  });
});

exports.followUnfollow = catchAsync(async (req, res, next) => {
  const loggedInUserId = req.user._id; // Get the logged-in user ID
  const targetUserId = req.params.id; // Get the target user ID from request parameters

  // Prevent user from following/unfollowing themselves
  if (loggedInUserId.toString() === targetUserId)
    return next(new AppError("You cannot follow/unfollow yourself", 400));

  // Fetch the target user from the database
  const targetUser = await User.findById(targetUserId);

  // Check if the target user exists
  if (!targetUser) {
    return next(new AppError("User not found", 404));
  }

  // Determine if the logged-in user is already following the target user
  const isFollowing = targetUser.followers.includes(loggedInUserId);

  if (isFollowing) {
    // Unfollow action
    await Promise.all([
      User.updateOne(
        { _id: loggedInUserId },
        { $pull: { following: targetUserId } } // Remove the target user from the 'following' list
      ),
      User.updateOne(
        { _id: targetUserId },
        { $pull: { followers: loggedInUserId } } // Remove the logged-in user from the 'followers' list
      ),
    ]);
  } else {
    // Follow action
    await Promise.all([
      User.updateOne(
        { _id: loggedInUserId },
        { $addToSet: { following: targetUserId } } // Add the target user to the 'following' list
      ),
      User.updateOne(
        { _id: targetUserId },
        { $addToSet: { followers: loggedInUserId } } // Add the logged-in user to the 'followers' list
      ),
    ]);
  }

  // Fetch the updated logged-in user details
  const updatedLoggedInUser = await User.findById(loggedInUserId).select(
    "-password"
  );

  // Send the response with the updated logged-in user
  res.status(200).json({
    message: isFollowing ? "Unfollowed successfully" : "Followed successfully",
    status: "success",
    data: {
      user: updatedLoggedInUser,
    },
  });
});

exports.searchUsers = catchAsync(async (req, res, next) => {
  const { query } = req.query;
  const loggedInUserId = req.user._id; // Get the logged-in user's ID

  // Validate the query parameter
  if (!query || query.trim() === "") {
    return next(new AppError("Search query cannot be empty", 400));
  }

  // Perform the search
  const users = await User.find({
    username: { $regex: query, $options: "i" }, // Case-insensitive search
    _id: { $ne: loggedInUserId }, // Exclude the logged-in user
  }).select("username profilePicture bio"); // Select only the necessary fields

  res.status(200).json({
    status: "success",
    results: users.length,
    data: {
      users,
    },
  });
});

exports.getMe = catchAsync(async (req, res, next) => {
  const user = req.user;
  if (!user) return next(new AppError("User not authenticated", 404));
  res.status(200).json({
    status: "success",
    message: "authenticated User",
    data: {
      user,
    },
  });
});
