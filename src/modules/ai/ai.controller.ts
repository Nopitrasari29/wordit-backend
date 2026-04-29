import type { Request, Response } from "express";
import { generateQuizContent, generateFeedbackContent } from "./ai.service";
import { SmartGradingService } from "./smart-grading.service"; // ✅ IMPORT SERVICE BARU

// =====================================================================
// 🤖 1. GENERATE QUIZ CONTENT
// =====================================================================
export const generateQuiz = async (req: Request, res: Response) => {
  try {
    const { topic, educationLevel, templateType, count } = req.body;

    const quizData = await generateQuizContent(
      topic,
      educationLevel,
      templateType,
      count || 5 // Default ke 5 jika Frontend lupa mengirimkan count
    );

    return res.status(200).json({
      success: true,
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
// 🤖 2. GENERATE FEEDBACK (PEMBAHASAN SOAL)
// =====================================================================
export const getAIFeedback = async (req: Request, res: Response) => {
  try {
    const { questionText, correctAnswer } = req.body;
    const feedbackData = await generateFeedbackContent(questionText, correctAnswer);
    return res.status(200).json({
      success: true,
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
// 🤖 3. SMART GRADING ESSAY (BE-17)
// =====================================================================
export const gradeEssayAnswer = async (req: Request, res: Response) => {
  try {
    const { question, keywords, studentAnswer } = req.body;

    // Validasi input sederhana
    if (!question || !keywords || !studentAnswer) {
      return res.status(400).json({
        success: false,
        message: "Data tidak lengkap. Pastikan question, keywords, dan studentAnswer dikirim."
      });
    }

    // Panggil service AI Smart Grading
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
      message: "Terjadi kesalahan saat menghubungi layanan AI."
    });
  }
};