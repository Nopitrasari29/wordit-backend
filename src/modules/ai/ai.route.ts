import { Router } from "express";
import * as aiController from "./ai.controller";
import { authMiddleware } from "../../middleware/auth.middleware";

const router = Router();

// Hanya TEACHER/ADMIN yang boleh akses AI buat bikin soal
router.post("/generate-quiz", authMiddleware(["TEACHER", "ADMIN"]), aiController.generateQuiz);

export default router;