import { getGroqResponse } from "./providers/groq.provider";
import { getGeminiResponse } from "./providers/gemini.provider";

/**
 * Mendefinisikan instruksi sistem agar AI "sadar" akan perbedaan jenjang pendidikan.
 * Memenuhi kriteria AI-03 (Education Level Awareness).
 */
const getSystemPrompt = (educationLevel: string, templateType: string): string => {
  return `Anda adalah pakar pendidikan untuk jenjang ${educationLevel}.
Tugas Anda adalah menghasilkan 5 soal kuis edukatif dalam Bahasa Indonesia untuk tipe game: ${templateType}.

Ketentuan Khusus berdasarkan Jenjang:
1. SD (Sekolah Dasar): Gunakan bahasa yang sederhana, ramah anak, dan contoh dari kehidupan sehari-hari.
2. SMP_SMA (Sekolah Menengah): Gunakan bahasa formal-edukatif dengan tingkat kesulitan menengah.
3. UNIVERSITY (Perguruan Tinggi): Gunakan terminologi akademik tingkat lanjut, teori mendalam, dan analisis kritis.

Struktur JSON WAJIB (Jangan berikan teks penjelasan, HANYA JSON):
{
  "questions": [
    {
      "question": "pertanyaan",
      "options": {
        "A": "pilihan A",
        "B": "pilihan B",
        "C": "pilihan C",
        "D": "pilihan D"
      },
      "answer": "A/B/C/D"
    }
  ]
}

Jawab HANYA JSON valid.`;
};

const getFeedbackPrompt = (): string => {
  return `Berikan penjelasan maksimal 100 kata mengenai konsep jawaban yang benar.
Gunakan nada bicara yang menyemangati siswa.
Output JSON: { "feedback": "..." }

Jawab HANYA JSON valid.`;
};

// 🔥 JSON extractor anti error AI (sangat penting untuk kestabilan sistem)
const extractJSON = (text: string) => {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("JSON tidak ditemukan dalam response AI");
  return JSON.parse(match[0]);
};

/**
 * FUNGSI GENERATOR KUIS (AI-01, AI-02, AI-03)
 */
export const generateQuizContent = async (
  topic: string,
  educationLevel: string,
  templateType: string
) => {
  const systemPrompt = getSystemPrompt(educationLevel, templateType);
  const userPrompt = `Topik Kuis: ${topic}`;

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
      console.error("[AI System]: Seluruh provider gagal memproses permintaan.");
      throw err;
    }
  }
};

/**
 * FUNGSI FEEDBACK (AI-04)
 */
export const generateFeedbackContent = async (
  questionText: string,
  correctAnswer: string
) => {
  const systemPrompt = getFeedbackPrompt();
  const userPrompt = `Pertanyaan: ${questionText}\nJawaban yang benar: ${correctAnswer}`;

  try {
    const result = await getGroqResponse(systemPrompt, userPrompt);
    console.log("[AI System]: Feedback berhasil via Groq ✅");
    return JSON.parse(result!);
  } catch (error) {
    console.warn("[AI System]: Groq gagal, fallback Gemini untuk feedback... 🔄");

    try {
      const res = await getGeminiResponse(systemPrompt, userPrompt);
      return extractJSON(res);
    } catch (err) {
      console.error("[AI System]: Gagal mendapatkan feedback.");
      throw err;
    }
  }
};