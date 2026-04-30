import { getGroqResponse } from "./providers/groq.provider";
import { getGeminiResponse } from "./providers/gemini.provider";
import { generateAnagram } from "./anagram.service";
import { SmartGradingService } from "./smart-grading.service";

/**
 * Monitoring penggunaan API harian
 */
let dailyApiHits = 0;
const QUOTA_ALERT_THRESHOLD = 11500;

/**
 * Generator system prompt
 */
const getSystemPrompt = (
  educationLevel: string,
  templateType: string,
  count: number,
  difficulty: string,
  strictLevel: number = 1
): string => {
  let formatInstruction = "";

  // Penentuan struktur JSON output
  switch (templateType) {
    case "ANAGRAM":
    case "HANGMAN":
    case "WORD_SEARCH":
      formatInstruction = `{ "template": "${templateType}", "words": [ { "word": "KATA", "hint": "Petunjuk edukatif" } ] }`;
      break;
    case "FLASHCARD":
      formatInstruction = `{ "template": "FLASHCARD", "cards": [ { "front": "Istilah", "back": "Penjelasan", "hint": "Petunjuk" } ] }`;
      break;
    case "MAZE_CHASE":
    case "SPIN_THE_WHEEL":
    case "MULTIPLE_CHOICE":
      formatInstruction = `{ "template": "${templateType}", "questions": [ { "question": "...", "options": ["A", "B", "C", "D"], "correctAnswer": "...", "hint": "Petunjuk" } ] }`;
      break;
    case "TRUE_FALSE":
      formatInstruction = `{ "template": "TRUE_FALSE", "questions": [ { "question": "...", "correctAnswer": true, "hint": "Petunjuk" } ] }`;
      break;
    case "MATCHING": 
      formatInstruction = `{ "template": "MATCHING", "pairs": [ { "leftItem": "Kunci", "rightItem": "Pasangan", "hint": "Relasi" } ] }`;
      break;
    case "ESSAY":
      formatInstruction = `{ "template": "ESSAY", "questions": [ { "question": "...", "keywords": ["..."], "hint": "Saran" } ] }`;
      break;
    default:
      formatInstruction = `{ "error": "Template tidak dikenal" }`;
  }

  return `Anda pakar kurikulum pendidikan internasional jenjang ${educationLevel}.
  Tugas: Hasilkan kuis Bahasa Indonesia tipe ${templateType} sebanyak TEPAT ${count} soal.

  TINGKAT KESULITAN (AI-10):
  Gunakan tingkat kesulitan: ${difficulty.toUpperCase()}.
  
  KARAKTERISTIK MATERI (AI-03):
  1. SD: Bahasa ramah anak, sederhana.
  2. SMP/SMA: Bahasa formal-edukatif.
  3. UNIVERSITY: Terminologi akademik lanjut.

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

  return list.every((item: any) => {
    if (templateType === "MULTIPLE_CHOICE") {
      return item.question && item.options && item.correctAnswer;
    }
    if (templateType === "TRUE_FALSE") {
      return item.question && typeof item.correctAnswer === "boolean";
    }
    if (templateType === "MATCHING") {
      return item.leftItem && item.rightItem;
    }
    if (templateType === "ESSAY") {
      return item.question && item.keywords;
    }
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
    // ✅ PERBAIKAN: Instruksi user prompt diperjelas agar Gemini memberikan JSON yang valid
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
  const userPrompt = `Pertanyaan: ${questionText}\nJawaban: ${correctAnswer}`;
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