import catchAsync from "../utils/catchAsync.js";
import sharp from "sharp";
import { uploadToCloudinary, cloudinary } from "../utils/cloudinary.js";
import Post from "../models/postModel.js";
import User from "../models/userModel.js";
import Comment from "../models/commentModel.js";
import AppError from "../utils/appError.js";

// Create a new post
export const createPost = catchAsync(async (req, res, next) => {
  const { caption } = req.body;
  const image = req.file;
  const userId = req.user._id;

  if (!image) return next(new AppError("Image is required for the post", 400));

  const optimizedImageBuffer = await sharp(image.buffer)
    .resize({ width: 800, height: 800, fit: "inside" })
    .toFormat("jpeg", { quality: 80 })
    .toBuffer();

  const fileUri = `data:image/jpeg;base64,${optimizedImageBuffer.toString(
    "base64",
  )}`;
  const cloudResponse = await uploadToCloudinary(fileUri);

  let post = await Post.create({
    caption,
    image: {
      url: cloudResponse.secure_url,
      publicId: cloudResponse.public_id,
    },
    user: userId,
  });

  const user = await User.findById(userId);
  if (user) {
    user.posts.push(post._id);
    await user.save({ validateBeforeSave: false });
  }

  post = await post.populate({
    path: "user",
    select: "username email bio profilePicture",
  });

  return res.status(201).json({
    status: "success",
    message: "Post Created",
    data: { post },
  });
});

// Get all posts
export const getAllPosts = catchAsync(async (req, res, next) => {
  const posts = await Post.find()
    .populate({
      path: "user",
      select: "username profilePicture bio",
    })
    .populate({
      path: "comments",
      select: "text user",
      populate: { path: "user", select: "username profilePicture" },
    })
    .sort({ createdAt: -1 });

  return res.status(200).json({
    status: "success",
    results: posts.length,
    data: { posts },
  });
});

// Get posts of a specific user
export const getUserPosts = catchAsync(async (req, res, next) => {
  const userId = req.params.id;

  const posts = await Post.find({ user: userId })
    .populate({
      path: "comments",
      select: "text user",
      populate: { path: "user", select: "username profilePicture" },
    })
    .sort({ createdAt: -1 });

  return res.status(200).json({
    status: "success",
    results: posts.length,
    data: { posts },
  });
});

// Save or unsave a post
export const saveOrUnsavePost = catchAsync(async (req, res, next) => {
  const userId = req.user._id;
  const postId = req.params.postId;

  const user = await User.findById(userId);
  if (!user) return next(new AppError("User not found", 404));

  const isPostSaved = user.savedPosts.includes(postId);

  if (isPostSaved) {
    user.savedPosts.pull(postId);
    await user.save({ validateBeforeSave: false });

    return res.status(200).json({
      status: "success",
      message: "Post unsaved successfully",
      data: { user },
    });
  } else {
    user.savedPosts.push(postId);
    await user.save({ validateBeforeSave: false });

    return res.status(200).json({
      status: "success",
      message: "Post saved successfully",
      data: { user },
    });
  }
});

// Delete a post
export const deletePost = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const userId = req.user._id;

  const post = await Post.findById(id).populate("user");
  if (!post) return next(new AppError("Post not found", 404));

  if (post.user._id.toString() !== userId.toString())
    return next(
      new AppError("You are not authorized to delete this post", 403),
    );

  await User.updateOne({ _id: userId }, { $pull: { posts: id } });
  await User.updateMany({ savedPosts: id }, { $pull: { savedPosts: id } });
  await Comment.deleteMany({ post: id });

  if (post.image.publicId)
    await cloudinary.uploader.destroy(post.image.publicId);

  await Post.findByIdAndDelete(id);

  res.status(200).json({
    status: "success",
    message: "Post deleted successfully",
  });
});

// Like or dislike a post
export const likeOrDislikePost = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const userId = req.user._id;

  const post = await Post.findById(id);
  if (!post) return next(new AppError("Post not found", 404));

  const isLiked = post.likes.includes(userId);

  if (isLiked) {
    await Post.findByIdAndUpdate(
      id,
      { $pull: { likes: userId } },
      { new: true },
    );
    return res
      .status(200)
      .json({ status: "success", message: "Post disliked successfully" });
  } else {
    await Post.findByIdAndUpdate(
      id,
      { $addToSet: { likes: userId } },
      { new: true },
    );
    return res
      .status(200)
      .json({ status: "success", message: "Post liked successfully" });
  }
});

// Add a comment to a post
export const addComment = catchAsync(async (req, res, next) => {
  const { id: postId } = req.params;
  const userId = req.user._id;
  const { text } = req.body;

  const post = await Post.findById(postId);
  if (!post) return next(new AppError("Post not found", 404));
  if (!text) return next(new AppError("Comment text is required", 400));

  const comment = await Comment.create({
    text,
    user: userId,
    createdAt: Date.now(),
  });

  post.comments.push(comment);
  await post.save();

  await comment.populate({
    path: "user",
    select: "username profilePicture bio",
  });

  res.status(201).json({
    status: "success",
    message: "Comment added successfully",
    data: { comment },
  });
});
