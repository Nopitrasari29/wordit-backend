import type { Request, Response } from "express";
import {
  generateQuizContent,
  generateFeedbackContent,
  getApiUsageStats,
  performSmartGrading, 
  extractTextFromFile,
} from "./ai.service";
import { SmartGradingService } from "./smart-grading.service";
import fs from "fs";

// =====================================================================
// 🤖 1. GENERATE QUIZ CONTENT (AI-05, AI-08, AI-10)
// =====================================================================
export const generateQuiz = async (req: Request, res: Response) => {
  try {
    /**
     * Menambahkan 'difficulty' sesuai dengan kriteria AI-10 (Adaptive Difficulty).
     * Default tingkat kesulitan adalah 'MEDIUM' jika tidak dikirim dari Frontend.
     */
    const { topic, educationLevel, templateType, count, difficulty, classGrade, subject, chapter, topic: metadataTopic } = req.body;

    const quizData = await generateQuizContent(
      topic,
      educationLevel,
      templateType,
      count || 5,
      difficulty || "MEDIUM", // ✅ SINKRONISASI AI-10
      { classGrade, subject, chapter, topic: metadataTopic }
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
    const feedbackData = await generateFeedbackContent(
      questionText,
      correctAnswer,
    );
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
        message:
          "Data tidak lengkap. Pastikan question, keywords, dan studentAnswer dikirim.",
      });
    }

    /**
     * Memanggil service AI Smart Grading sesuai struktur Class rekan tim.
     * Return: { score: number, justification: string }
     */
    // ✅ PERBAIKAN: Memanggil performSmartGrading agar filter anti-curang (Gap 2) aktif
    const gradingResult = await performSmartGrading(
      question,
      studentAnswer,
      keywords,
    );

    return res.status(200).json({
      success: true,
      message: "Berhasil menilai jawaban essay",
      data: gradingResult,
    });
  } catch (error: any) {
    console.error("❌ Controller AI Grading Error:", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan saat menghubungi layanan AI Smart Grading.",
    });
  }
};

// =====================================================================
// 🤖 4. AI QUOTA MONITORING (AI-09)
// Endpoint untuk Admin melihat status penggunaan API AI hari ini.
// =====================================================================
export const getQuotaStatus = async (req: Request, res: Response) => {
  try {
    const stats = await getApiUsageStats();
    return res.status(200).json({
      success: true,
      message: "Status kuota AI berhasil diambil.",
      data: {
        ...stats,
        status:
          stats.usagePercent >= 95
            ? "CRITICAL"
            : stats.usagePercent >= 80
              ? "WARNING"
              : "NORMAL",
      },
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
// =====================================================================
// 🤖 5. EXTRACT TEXT FROM UPLOADED DOCUMENT (PDF, DOCX, TXT, IMAGES)
// =====================================================================
export const extractText = async (req: Request, res: Response) => {
  let tempFilePath: string | null = null;
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({
        success: false,
        message: "File tidak diunggah atau format tidak didukung. Pastikan file berupa PDF, DOCX, TXT, atau gambar.",
      });
    }

    // Tentukan path file: bisa dari diskStorage (file.path) atau memoryStorage (file.buffer)
    let filePath: string;
    if (file.path) {
      // DiskStorage: file sudah tersimpan di disk
      filePath = file.path;
    } else if (file.buffer) {
      // MemoryStorage: tulis buffer ke file sementara
      const os = require("os");
      const path = require("path");
      const ext = file.originalname.split(".").pop() || "tmp";
      tempFilePath = path.join(os.tmpdir(), `wordit-upload-${Date.now()}.${ext}`);
      fs.writeFileSync(tempFilePath, file.buffer);
      filePath = tempFilePath;
    } else {
      return res.status(400).json({
        success: false,
        message: "File tidak dapat dibaca dari server.",
      });
    }

    const text = await extractTextFromFile(filePath, file.originalname, file.mimetype);

    // Cleanup: hapus file disk (dari diskStorage) atau file temp (dari memoryStorage)
    const pathToDelete = file.path || tempFilePath;
    if (pathToDelete) {
      try { fs.unlinkSync(pathToDelete); } catch { /* ignore */ }
    }
    tempFilePath = null;

    if (!text || text.trim().length === 0) {
      return res.status(422).json({
        success: false,
        message: "Teks berhasil diekstrak namun hasilnya kosong. Pastikan dokumen berisi teks yang dapat dibaca.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Ekstraksi teks berhasil.",
      data: { text },
    });
  } catch (error: any) {
    // Cleanup jika error
    if (req.file?.path) { try { fs.unlinkSync(req.file.path); } catch { /* ignore */ } }
    if (tempFilePath) { try { fs.unlinkSync(tempFilePath); } catch { /* ignore */ } }

    console.error("❌ extractText error:", error.message);
    return res.status(500).json({
      success: false,
      message: error.message || "Gagal mengekstrak teks dari dokumen.",
    });
  }
};