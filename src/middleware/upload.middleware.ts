import multer from "multer";
import path from "path";
import fs from "fs";

// 1. Memory Storage untuk Foto Profil (hanya JPEG/PNG/WebP, max 5MB)
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

// 2. Disk Storage khusus untuk Dokumen AI (PDF, Word, TXT, Images, max 10MB)
const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), "uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  },
});

const documentFileFilter = (req: any, file: any, cb: any) => {
  const allowedMimeTypes = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
    "text/plain",
    "text/markdown",
    "image/jpeg",
    "image/png",
    "image/webp",
  ];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Format berkas tidak didukung! Hanya mendukung PDF, DOCX, TXT, MD, JPG, PNG, WEBP."));
  }
};

const documentUpload = multer({
  storage: diskStorage,
  fileFilter: documentFileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // Max 10MB
});

// ✅ Export middleware khusus dokumen
export const documentUploadMiddleware = (fieldName: string) => documentUpload.single(fieldName);