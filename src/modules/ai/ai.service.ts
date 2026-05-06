import { getGroqResponse } from "./providers/groq.provider";
import { getGeminiResponse } from "./providers/gemini.provider";
import { generateAnagram } from "./anagram.service";
import { SmartGradingService } from "./smart-grading.service";

/**
 * Monitoring penggunaan API harian
 */
let dailyApiHits = 0;
const QUOTA_ALERT_THRESHOLD = 11500;

const getSystemPrompt = (
  educationLevel: string,
  templateType: string,
  count: number,
  difficulty: string,
  strictLevel: number = 1
): string => {
  let formatInstruction = "";

  let essayInstruction = "Pertanyaan terbuka.";
  if (educationLevel === "SD") {
    essayInstruction = "Pertanyaan deskriptif yang sangat sederhana, mudah dibayangkan, dan ramah anak";
  } else if (educationLevel === "SMP") {
    essayInstruction = "Pertanyaan yang meminta penjelasan alasan atau perbandingan dasar";
  } else if (educationLevel === "SMA") {
    essayInstruction = "Pertanyaan terbuka yang memancing daya kritis dan analisis mendalam";
  } else if (educationLevel === "UNIVERSITY") {
    essayInstruction = "Pertanyaan studi kasus atau teoritis tingkat lanjut yang membutuhkan evaluasi akademik";
  }

  // Penentuan struktur JSON output
  switch (templateType) {
    case "ANAGRAM":
    case "HANGMAN":
    case "WORD_SEARCH":
      formatInstruction = `{ "template": "${templateType}", "words": [ { "word": "KATA_TARGET_HURUF_KAPITAL", "hint": "Petunjuk yang spesifik dan mendidik" } ] }`;
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
      formatInstruction = `
      { 
        "template": "MATCHING", 
        "pairs": [ 
          { "leftItem": "Sebab / Istilah / Kunci", "rightItem": "Akibat / Definisi / Pasangan yang relevan", "hint": "Petunjuk" } 
        ] 
      }
      ⚠️ PERINGATAN KERAS: 
      - WAJIB gunakan kunci "leftItem" dan "rightItem". 
      - JANGAN gunakan kunci lain seperti "left", "right", atau "pair". 
      - Pasangkan kiri dan kanan secara logis, unik, dan tidak membingungkan.`;
      break;
    case "ESSAY":
      formatInstruction = `{ "template": "ESSAY", "questions": [ { "question": "${essayInstruction}", "keywords": ["kunci1", "kunci2", "kunci3", "kunci4"], "hint": "Arahan cara menjawab" } ] }\n\n⚠️ PENTING: 'keywords' harus berisi 3-5 kata kunci teknis/penting yang WAJIB ada di jawaban siswa agar nilainya sempurna.`;
      break;
    default:
      formatInstruction = `{ "error": "Template tidak dikenal" }`;
  }

  return `Anda pakar kurikulum pendidikan nasional jenjang ${educationLevel}.
  Tugas: Hasilkan kuis Bahasa Indonesia tipe ${templateType} sebanyak TEPAT ${count} soal.

  TINGKAT KESULITAN (AI-10):
  Gunakan tingkat kesulitan: ${difficulty.toUpperCase()}.
  
  PANDUAN BAHASA JENJANG ${educationLevel} (AI-03):
  - SD: Gunakan bahasa yang sangat sederhana, konkret, hindari istilah asing/rumit.
  - SMP: Gunakan bahasa semi-formal, mulai perkenalkan konsep abstrak dasar.
  - SMA: Gunakan bahasa formal, analitis, dan istilah ilmiah/teknis.
  - UNIVERSITY: Gunakan terminologi akademik level lanjut.

  ⚠️ ATURAN MUTLAK (STRICT LEVEL ${strictLevel}):
  - JANGAN HALUSINASI. JAWABAN HARUS FAKTUAL DAN BAKU (KBBI).
  - JUMLAH SOAL: Hasilkan TEPAT ${count} butir soal di dalam array. Tidak boleh kurang atau lebih!
  - OUTPUT: HANYA JSON murni tanpa penjelasan atau markdown.

  STRUKTUR WAJIB:
  ${formatInstruction}`;
};

/**
 * Menghitung jumlah item
 */
const getItemsCount = (data: any): number => {
  const list = data.words || data.cards || data.questions || data.pairs || [];
  return Array.isArray(list) ? list.length : 0;
};

/**
 * Validasi struktur data
 */
const validateStructure = (data: any, templateType: string): boolean => {
  const list = data.words || data.cards || data.questions || data.pairs;

  if (!Array.isArray(list)) return false;

  // =========================================================
  // 🔥 MATCHING AI NORMALIZER FIX
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
        item.question ||
        item.front ||
        "",

      rightItem:
        item.rightItem ||
        item.right ||
        item.answer ||
        item.back ||
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
      return (
        item.question &&
        typeof item.correctAnswer === "boolean"
      );
    }

    // =====================================================
    // MATCHING
    // =====================================================
    if (templateType === "MATCHING") {
      return (
        item.leftItem &&
        item.rightItem
      );
    }

    // =====================================================
    // ESSAY
    // =====================================================
    if (templateType === "ESSAY") {
      return (
        item.question &&
        Array.isArray(item.keywords)
      );
    }

    // =====================================================
    // DEFAULT TEMPLATE
    // =====================================================
    return true;
  });
};

/**
 * Mengirim notifikasi Telegram
 */
const sendTeleAlert = async (message: string) => {
  const token = process.env.TELE_BOT_TOKEN;
  const adminId = process.env.TELE_ADMIN_ID;
  if (!token || !adminId) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: adminId, text: `⚠️ [AI SYSTEM ALERT]: ${message}` }),
    });
  } catch (err) { console.error("Tele Alert Error:", err); }
};

/**
 * Memproses respons AI dan mencatat penggunaan
 */
const processAiResponse = (text: string) => {
  dailyApiHits++;
  console.log(`[AI Tracker]: Total hits hari ini: ${dailyApiHits}`);

  if (dailyApiHits === QUOTA_ALERT_THRESHOLD) {
    sendTeleAlert(`Kuota harian Groq mencapai 80% (${dailyApiHits} hits).`);
  }

  try {
    const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");

    if (start === -1 || end === -1) throw new Error("JSON tidak ditemukan");
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch (err) { throw new Error("Format respons AI tidak valid."); }
};

/**
 * Generator utama kuis
 */
export const generateQuizContent = async (
  topic: string,
  educationLevel: string,
  templateType: string,
  count: number,
  difficulty: string = "MEDIUM"
) => {
  console.log(`[AI] Request -> ${templateType} | ${educationLevel} | Count: ${count} | Level: ${difficulty}`);

  if (templateType === "ANAGRAM") {
    return generateAnagram(topic, educationLevel, count);
  }

  let attempts = 0;

  // Mekanisme retry
  while (attempts < 3) {
    try {
      const systemPrompt = getSystemPrompt(educationLevel, templateType, count, difficulty, attempts + 1);
      const userPrompt = `Topik: ${topic}. Buatkan kuis edukatif kognitif tepat ${count} soal.`;

      const res = await getGroqResponse(systemPrompt, userPrompt);
      const data = processAiResponse(res || "");

      const isCountValid = getItemsCount(data) === count;
      const isStructureValid = validateStructure(data, templateType);

      if (isCountValid && isStructureValid) {
        console.log(`[AI] Groq Success ✅ (${getItemsCount(data)} soal)`);
        return data;
      }
      console.warn(`[AI] Data tidak valid (Count/Structure), retry ke-${attempts + 1}`);
    } catch (e) {
      console.warn(`[AI] Error pada Groq, memulai percobaan ulang ke-${attempts + 1}`);
    }
    attempts++;
  }

  // Fallback ke Gemini
  await sendTeleAlert(`Groq gagal pada kuis ${templateType}. Fallback Gemini aktif.`);
  try {
    const systemPrompt = getSystemPrompt(educationLevel, templateType, count, difficulty, 3);
    const res = await getGeminiResponse(systemPrompt, `Topik: ${topic}. Hasilkan tepat ${count} soal dalam format JSON.`);
    return processAiResponse(res || "");
  } catch (err) {
    throw new Error("Layanan AI sedang sibuk. Silakan coba lagi nanti.");
  }
};

/**
 * Generator feedback
 */
export const generateFeedbackContent = async (questionText: string, correctAnswer: string) => {
  const systemPrompt = `Berikan penjelasan edukatif menyemangati max 100 kata. JSON: { "feedback": "..." }`;
  const userPrompt = `Pertanyaan: ${questionText}\nJawaban Benar: ${correctAnswer}`;
  try {
    const res = await getGroqResponse(systemPrompt, userPrompt);
    return processAiResponse(res || "");
  } catch {
    const res = await getGeminiResponse(systemPrompt, userPrompt);
    return processAiResponse(res || "");
  }
};

/**
 * Proses penilaian esai
 */
export const performSmartGrading = async (question: string, answer: string, keywords: string[]) => {
  return SmartGradingService.gradeEssay(question, keywords, answer);
};