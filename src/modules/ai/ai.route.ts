import { Router } from "express";
import * as aiController from "./ai.controller";
import { authMiddleware } from "../../middleware/auth.middleware";
import { generateQuizSchema } from "./ai.schema"; // ✅ TAMBAHAN: Schema yang kita buat tadi
import { documentUploadMiddleware } from "../../middleware/upload.middleware";
import { validate } from "../../middleware/validate.middleware";

const router = Router();

// =====================================================================
// 🤖 AI & SMART GRADING ROUTES
// Base URL: /api/ai
// =====================================================================

/**
 * 🛠️ GENERATE QUIZ
 * Hanya bisa diakses oleh TEACHER dan ADMIN.
 * ✅ REVISI GAP 3: Sekarang menggunakan validate(generateQuizSchema) 
 * untuk memastikan input dari user aman dan sesuai tipe data.
 */
router.post(
  "/generate-quiz",
  authMiddleware(["TEACHER", "SCHOOL_ADMIN", "SUPER_ADMIN"]),
  validate(generateQuizSchema), // ✅ PASANG DISINI (GAP 3 FIXED)
  aiController.generateQuiz,
);

/**
 * 📖 GET FEEDBACK
 * Bisa diakses oleh semua pengguna yang sudah login (STUDENT, TEACHER, SCHOOL_ADMIN, SUPER_ADMIN).
 */
router.post(
  "/get-feedback",
  authMiddleware(["STUDENT", "TEACHER", "SCHOOL_ADMIN", "SUPER_ADMIN"]),
  aiController.getAIFeedback,
);

/**
 * 📝 SMART GRADING (BE-17)
 * Digunakan oleh Student saat mensubmit esai, atau Teacher saat mengevaluasi.
 */
router.post(
  "/grade",
  authMiddleware(["STUDENT", "TEACHER", "SCHOOL_ADMIN", "SUPER_ADMIN"]),
  aiController.gradeEssayAnswer,
);

/**
 * 📊 AI QUOTA MONITORING (AI-09)
 * Hanya bisa diakses oleh SUPER_ADMIN dan SCHOOL_ADMIN untuk memantau penggunaan API harian.
 */
router.get(
  "/quota-status",
  authMiddleware(["SUPER_ADMIN", "SCHOOL_ADMIN"]),
  aiController.getQuotaStatus,
);

/**
 * 📄 EXTRACT TEXT FROM UPLOADED DOCUMENT
 * Bisa diakses oleh TEACHER, SCHOOL_ADMIN, dan SUPER_ADMIN untuk mengurai materi PDF/Word/JPG dll.
 */
router.post(
  "/extract-text",
  authMiddleware(["TEACHER", "SCHOOL_ADMIN", "SUPER_ADMIN"]),
  documentUploadMiddleware("file"),
  aiController.extractText,
);

export default router;