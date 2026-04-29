import { getGroqResponse } from "./providers/groq.provider";
import { getGeminiResponse } from "./providers/gemini.provider";
import { generateAnagram } from "./anagram.service";

/**
 * SYSTEM PROMPT GENERATOR
 * Menghasilkan instruksi AI berdasarkan level pendidikan dan tipe game.
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

    case "MULTIPLE_CHOICE":
      formatInstruction = `
{
  "template": "MULTIPLE_CHOICE",
  "questions": [
    { 
      "question": "Pertanyaan", 
      "options": ["Opsi A", "Opsi B", "Opsi C", "Opsi D"], 
      "correctAnswer": "Jawaban yang benar (harus persis sama dengan salah satu opsi)" 
    }
  ]
}`;
      break;

    case "TRUE_FALSE":
      formatInstruction = `
{
  "template": "TRUE_FALSE",
  "questions": [
    { "question": "Pernyataan", "correctAnswer": true }
  ]
}`;
      break;

    case "MATCHING":
      formatInstruction = `
{
  "template": "MATCHING",
  "pairs": [
    { "leftItem": "Sisi Kiri", "rightItem": "Pasangan Kanan" }
  ]
}`;
      break;

    case "ESSAY":
      formatInstruction = `
{
  "template": "ESSAY",
  "questions": [
    { "question": "Pertanyaan Terbuka", "keywords": ["Kata Kunci 1", "Kata Kunci 2", "Kata Kunci 3"] }
  ]
}`;
      break;

    default:
      formatInstruction = `{ "error": "Template tidak dikenal" }`;

  }

  return `
Anda adalah pakar kurikulum pendidikan internasional untuk jenjang ${educationLevel}.

Tugas: Hasilkan soal kuis edukatif dalam Bahasa Indonesia untuk tipe game: ${templateType}.

⚠️ ATURAN MUTLAK:
1. Jawaban harus kata/istilah asli (contoh: FIREWALL, INTEGRITAS)
2. Dilarang mengarang kata atau typo
3. Untuk Anagram/Hangman gunakan kata asli
4. SD: bahasa sederhana, UNIVERSITY: akademik
5. Output hanya JSON

WAJIB ikuti struktur:
${formatInstruction}
`;
};

/**
 * JSON PARSER SAFETY
 */
const extractJSON = (text: string) => {
  try {
    const cleaned = text
      .replace(/```json/g, "")
      .replace(/```/g, "");

    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("JSON tidak ditemukan");

    return JSON.parse(match[0]);
  } catch (err) {
    console.error("JSON parse error:", err);
    throw new Error("Response AI tidak valid");
  }
};

/**
 * MAIN GENERATOR (HYBRID SYSTEM)
 */
export const generateQuizContent = async (
  topic: string,
  educationLevel: string,
  templateType: string,
  count: number
) => {

  console.log(`[AI] Request -> ${templateType} | ${educationLevel} | ${count}`);

  // ANAGRAM pakai service khusus
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
 */
export const generateFeedbackContent = async (
  questionText: string,
  correctAnswer: string
) => {
  const systemPrompt = `
Berikan penjelasan edukatif dan penuh semangat maksimal 100 kata dalam JSON:
{ "feedback": "..." }
`;

  const userPrompt = `
Pertanyaan: ${questionText}
Jawaban: ${correctAnswer}
`;

  try {
    const res = await getGroqResponse(systemPrompt, userPrompt);
    return extractJSON(res || "");
  } catch (err) {
    console.error(err);
    const res = await getGeminiResponse(systemPrompt, userPrompt);
    return extractJSON(res || "");
  }
};