import { Router } from "express";
import * as aiController from "./ai.controller";
import { authMiddleware } from "../../middleware/auth.middleware";
const router = Router();
// =====================================================================
// 🤖 AI & SMART GRADING ROUTES
// Base URL: /api/ai
// =====================================================================
/**
🛠️ GENERATE QUIZ
Hanya bisa diakses oleh TEACHER dan ADMIN.
Memenuhi kriteria keamanan dokumen SKPL.
*/
router.post(
"/generate-quiz",
authMiddleware(["TEACHER", "ADMIN"]),
aiController.generateQuiz
);
/**
📖 GET FEEDBACK
Bisa diakses oleh semua pengguna yang sudah login (STUDENT, TEACHER, ADMIN).
*/
router.post(
"/get-feedback",
authMiddleware(["STUDENT", "TEACHER", "ADMIN"]),
aiController.getAIFeedback
);
/**
📝 SMART GRADING (BE-17)
Digunakan oleh Student saat mensubmit esai, atau Teacher saat mengevaluasi.
*/
router.post(
"/grade",
authMiddleware(["STUDENT", "TEACHER", "ADMIN"]),
aiController.gradeEssayAnswer
);
export default router;

