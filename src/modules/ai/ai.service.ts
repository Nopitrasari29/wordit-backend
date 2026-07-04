import { getGroqResponse } from "./providers/groq.provider";
import { getGeminiResponse } from "./providers/gemini.provider";
import { generateAnagram } from "./anagram.service";
import { SmartGradingService } from "./smart-grading.service";
import { createSystemLog } from "../../utils/system-logger";
import { redis } from "../../config/redis"; // ✅ IMPORT REDIS FOR PERSISTENCE

// Ambang batas peringatan: 80% dari estimasi limit harian Groq (free tier ~14.400/hari)
const QUOTA_ALERT_THRESHOLD = 11500;
// Ambang batas kritis: 95% dari limit
const QUOTA_CRITICAL_THRESHOLD = 13680;

/**
 * Mendapatkan key Redis harian
 */
const getDailyHitsKey = (): string => {
  const today = new Date().toDateString();
  return `ai:quota:hits:${today}`;
};

/**
 * Getter untuk monitoring eksternal (AI-09) - Sekarang Asinkron menggunakan Redis
 */
export const getApiUsageStats = async () => {
  const redisKey = getDailyHitsKey();
  const dailyApiHits = parseInt(await redis.get(redisKey) || "0", 10);
  return {
    dailyHits: dailyApiHits,
    warningThreshold: QUOTA_ALERT_THRESHOLD,
    criticalThreshold: QUOTA_CRITICAL_THRESHOLD,
    date: new Date().toDateString(),
    usagePercent: Math.round((dailyApiHits / QUOTA_CRITICAL_THRESHOLD) * 100),
  };
};

  const getSystemPrompt = (
    educationLevel: string,
    templateType: string,
    count: number,
    difficulty: string,
    strictLevel: number = 1,
    metadata?: { classGrade?: string, subject?: string, chapter?: string, topic?: string }
  ): string => {
    let formatInstruction = "";

    let essayInstruction = "Pertanyaan terbuka.";
    if (educationLevel === "SD") {
      essayInstruction =
        "Pertanyaan deskriptif yang sangat sederhana, mudah dibayangkan, dan ramah anak";
    } else if (educationLevel === "SMP") {
      essayInstruction =
        "Pertanyaan yang meminta penjelasan alasan atau perbandingan dasar";
    } else if (educationLevel === "SMA") {
      essayInstruction =
        "Pertanyaan terbuka yang memancing daya kritis dan analisis mendalam";
    } else if (educationLevel === "UNIVERSITY") {
      essayInstruction =
        "Pertanyaan studi kasus atau teoritis tingkat lanjut yang membutuhkan evaluasi akademik";
    }

    // Context metadata
    let contextInfo = `Jenjang: ${educationLevel}`;
    if (metadata?.classGrade) contextInfo += `\nKelas: ${metadata.classGrade}`;
    if (metadata?.subject) contextInfo += `\nMata Pelajaran: ${metadata.subject}`;
    if (metadata?.chapter) contextInfo += `\nBab: ${metadata.chapter}`;
    if (metadata?.topic) contextInfo += `\nTopik Spesifik: ${metadata.topic}`;

    // Penentuan struktur JSON output
    switch (templateType) {
      case "ANAGRAM":
      case "HANGMAN":
      case "WORD_SEARCH":
        formatInstruction = `{ "template": "${templateType}", "words": [ { "word": "KATA_TARGET_HURUF_KAPITAL", "hint": "Petunjuk yang spesifik dan mendidik sesuai topik" } ] }`;
        break;
      case "FLASHCARD":
        formatInstruction = `{ "template": "FLASHCARD", "cards": [ { "front": "Istilah/Konsep", "back": "Definisi yang jelas dan komprehensif", "hint": "Petunjuk singkat" } ] }`;
        break;
      case "MAZE_CHASE":
      case "SPIN_THE_WHEEL":
      case "MULTIPLE_CHOICE":
        formatInstruction = `{ "template": "${templateType}", "questions": [ { "question": "Pertanyaan yang sesuai dengan tingkat ${educationLevel}", "options": ["Jawaban Benar", "Pengecoh Logis 1", "Pengecoh Logis 2", "Pengecoh Logis 3"], "correctAnswer": "Jawaban Benar", "hint": "Petunjuk" } ] }\n\n⚠️ PENTING: Untuk 'options', JANGAN gunakan huruf A/B/C/D, melainkan tulis langsung isi jawabannya yang faktual!`;
        break;
      case "TRUE_FALSE":
        formatInstruction = `{ "template": "TRUE_FALSE", "questions": [ { "question": "Pernyataan faktual yang harus dinilai benar atau salahnya oleh siswa", "correctAnswer": true, "hint": "Penjelasan singkat fakta sebenarnya" } ] }`;
        break;
      case "MATCHING":
        formatInstruction = `{
          "template": "MATCHING",
          "pairs": [
            { "leftItem": "Contoh: Fotosintesis", "rightItem": "Contoh: Proses pembuatan makanan oleh tumbuhan", "hint": "Petunjuk opsional" },
            { "leftItem": "Contoh: Mitokondria", "rightItem": "Contoh: Organel penghasil energi sel", "hint": "Petunjuk opsional" }
          ]
        }

        ⚠️ PERINGATAN KERAS STRUKTUR MATCHING:
        - WAJIB gunakan PERSIS kunci "leftItem" dan "rightItem" (huruf kecil, camelCase).
        - DILARANG KERAS menggunakan kunci lain.
        - Setiap "leftItem" HARUS berpasangan logis dan unik dengan "rightItem"-nya.
        - Semua nilai "rightItem" HARUS berbeda satu sama lain (tidak boleh duplikat).
        - Hasilkan tepat ${count} objek di dalam array "pairs".`;
        break;
      case "ESSAY":
        formatInstruction = `{ "template": "ESSAY", "questions": [ { "question": "${essayInstruction}", "keywords": ["kunci1", "kunci2", "kunci3", "kunci4"], "answer": "Jawaban acuan/referensi ideal yang benar dan komprehensif", "hint": "Arahan cara menjawab" } ] }\n\n⚠️ PENTING:\n- 'keywords' harus berisi 3-5 kata kunci teknis/penting yang WAJIB ada di jawaban siswa agar nilainya sempurna.\n- 'answer' harus berisi kalimat referensi jawaban ideal yang benar untuk pertanyaan ini.`;
        break;
      default:
        formatInstruction = `{ "error": "Template tidak dikenal" }`;
    }

    return `Anda pakar kurikulum pendidikan nasional jenjang ${educationLevel}.
    Tugas: Hasilkan kuis edukatif tipe ${templateType} sebanyak TEPAT ${count} soal.

    KONTEKS MATERI:
    ${contextInfo}

    TINGKAT KESULITAN (AI-10):
    Gunakan tingkat kesulitan: ${difficulty.toUpperCase()}.
    
    PANDUAN BAHASA JENJANG ${educationLevel} (AI-03):
    - SD: Gunakan bahasa yang sangat sederhana, konkret, hindari istilah asing/rumit.
    - SMP: Gunakan bahasa semi-formal, mulai perkenalkan konsep abstrak dasar.
    - SMA: Gunakan bahasa formal, analitis, dan istilah ilmiah/teknis.
    - UNIVERSITY: Gunakan terminologi akademik level lanjut.

    ⚠️ ATURAN MUTLAK (STRICT LEVEL ${strictLevel}):
    - JANGAN HALUSINASI. JAWABAN HARUS FAKTUAL DAN BAKU.
    - JUMLAH SOAL: Hasilkan TEPAT ${count} butir soal di dalam array. Tidak boleh kurang atau lebih!
    - OUTPUT: HANYA JSON murni tanpa penjelasan atau markdown.

    STRUKTUR WAJIB:
    ${formatInstruction}`;
  };

/**
 * Menghitung jumlah item dalam respons AI
 */
const getItemsCount = (data: any): number => {
  const list = data.words || data.cards || data.questions || data.pairs || [];
  return Array.isArray(list) ? list.length : 0;
};

/**
 * Validasi struktur data AI
 */
const validateStructure = (data: any, templateType: string): boolean => {
  const list = data.words || data.cards || data.questions || data.pairs;

  if (!Array.isArray(list)) return false;

  // =========================================================
  // 🔥 MATCHING AI NORMALIZER FIX (AI-08)
  // =========================================================
  // AI kadang mengembalikan:
  // left/right
  // front/back
  // question/answer
  // Maka kita normalisasi otomatis agar engine stabil
  // =========================================================

  if (templateType === "MATCHING") {
    data.pairs = data.pairs?.map((item: any) => ({
      leftItem:
        item.leftItem ||
        item.left ||
        item.term ||
        item.question ||
        item.front ||
        item.kiri ||
        "",

      rightItem:
        item.rightItem ||
        item.right ||
        item.definition ||
        item.answer ||
        item.back ||
        item.kanan ||
        "",

      hint: item.hint || "",
    }));

    // =========================================================
    // 🔥 VALIDASI DUPLIKAT RIGHT ITEM
    // Mencegah AI membuat pasangan ambigu
    // =========================================================

    const rightItems = data.pairs.map((p: any) => p.rightItem);

    const uniqueRightItems = new Set(rightItems);

    if (uniqueRightItems.size !== rightItems.length) {
      console.warn("⚠️ Duplicate matching pairs detected from AI");
      return false;
    }

    // Validasi leftItem dan rightItem tidak boleh kosong
    const hasEmptyPairs = data.pairs.some(
      (p: any) => !p.leftItem || !p.rightItem,
    );
    if (hasEmptyPairs) {
      console.warn("⚠️ Empty leftItem or rightItem detected in MATCHING pairs");
      return false;
    }
  }

  // =========================================================
  // 🔥 VALIDASI STRUCTURE PER TEMPLATE
  // =========================================================

  return list.every((item: any) => {
    // =====================================================
    // MULTIPLE CHOICE
    // =====================================================
    if (templateType === "MULTIPLE_CHOICE") {
      return (
        item.question &&
        Array.isArray(item.options) &&
        item.options.length >= 2 &&
        item.correctAnswer
      );
    }

    // =====================================================
    // TRUE FALSE
    // =====================================================
    if (templateType === "TRUE_FALSE") {
      return item.question && typeof item.correctAnswer === "boolean";
    }

    // =====================================================
    // MATCHING
    // =====================================================
    if (templateType === "MATCHING") {
      return item.leftItem && item.rightItem;
    }

    // =====================================================
    // ESSAY
    // =====================================================
    if (templateType === "ESSAY") {
      return item.question && Array.isArray(item.keywords);
    }

    // =====================================================
    // DEFAULT TEMPLATE
    // =====================================================
    return true;
  });
};

/**
 * Mengirim notifikasi Telegram (AI-09)
 */
const sendTeleAlert = async (message: string) => {
  const token = process.env.TELE_BOT_TOKEN;
  const adminId = process.env.TELE_ADMIN_ID;
  if (!token || !adminId) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: adminId,
        text: `⚠️ [AI SYSTEM ALERT]: ${message}`,
      }),
    });
  } catch (err) {
    console.error("Tele Alert Error:", err);
  }
};

/**
 * Memproses respons AI, mencatat penggunaan, dan memeriksa kuota (AI-09) - Redis Backed
 */
const processAiResponse = async (
  text: string,
  provider: "groq" | "gemini" = "groq",
) => {
  const redisKey = getDailyHitsKey();
  const dailyApiHits = await redis.incr(redisKey);
  // Set TTL ke 24 jam saat hit pertama
  if (dailyApiHits === 1) {
    await redis.expire(redisKey, 86400);
  }

  const usagePercent = Math.round(
    (dailyApiHits / QUOTA_CRITICAL_THRESHOLD) * 100,
  );
  console.log(
    `[AI Quota] Hits hari ini: ${dailyApiHits} (${usagePercent}% dari limit kritis)`,
  );

  // Simpan log penggunaan ke database setiap 100 hits (AI-09)
  if (dailyApiHits % 100 === 0) {
    createSystemLog({
      action: "AI_QUOTA_UPDATE",
      details: `Penggunaan API ${provider.toUpperCase()} hari ini: ${dailyApiHits} hits (${usagePercent}% dari limit)`,
    }).catch(() => {});
  }

  // Alert 80% limit (AI-09) - Cegah spam Telegram dengan flag Redis
  if (dailyApiHits >= QUOTA_ALERT_THRESHOLD) {
    const todayStr = new Date().toDateString();
    const alertSentKey = `ai:quota:alert:warning:${todayStr}`;
    const alertSent = await redis.get(alertSentKey);
    
    if (!alertSent) {
      await redis.set(alertSentKey, "true", "EX", 86400);
      const alertMsg = `Kuota harian ${provider.toUpperCase()} mencapai ~80% (${dailyApiHits} hits). Pertimbangkan untuk membatasi request.`;
      sendTeleAlert(alertMsg);
      createSystemLog({
        action: "AI_QUOTA_WARNING",
        details: alertMsg,
      }).catch(() => {});
      console.warn(`[AI Quota] ⚠️ WARNING: ${alertMsg}`);
    }
  }

  // Alert kritis 95% limit (AI-09) - Cegah spam Telegram dengan flag Redis
  if (dailyApiHits >= QUOTA_CRITICAL_THRESHOLD) {
    const todayStr = new Date().toDateString();
    const criticalSentKey = `ai:quota:alert:critical:${todayStr}`;
    const criticalSent = await redis.get(criticalSentKey);

    if (!criticalSent) {
      await redis.set(criticalSentKey, "true", "EX", 86400);
      const criticalMsg = `KRITIS! Kuota ${provider.toUpperCase()} mencapai ~95% (${dailyApiHits} hits). Sistem berisiko gagal sebelum tengah malam!`;
      sendTeleAlert(criticalMsg);
      createSystemLog({
        action: "AI_QUOTA_CRITICAL",
        details: criticalMsg,
      }).catch(() => {});
      console.error(`[AI Quota] 🚨 CRITICAL: ${criticalMsg}`);
    }
  }

  try {
    const cleaned = text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");

    if (start === -1 || end === -1) throw new Error("JSON tidak ditemukan");
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch (err) {
    throw new Error("Format respons AI tidak valid.");
  }
};

/**
 * Generator utama kuis (AI-05, AI-08, AI-10)
 */
export const generateQuizContent = async (
  topic: string,
  educationLevel: string,
  templateType: string,
  count: number,
  difficulty: string = "MEDIUM",
  metadata?: { classGrade?: string, subject?: string, chapter?: string, topic?: string }
) => {
  console.log(
    `[AI] Request -> ${templateType} | ${educationLevel} | Count: ${count} | Level: ${difficulty}`,
  );

  if (templateType === "ANAGRAM") {
    return generateAnagram(topic, educationLevel, count);
  }

  // 💡 OPTIMASI: Gunakan Gemini sebagai model utama jika jumlah soal > 5 ATAU tipe soal adalah ESSAY
  // Karena Llama 8B seringkali kehabisan token/limitasi memori untuk teks panjang dalam Bahasa Indonesia.
  const useGeminiFirst = count > 5 || templateType === "ESSAY";

  if (useGeminiFirst) {
    console.log(`[AI] Using Gemini as primary provider because count is ${count} or template is ${templateType}`);
    try {
      const systemPrompt = getSystemPrompt(
        educationLevel,
        templateType,
        count,
        difficulty,
        1,
        metadata
      );
      const res = await getGeminiResponse(
        systemPrompt,
        `Topik: ${topic}. ${metadata?.topic ? `Spesifikasi Topik: ${metadata.topic}.` : ''} Hasilkan tepat ${count} soal dalam format JSON.`
      );
      const data = await processAiResponse(res || "", "gemini");
      const itemCount = getItemsCount(data);
      const isStructureValid = validateStructure(data, templateType);

      if (itemCount === count && isStructureValid) {
        console.log(`[AI] Gemini Primary Success ✅ (${itemCount} soal)`);
        return data;
      }
      console.warn(`[AI] Gemini primary returned invalid count/structure (${itemCount}/${count}). Falling back to Groq...`);
    } catch (geminiErr: any) {
      console.warn(`[AI] Gemini primary error: ${geminiErr.message}. Falling back to Groq...`);
    }
  }

  let attempts = 0;

  // Mekanisme retry hingga 3 kali dengan prompt yang semakin ketat (AI-05)
  while (attempts < 3) {
    try {
      const systemPrompt = getSystemPrompt(
        educationLevel,
        templateType,
        count,
        difficulty,
        attempts + 1,
        metadata
      );
      const contextualHint = metadata?.topic ? metadata.topic : topic;
      const userPrompt = `Topik Utama: ${topic}. ${metadata?.topic ? `Spesifikasi Topik: ${metadata.topic}.` : ''} Buatkan kuis edukatif kognitif tepat ${count} soal.`;

      const res = await getGroqResponse(systemPrompt, userPrompt);
      const data = await processAiResponse(res || "", "groq");

      const itemCount = getItemsCount(data);
      const isCountValid = itemCount === count;
      const isStructureValid = validateStructure(data, templateType);

      if (isCountValid && isStructureValid) {
        console.log(`[AI] Groq Success ✅ (${itemCount} soal)`);
        return data;
      }

      // Log detail kegagalan untuk debugging (AI-08)
      console.warn(
        `[AI] Groq retry ke-${attempts + 1}: count=${itemCount}/${count}, structure=${isStructureValid}`,
      );

      // Jika jumlah soal terlalu sedikit, coba paksa dengan userPrompt yang lebih eksplisit
      if (itemCount < count && attempts === 1) {
        console.warn(
          `[AI] Jumlah soal kurang (${itemCount} dari ${count}). Mencoba prompt paksa...`,
        );
      }
    } catch (e: any) {
      console.warn(`[AI] Error Groq attempt ${attempts + 1}: ${e.message}`);
    }
    attempts++;
  }

  // Fallback ke Gemini jika Groq gagal 3x (AI-05)
  const fallbackMsg = `Groq gagal 3x pada kuis ${templateType} (topik: ${topic}). Fallback Gemini aktif.`;
  await sendTeleAlert(fallbackMsg);
  createSystemLog({
    action: "AI_FALLBACK_GEMINI",
    details: fallbackMsg,
  }).catch(() => {});

  try {
    const systemPrompt = getSystemPrompt(
      educationLevel,
      templateType,
      count,
      difficulty,
      3,
      metadata
    );
    const contextualHint = metadata?.topic ? metadata.topic : topic;
    const res = await getGeminiResponse(
      systemPrompt,
      `Topik: ${topic}. ${metadata?.topic ? `Spesifikasi Topik: ${metadata.topic}.` : ''} Hasilkan tepat ${count} soal dalam format JSON.`,
    );
    const data = await processAiResponse(res || "", "gemini");

    // Validasi hasil Gemini juga (AI-05)
    const isStructureValid = validateStructure(data, templateType);
    if (!isStructureValid) {
      console.warn(
        "[AI] Gemini fallback: struktur tidak valid, tetap dikembalikan sebagai best-effort.",
      );
    }

    console.log(
      `[AI] Gemini Fallback Success ✅ (${getItemsCount(data)} soal)`,
    );
    return data;
  } catch (err) {
    createSystemLog({
      action: "AI_TOTAL_FAILURE",
      details: `Groq & Gemini keduanya gagal untuk template ${templateType}, topik: ${topic}`,
    }).catch(() => {});
    throw new Error("Layanan AI sedang sibuk. Silakan coba lagi nanti.");
  }
};

/**
 * Generator feedback per soal (AI-06)
 */
export const generateFeedbackContent = async (
  questionText: string,
  correctAnswer: string,
) => {
  const systemPrompt = `Berikan penjelasan edukatif menyemangati max 100 kata. DILARANG KERAS mengulangi atau menulis ulang teks 'Jawaban Benar:' di akhir kalimat (karena UI sudah menampilkannya). Fokus saja pada MENGAPA jawaban tersebut benar. JSON: { "feedback": "..." }`;
  const userPrompt = `Pertanyaan: ${questionText}\nJawaban Benar: ${correctAnswer}`;
  try {
    const res = await getGroqResponse(systemPrompt, userPrompt);
    return processAiResponse(res || "", "groq");
  } catch {
    const res = await getGeminiResponse(systemPrompt, userPrompt);
    return processAiResponse(res || "", "gemini");
  }
};

/**
 * Proses penilaian esai (AI-07)
 */
export const performSmartGrading = async (
  question: string,
  answer: string,
  keywords: string[],
) => {
  return SmartGradingService.gradeEssay(question, keywords, answer);
};

// ✅ AI-DOCS-UPLOAD: Ekstraksi teks dari file (TXT, MD, PDF, DOCX, Images)
import fs from "fs";
import mammoth from "mammoth";

export const extractTextFromFile = async (
  filePath: string,
  fileName: string,
  mimeType: string
): Promise<string> => {
  const ext = fileName.split(".").pop()?.toLowerCase();

  // 1. Plain text / Markdown
  if (ext === "txt" || ext === "md" || mimeType.startsWith("text/")) {
    return fs.readFileSync(filePath, "utf8");
  }

  // 2. Word Document (.docx)
  if (ext === "docx" || mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    try {
      const result = await mammoth.extractRawText({ path: filePath });
      return result.value || "";
    } catch (err: any) {
      throw new Error(`Gagal membaca file Word: ${err.message}`);
    }
  }

  // 3. PDF (Coba parsing lokal dulu agar instan dan gratis)
  if (ext === "pdf" || mimeType === "application/pdf") {
    try {
      const pdfParse = require("pdf-parse");
      const fileBuffer = fs.readFileSync(filePath);
      const pdfData = await pdfParse(fileBuffer);
      const extractedText = pdfData.text || "";

      // Jika berhasil mengekstrak teks nyata secara lokal (tidak kosong)
      if (extractedText.trim().length > 10) {
        console.log("✨ PDF teks berhasil diekstrak secara lokal menggunakan pdf-parse secara instan!");
        return extractedText;
      }
      console.log("⚠️ pdf-parse lokal menghasilkan teks kosong (mungkin hasil scan). Melakukan fallback ke Gemini Vision...");
    } catch (err: any) {
      console.warn("⚠️ Gagal mengekstrak PDF secara lokal, mencoba fallback ke Gemini Vision:", err.message);
    }
  }

  // 4. Fallback ke Gambar atau PDF Scan via Gemini API
  if (
    ext === "pdf" ||
    mimeType === "application/pdf" ||
    mimeType.startsWith("image/")
  ) {
    const apiKey = (process.env.GEMINI_API_KEY || "").trim();
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY belum diset di server backend");
    }

    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const fileBuffer = fs.readFileSync(filePath);
    const base64Data = fileBuffer.toString("base64");

    // Batasi request Gemini API agar tidak hang selamanya jika gagal respon
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 Detik Timeout

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: "Ekstrak teks lengkap dari dokumen/gambar ini apa adanya secara objektif, tanpa tambahan penjelasan, opini, salam, atau format markdown pembuka/penutup. Keluarkan teks mentahnya saja."
                },
                {
                  inlineData: {
                    mimeType: mimeType,
                    data: base64Data
                  }
                }
              ]
            }
          ]
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const data: any = await response.json();
      if (!response.ok) {
        throw new Error(data.error?.message || "Gemini API error");
      }

      const text = data?.candidates?.[0]?.content?.parts?.find((p: any) => p?.text)?.text;
      if (!text) {
        throw new Error("Teks kosong hasil ekstraksi Gemini");
      }
      return text;
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === "AbortError") {
        throw new Error("Koneksi ke Google Gemini API timeout (melampaui 60 detik). Coba unggah file yang lebih kecil atau periksa jaringan.");
      }
      throw new Error(`Gagal mengekstrak teks dengan Gemini: ${err.message}`);
    }
  }

  throw new Error(`Format file .${ext} (${mimeType}) tidak didukung.`);
};
