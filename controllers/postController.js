const catchAsync = require("../utils/catchAsync");
const sharp = require("sharp");
const { uploadToCloudinary, cloudinary } = require("../utils/cloudinary");
const Post = require("../models/postModel");
const User = require("../models/userModel");
const Comment = require("../models/commentModel");
const AppError = require("../utils/appError");

exports.createPost = catchAsync(async (req, res, next) => {
  const { caption } = req.body;
  const image = req.file; // Expecting an image file in the request
  const userId = req.user._id; // ID of the logged-in user

  if (!image) return next(new AppError("Image is required for the post", 400));

  // Optimize the image
  const optimizedImageBuffer = await sharp(image.buffer)
    .resize({ width: 800, height: 800, fit: "inside" })
    .toFormat("jpeg", { quality: 80 })
    .toBuffer();
  const fileUri = `data:image/jpeg;base64,${optimizedImageBuffer.toString(
    "base64"
  )}`;
  const cloudResponse = await uploadToCloudinary(fileUri);

  let post = await Post.create({
    caption,
    image: {
      url: cloudResponse.secure_url, // URL of the uploaded image
      publicId: cloudResponse.public_id, // Public ID of the uploaded image
    }, // Cloudinary URL of the uploaded image
    user: userId,
  });

  // Add post to user's posts
  const user = await User.findById(userId);
  if (user) {
    user.posts.push(post._id);
    await user.save({ validateBeforeSave: false });
  }
  post = await post.populate({
    path: "user",
    select: "username email bio profilePicture", // Select specific fields to return
  });
  return res.status(201).json({
    status: "Success",
    message: "Post Created",
    data: {
      post,
    },
  });
});

// get all the post
exports.getAllPosts = catchAsync(async (req, res, next) => {
  // Fetch all posts and populate the necessary fields
  const posts = await Post.find()
    .populate({
      path: "user", // Populate the post's user field
      select: "username profilePicture bio", // Select only necessary fields
    })
    .populate({
      path: "comments", // Populate the comments array
      select: "text user", // Only fetch text and user fields from comments
      populate: {
        path: "user", // Further populate the user field within comments
        select: "username profilePicture", // Only get necessary fields from user
      },
    })
    .sort({ createdAt: -1 }); // Optionally sort posts by creation date (most recent first)

  // Return the posts in the response
  return res.status(200).json({
    status: "success",
    results: posts.length,
    data: {
      posts,
    },
  });
});

// get users post
exports.getUserPosts = catchAsync(async (req, res, next) => {
  const userId = req.params.id;

  const posts = await Post.find({ user: userId })
    .populate({
      path: "comments",
      select: "text user",
      populate: {
        path: "user",
        select: "username profilePicture",
      },
    })
    .sort({ createdAt: -1 });

  return res.status(200).json({
    status: "success",
    results: posts.length,
    data: {
      posts,
    },
  });
});

// save and unsave post

exports.saveOrUnsavePost = catchAsync(async (req, res, next) => {
  const userId = req.user._id; // Get the logged-in user's ID
  const postId = req.params.postId; // Get the ID of the post to save/unsave

  // Find the logged-in user
  const user = await User.findById(userId);

  if (!user) {
    return next(new AppError("User not found", 404));
  }

  // Check if the post is already saved by the user
  const isPostSaved = user.savedPosts.includes(postId);

  if (isPostSaved) {
    // Unsave the post if it is already saved
    user.savedPosts.pull(postId);
    await user.save({ validateBeforeSave: false });

    return res.status(200).json({
      status: "success",
      message: "Post unsaved successfully",
      data: {
        user,
      },
    });
  } else {
    // Save the post if it is not already saved
    user.savedPosts.push(postId);
    await user.save({ validateBeforeSave: false });

    return res.status(200).json({
      status: "success",
      message: "Post saved successfully",
      data: {
        user,
      },
    });
  }
});

// Deleted Post
exports.deletePost = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const userId = req.user._id;

  // Find the post to be deleted
  const post = await Post.findById(id).populate("user");

  if (!post) {
    return next(new AppError("Post not found", 404));
  }

  // Check if the logged-in user is the author of the post
  if (post.user._id.toString() !== userId.toString()) {
    return next(
      new AppError("You are not authorized to delete this post", 403)
    );
  }

  // Remove the post from the user's posts array
  await User.updateOne({ _id: userId }, { $pull: { posts: id } });

  // Remove the post from all users' saved posts
  await User.updateMany({ savedPosts: id }, { $pull: { savedPosts: id } });

  // Remove any associated comments
  await Comment.deleteMany({ post: id });

  // Remove the image from Cloudinary if it exists
  if (post.image.publicId) {
    await cloudinary.uploader.destroy(post.image.publicId);
  }

  // Remove the post from the database
  await Post.findByIdAndDelete(id);

  res.status(200).json({
    status: "success",
    message: "Post deleted successfully",
  });
});

// Like and dislike post
exports.likeOrDislikePost = catchAsync(async (req, res, next) => {
  const { id } = req.params; // Post ID from request parameters
  const userId = req.user._id; // ID of the logged-in user

  // Find the post
  const post = await Post.findById(id);

  if (!post) {
    return next(new AppError("Post not found", 404));
  }

  // Check if the post is already liked by the user
  const isLiked = post.likes.includes(userId);

  if (isLiked) {
    // Remove the like (dislike)
    await Post.findByIdAndUpdate(
      id,
      { $pull: { likes: userId } },
      { new: true }
    );

    return res.status(200).json({
      status: "success",
      message: "Post disliked successfully",
    });
  } else {
    // Add the like
    await Post.findByIdAndUpdate(
      id,
      { $addToSet: { likes: userId } },
      { new: true }
    );

    return res.status(200).json({
      status: "success",
      message: "Post liked successfully",
    });
  }
});

// Add a comment to a post
exports.addComment = catchAsync(async (req, res, next) => {
  const { id: postId } = req.params; // Post ID from the route
  const userId = req.user._id; // ID of the logged-in user
  const { text } = req.body; // Comment text from the request body

  // Check if the post exists
  const post = await Post.findById(postId);
  if (!post) {
    return next(new AppError("Post not found", 404));
  }

  // Check if comment text is provided
  if (!text) {
    return next(new AppError("Comment text is required", 400));
  }

  // Create a new comment
  const comment = await Comment.create({
    text,
    user: userId,
    createdAt: Date.now(),
  });

  // Add the comment to the post's comments array
  post.comments.push(comment);
  await post.save();

  // Populate user information in the comment
  await comment.populate({
    path: "user",
    select: "username profilePicture bio",
  });

  res.status(201).json({
    status: "success",
    message: "Comment added successfully",
    data: {
      comment,
    },
  });
});
