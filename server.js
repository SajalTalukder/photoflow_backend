// 1️⃣ Load env variables first — MUST be at top
import env from "./config.js";

// 2️⃣ Import other modules safely AFTER env
import mongoose from "mongoose";
import app from "./app.js";
import job from "./utils/cornjob.js";

const DB = process.env.DB.replace("<PASSWORD>", process.env.DB_PASSWORD);

// Start cron job
job.start();

// Connect to MongoDB
mongoose
  .connect(DB)
  .then(() => console.log("✅ DB connection successful!"))
  .catch((err) => console.error("❌ DB connection error:", err));

// Start server
const port = process.env.PORT || 3000;
const server = app.listen(port, () => {
  console.log(`🚀 App running on port ${port}...`);
});

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  console.log("UNCAUGHT EXCEPTION! 💥 Shutting down...");
  console.log(err.name, err.message);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (err) => {
  console.log("UNHANDLED REJECTION! 💥 Shutting down...");
  console.log(err.name, err.message);
  server.close(() => process.exit(1));
});
