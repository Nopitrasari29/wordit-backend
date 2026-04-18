import { getGroqResponse } from "./providers/groq.provider";
import { getGeminiResponse } from "./providers/gemini.provider";
import { TemplateType } from "@prisma/client";

/**
 * 🎯 REVISI: Prompt dinamis sesuai Template Type (Paten & Sinkron)
 */
const getSystemPrompt = (educationLevel: string, templateType: string): string => {
  let formatInstruction = "";

  // Sesuaikan instruksi format berdasarkan tipe game
  switch (templateType) {
    case "ANAGRAM":
    case "HANGMAN":
    case "WORD_SEARCH":
      formatInstruction = `
      Struktur JSON (Array of Object):
      {
        "template": "${templateType}",
        "words": [
          { "word": "KATA_JAWABAN", "hint": "Petunjuk terkait kata tersebut" }
        ]
      }`;
      break;
    case "FLASHCARD":
      formatInstruction = `
      Struktur JSON (Array of Object):
      {
        "template": "FLASHCARD",
        "cards": [
          { "front": "Istilah/Pertanyaan", "back": "Definisi/Jawaban" }
        ]
      }`;
      break;
    default: // MAZE_CHASE & SPIN_THE_WHEEL
      formatInstruction = `
      Struktur JSON (Array of Object):
      {
        "template": "${templateType}",
        "questions": [
          { "question": "Pertanyaan kuis", "answer": "Jawaban benar" }
        ]
      }`;
  }

  return `Anda adalah pakar pendidikan untuk jenjang ${educationLevel}.
Tugas Anda adalah menghasilkan 5 soal kuis edukatif dalam Bahasa Indonesia untuk tipe game: ${templateType}.

Ketentuan Khusus berdasarkan Jenjang:
1. SD: Bahasa sederhana, ramah anak, contoh konkret.
2. SMP/SMA: Bahasa formal-edukatif, tingkat kesulitan menengah.
3. UNIVERSITY: Terminologi akademik lanjut dan analisis kritis.

WAJIB ikuti struktur JSON ini (HANYA JSON, jangan ada teks lain):
${formatInstruction}

Jawab HANYA JSON valid.`;
};

const getFeedbackPrompt = (): string => {
  return `Berikan penjelasan maksimal 100 kata mengenai konsep jawaban yang benar.
Gunakan nada bicara yang menyemangati siswa.
Output JSON: { "feedback": "..." }

Jawab HANYA JSON valid.`;
};

const extractJSON = (text: string) => {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("JSON tidak ditemukan dalam response AI");
  return JSON.parse(match[0]);
};

export const generateQuizContent = async (
  topic: string,
  educationLevel: string,
  templateType: string
) => {
  const systemPrompt = getSystemPrompt(educationLevel, templateType);
  const userPrompt = `Topik/Materi Kuis: ${topic}`;

  try {
    const result = await getGroqResponse(systemPrompt, userPrompt);
    console.log("[AI System]: Menggunakan Groq (Utama) ✅");
    return JSON.parse(result!);
  } catch (error) {
    console.warn("[AI System]: Groq gagal, mengalihkan ke Gemini (Fallback)... 🔄");
    try {
      const res = await getGeminiResponse(systemPrompt, userPrompt);
      return extractJSON(res);
    } catch (err) {
      console.error("[AI System]: Seluruh provider gagal.");
      throw err;
    }
  }
};

export const generateFeedbackContent = async (
  questionText: string,
  correctAnswer: string
) => {
  const systemPrompt = getFeedbackPrompt();
  const userPrompt = `Pertanyaan: ${questionText}\nJawaban yang benar: ${correctAnswer}`;

  try {
    const result = await getGroqResponse(systemPrompt, userPrompt);
    return JSON.parse(result!);
  } catch (error) {
    try {
      const res = await getGeminiResponse(systemPrompt, userPrompt);
      return extractJSON(res);
    } catch (err) {
      throw err;
    }
  }
};