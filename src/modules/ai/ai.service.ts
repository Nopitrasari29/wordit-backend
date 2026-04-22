import { getGroqResponse } from "./providers/groq.provider";
import { getGeminiResponse } from "./providers/gemini.provider";

/**
 * 🎯 SYSTEM PROMPT: Otak dari WordIT AI
 * Dirancang untuk mencegah typo, halusinasi, dan format ngawur.
 */
const getSystemPrompt = (educationLevel: string, templateType: string): string => {
  let formatInstruction = "";

  // 🛠️ DEFINISI STRUKTUR JSON BERDASARKAN GAME
  switch (templateType) {
    case "ANAGRAM":
    case "HANGMAN":
    case "WORD_SEARCH":
      formatInstruction = `
      {
        "template": "${templateType}",
        "words": [
          { "word": "KATA_JAWABAN_ASLI", "hint": "Petunjuk mendalam dan edukatif" }
        ]
      }`;
      break;
    case "FLASHCARD":
      formatInstruction = `
      {
        "template": "FLASHCARD",
        "cards": [
          { "front": "Istilah atau Pertanyaan Utama", "back": "Jawaban atau Penjelasan Detail" }
        ]
      }`;
      break;
    case "MAZE_CHASE":
    case "SPIN_THE_WHEEL":
      formatInstruction = `
      {
        "template": "${templateType}",
        "questions": [
          { "question": "Pertanyaan yang menantang", "answer": "Jawaban benar yang singkat dan padat" }
        ]
      }`;
      break;
    default:
      formatInstruction = `{ "error": "Template tidak dikenal" }`;
  }

  return `Anda adalah pakar kurikulum pendidikan internasional untuk jenjang ${educationLevel}.
Tugas: Hasilkan 5 soal kuis edukatif dalam Bahasa Indonesia untuk tipe game: ${templateType}.

⚠️ ATURAN MUTLAK (DILARANG MELANGGAR):
1. VALIDITAS DATA: Semua jawaban ('word', 'back', atau 'answer') HARUS berupa kata/istilah asli yang sah (Contoh: "FIREWALL", "INTEGRITAS").
2. ANTI-HALUSINASI: DILARANG KERAS mengarang singkatan ngawur atau kata typo (Contoh salah: "TBAKC", "SOHMAI").
3. FORMAT JAWABAN: Untuk Anagram/Hangman, berikan KATA ASLI, jangan memberikan kata yang sudah diacak hurufnya.
4. KUALITAS MATERI: 
   - SD: Gunakan bahasa ramah anak.
   - UNIVERSITY: Gunakan terminologi akademik lanjut (seperti standar ISO, COBIT, atau framework profesional relevan).
5. OUTPUT: Hanya kirimkan JSON valid tanpa teks penjelasan apa pun.

WAJIB ikuti struktur JSON ini:
${formatInstruction}`;
};

/**
 * 🛠️ UTILS: Pembersih JSON
 * Mencegah server crash jika AI mengirimkan Markdown (```json ... ```)
 */
const extractJSON = (text: string) => {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("JSON tidak ditemukan");
    return JSON.parse(match[0]);
  } catch (err) {
    console.error("🔥 Gagal parsing JSON dari AI:", err);
    throw new Error("Response AI tidak valid");
  }
};

/**
 * 🚀 MAIN GENERATOR
 */
export const generateQuizContent = async (
  topic: string,
  educationLevel: string,
  templateType: string
) => {
  const systemPrompt = getSystemPrompt(educationLevel, templateType);
  const userPrompt = `Topik: ${topic}. Buatlah konten kuis yang sangat berkualitas untuk jenjang ${educationLevel}.`;

  try {
    // 1. Coba Pakai Groq (Utama)
    const result = await getGroqResponse(systemPrompt, userPrompt);
    console.log(`[AI System]: Groq Success ✅ (Template: ${templateType})`);
    return extractJSON(result!);
  } catch (error) {
    console.warn("[AI System]: Groq gagal/limit, mencoba Gemini (Fallback)... 🔄");
    try {
      // 2. Fallback ke Gemini
      const res = await getGeminiResponse(systemPrompt, userPrompt);
      return extractJSON(res);
    } catch (err) {
      console.error("[AI System]: Seluruh AI Provider gagal.");
      throw new Error("Gagal generate soal. Silakan coba lagi nanti.");
    }
  }
};

/**
 * 📝 FEEDBACK GENERATOR
 */
export const generateFeedbackContent = async (
  questionText: string,
  correctAnswer: string
) => {
  const systemPrompt = `Berikan penjelasan edukatif maksimal 100 kata mengenai jawaban "${correctAnswer}". 
Gunakan nada bicara yang menyemangati siswa. Jawab dalam format JSON: { "feedback": "..." }`;
  
  const userPrompt = `Pertanyaan: ${questionText}\nJawaban: ${correctAnswer}`;

  try {
    const result = await getGroqResponse(systemPrompt, userPrompt);
    return extractJSON(result!);
  } catch (error) {
    const res = await getGeminiResponse(systemPrompt, userPrompt);
    return extractJSON(res);
  }
};