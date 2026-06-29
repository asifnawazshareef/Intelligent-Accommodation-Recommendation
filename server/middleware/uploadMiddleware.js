import fs from "fs";
import path from "path";
import multer from "multer";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const PROPERTY_UPLOAD_DIR = path.join(__dirname, "..", "uploads", "properties");

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

fs.mkdirSync(PROPERTY_UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, PROPERTY_UPLOAD_DIR);
  },
  filename: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase() || ".jpg";
    const safeExtension = ALLOWED_EXTENSIONS.has(extension) ? extension : ".jpg";
    const uniqueName = `property-${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExtension}`;
    callback(null, uniqueName);
  },
});

const fileFilter = (_req, file, callback) => {
  const extension = path.extname(file.originalname).toLowerCase();

  if (
    ALLOWED_MIME_TYPES.has(file.mimetype) &&
    ALLOWED_EXTENSIONS.has(extension)
  ) {
    callback(null, true);
    return;
  }

  callback(new Error("Only JPG, JPEG, PNG, and WEBP images are allowed."));
};

export const propertyUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 5,
  },
}).array("images", 5);

export const handleMulterError = (error, req, res, next) => {
  if (!error) {
    return next();
  }

  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "Each image must be 5MB or smaller.",
      });
    }

    if (error.code === "LIMIT_FILE_COUNT" || error.code === "LIMIT_UNEXPECTED_FILE") {
      return res.status(400).json({
        success: false,
        message: "You can upload up to 5 images per property.",
      });
    }

    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }

  return res.status(400).json({
    success: false,
    message: error.message || "Image upload failed.",
  });
};
