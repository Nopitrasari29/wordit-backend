import multer from "multer";

// Simpan di RAM sebelum diproses FileManager
const storage = multer.memoryStorage();

const fileFilter = (req: any, file: any, cb: any) => {
  const allowed = ["image/jpeg", "image/png", "image/webp"];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only JPEG, PNG, and WebP images are allowed"));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // Max 5MB
});

// ✅ Export versi modular (untuk game/user baru)
export const uploadMiddleware = (fieldName: string) => upload.single(fieldName);

// ✅ Export versi lama (agar error 'uploadPhoto not found' hilang)
export const uploadPhoto = upload.single("profile_picture");