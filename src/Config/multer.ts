import multer from "multer";
import AppError from "../Utils/Errors/AppError";
export const storage = multer.memoryStorage();
export const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const imageAllowedTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
    ];
    const audioAllowedTypes = ["audio/mpeg", "audio/wav", "audio/mp3"];
    if (
      imageAllowedTypes.includes(file.mimetype) ||
      audioAllowedTypes.includes(file.mimetype)
    ) {
      cb(null, true);
    } else {
      cb(new AppError("Invalid file type", 400));
    }
  },
});
export const imageUpload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new AppError("Invalid file type", 400));
    }
  },
});
