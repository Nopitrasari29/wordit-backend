import { Router } from "express";
import * as aiController from "./ai.controller";

const router = Router();

// Pastikan nama fungsi di belakang aiController sesuai dengan yang ada di controller.ts
router.post("/generate-quiz", aiController.generateQuiz);
router.post("/get-feedback", aiController.getAIFeedback);

export default router;