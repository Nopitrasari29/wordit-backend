import multer from "multer";
import path from "path";
import fs from "fs";

// Konfigurasi penyimpanan dasar
const storage = multer.memoryStorage(); // Kita simpan di RAM dulu sebelum diproses FileManager

// Filter file agar hanya gambar
const fileFilter = (req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowed = ["image/jpeg", "image/png", "image/webp"];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only JPEG, PNG, and WebP images are allowed"));
  }
};

/**
 * Middleware Factory untuk Upload File
 * @param fieldName Nama field di form-data (contoh: 'profile_picture' atau 'thumbnail_image')
 * @param maxCount Jumlah file maksimal
 */
export const uploadMiddleware = (fieldName: string, maxCount: number = 1) => {
  return multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 }, // Max 5MB
  }).single(fieldName); 
};  