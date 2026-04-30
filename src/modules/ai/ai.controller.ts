import type { Request, Response } from "express";
import { generateQuizContent, generateFeedbackContent } from "./ai.service";
import { SmartGradingService } from "./smart-grading.service"; 

// =====================================================================
// 🤖 1. GENERATE QUIZ CONTENT (AI-05, AI-08, AI-10)
// =====================================================================
export const generateQuiz = async (req: Request, res: Response) => {
  try {
    /**
     * Menambahkan 'difficulty' sesuai dengan kriteria AI-10 (Adaptive Difficulty).
     * Default tingkat kesulitan adalah 'MEDIUM' jika tidak dikirim dari Frontend.
     */
    const { topic, educationLevel, templateType, count, difficulty } = req.body;

    const quizData = await generateQuizContent(
      topic,
      educationLevel,
      templateType,
      count || 5,
      difficulty || "MEDIUM" // ✅ SINKRONISASI AI-10
    );

    return res.status(200).json({
      success: true,
      message: "Konten kuis berhasil dihasilkan.",
      data: quizData,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// =====================================================================
// 🤖 2. GENERATE FEEDBACK (PEMBAHASAN SOAL - AI-06)
// =====================================================================
export const getAIFeedback = async (req: Request, res: Response) => {
  try {
    const { questionText, correctAnswer } = req.body;
    const feedbackData = await generateFeedbackContent(questionText, correctAnswer);
    return res.status(200).json({
      success: true,
      message: "Feedback AI berhasil dihasilkan.",
      data: feedbackData,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// =====================================================================
// 🤖 3. SMART GRADING ESSAY (BE-17 / AI-07)
// =====================================================================
export const gradeEssayAnswer = async (req: Request, res: Response) => {
  try {
    const { question, keywords, studentAnswer } = req.body;

    // Validasi input untuk memastikan data lengkap sebelum diproses AI
    if (!question || !keywords || !studentAnswer) {
      return res.status(400).json({
        success: false,
        message: "Data tidak lengkap. Pastikan question, keywords, dan studentAnswer dikirim."
      });
    }

    /**
     * Memanggil service AI Smart Grading sesuai struktur Class rekan tim.
     * Return: { score: number, justification: string }
     */
    const gradingResult = await SmartGradingService.gradeEssay(
      question,
      keywords,
      studentAnswer
    );

    return res.status(200).json({
      success: true,
      message: "Berhasil menilai jawaban essay",
      data: gradingResult
    });
  } catch (error: any) {
    console.error("❌ Controller AI Grading Error:", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan saat menghubungi layanan AI Smart Grading."
    });
  }
};