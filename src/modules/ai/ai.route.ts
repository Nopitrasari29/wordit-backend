import { Router } from "express";
import * as aiController from "./ai.controller";
import { authMiddleware } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validate.middleware";
import { generateQuizSchema } from "./ai.schema"; // ✅ TAMBAHAN: Schema yang kita buat tadi

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
  authMiddleware(["TEACHER", "ADMIN"]),
  validate(generateQuizSchema), // ✅ PASANG DISINI (GAP 3 FIXED)
  aiController.generateQuiz,
);

/**
 * 📖 GET FEEDBACK
 * Bisa diakses oleh semua pengguna yang sudah login (STUDENT, TEACHER, ADMIN).
 */
router.post(
  "/get-feedback",
  authMiddleware(["STUDENT", "TEACHER", "ADMIN"]),
  aiController.getAIFeedback,
);

/**
 * 📝 SMART GRADING (BE-17)
 * Digunakan oleh Student saat mensubmit esai, atau Teacher saat mengevaluasi.
 */
router.post(
  "/grade",
  authMiddleware(["STUDENT", "TEACHER", "ADMIN"]),
  aiController.gradeEssayAnswer,
);

/**
 * 📊 AI QUOTA MONITORING (AI-09)
 * Hanya bisa diakses oleh ADMIN untuk memantau penggunaan API harian.
 */
router.get(
  "/quota-status",
  authMiddleware(["ADMIN"]),
  aiController.getQuotaStatus,
);

export default router;