const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Function to upload file to Cloudinary
const uploadToCloudinary = async (fileUri) => {
  try {
    const response = await cloudinary.uploader.upload(fileUri);
    return response;
  } catch (error) {
    throw new Error("Failed to upload image to Cloudinary");
  }
};

module.exports = { uploadToCloudinary, cloudinary };
