import mongoose from "mongoose";
import Comment from "./commentModel.js";

const postSchema = new mongoose.Schema(
  {
    caption: {
      type: String,
      maxLength: [2200, "Caption should be less than 2200 characters"],
      trim: true,
    },
    image: {
      url: { type: String, required: true },
      publicId: { type: String, required: true },
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
    },
    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    comments: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Comment",
      },
    ],
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true },
);

// Indexing to improve performance on queries
postSchema.index({ user: 1, createdAt: -1 });

const Post = mongoose.model("Post", postSchema);

export default Post;
