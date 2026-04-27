import { getGroqResponse } from "./providers/groq.provider";
import { getGeminiResponse } from "./providers/gemini.provider";
import { generateAnagram } from "./anagram.service";

/**
 * SYSTEM PROMPT 
 * Digunakan untuk menghasilkan instruksi AI berdasarkan tingkat pendidikan dan jenis template kuis.
 */
const getSystemPrompt = (educationLevel: string, templateType: string): string => {
  let formatInstruction = "";

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

    // Struktur tambahan untuk mode permainan berbasis pertanyaan
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

  return `
Anda adalah pakar kurikulum pendidikan internasional untuk jenjang ${educationLevel}.

Tugas: Hasilkan soal kuis edukatif dalam Bahasa Indonesia untuk tipe game: ${templateType}.

⚠️ ATURAN MUTLAK (DILARANG MELANGGAR):
1. VALIDITAS DATA: Semua jawaban HARUS kata/istilah asli yang sah (contoh: "FIREWALL", "INTEGRITAS").
2. ANTI-HALUSINASI: Dilarang mengarang kata atau typo.
3. FORMAT JAWABAN: Untuk Anagram/Hangman gunakan kata asli, bukan hasil acakan.
4. KUALITAS MATERI:
   - SD: bahasa ramah anak
   - UNIVERSITY: istilah akademik profesional
5. OUTPUT: Hanya JSON tanpa teks tambahan

WAJIB ikuti struktur JSON ini:
${formatInstruction}
`;
};

/**
 * JSON PARSER SAFETY
 * Berfungsi untuk mengekstrak JSON dari respons AI dan menghindari error akibat format tambahan.
 */
const extractJSON = (text: string) => {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("JSON tidak ditemukan");
  return JSON.parse(match[0]);
};

/**
 * MAIN GENERATOR (HYBRID SYSTEM)
 * Mengatur alur utama pembuatan soal dengan fallback Groq → Gemini.
 */
export const generateQuizContent = async (
  topic: string,
  educationLevel: string,
  templateType: string,
  count: number
) => {

  console.log(`[AI] Request -> ${templateType} | ${educationLevel} | ${count}`);

  // Menggunakan service khusus untuk mode ANAGRAM
  if (templateType === "ANAGRAM") {
    return generateAnagram(topic, educationLevel, count);
  }

  const systemPrompt = getSystemPrompt(educationLevel, templateType);
  const userPrompt = `Topik: ${topic}. Buat ${count} soal sesuai format.`;

  try {
    const res = await getGroqResponse(systemPrompt, userPrompt);
    console.log(`[AI] Groq Success`);
    return extractJSON(res || "");
  } catch {
    const res = await getGeminiResponse(systemPrompt, userPrompt);
    return extractJSON(res || "");
  }
};

/**
 * FEEDBACK GENERATOR
 * Menghasilkan penjelasan jawaban dalam format JSON.
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