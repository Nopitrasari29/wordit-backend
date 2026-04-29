import { Router } from "express";
import * as aiController from "./ai.controller";
import { authMiddleware } from "../../middleware/auth.middleware"; // ✅ TAMBAHKAN PROTEKSI

const router = Router();

// =====================================================================
// 🤖 AI & SMART GRADING ROUTES
// Base URL: /api/ai
// =====================================================================

// Endpoint AI lama (Kita amankan pakai authMiddleware)
router.post("/generate-quiz", authMiddleware(), aiController.generateQuiz);
router.post("/get-feedback", authMiddleware(), aiController.getAIFeedback);

// Endpoint Baru: BE-17 Smart Grading (Menilai jawaban essay siswa secara instan)
router.post("/grade", authMiddleware(), aiController.gradeEssayAnswer);

export default router;