const express = require("express");

const upload = require("../middlewares/multer");
const {
  createPost,
  getAllPosts,
  getUserPosts,
  saveOrUnsavePost,
  deletePost,
  likeOrDislikePost,
  addComment,
} = require("../controllers/postController");
const isAuthenticated = require("../middlewares/isAuthenticated");

const router = express.Router();

router.post(
  "/create-post",
  isAuthenticated,
  upload.single("image"),
  createPost
);

router.get("/all", getAllPosts);
router.get("/user-post/:id", getUserPosts);
router.post("/save-unsave-post/:postId", isAuthenticated, saveOrUnsavePost);
router.delete("/delete-post/:id", isAuthenticated, deletePost);
router.post("/like-dislike/:id", isAuthenticated, likeOrDislikePost);
router.post("/comment/:id", isAuthenticated, addComment);

module.exports = router;
