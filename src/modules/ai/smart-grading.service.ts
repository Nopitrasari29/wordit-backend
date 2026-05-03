import Groq from "groq-sdk";
import { getGeminiResponse } from "./providers/gemini.provider";

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
});

export class SmartGradingService {
    /**
     * Menilai jawaban essay siswa secara otomatis dengan strategi Dual-Provider Fallback.
     * Versi ini sudah di-upgrade menjadi AI Teacher (bukan hanya grader).
     */
    static async gradeEssay(
        question: string,
        keywords: string[],
        studentAnswer: string
    ): Promise<{
        score: number;
        justification: string;
        correctAnswer: string;
        isCorrect: boolean;
        keywordsMatched: string[];
        keywordsMissing: string[];
    }> {

        const prompt = `
Anda adalah Pakar Evaluasi Pendidikan sekaligus Guru.

Tugas Anda:
1. Berikan skor (0-100)
2. Tentukan apakah jawaban benar
3. Berikan feedback singkat (maks 50 kata)
4. Berikan jawaban yang benar (ideal answer)
5. Analisis keyword yang cocok dan yang belum disebut

PERTANYAAN: "${question}"
KATA KUNCI ACUAN: ${keywords.join(", ")}
JAWABAN MAHASISWA: "${studentAnswer}"

KRITERIA:
- 85-100: Akurat & lengkap
- 60-84: Cukup benar tapi kurang lengkap
- 1-59: Terlalu singkat / tidak jelas
- 0: Salah total

OUTPUT WAJIB JSON VALID TANPA PENJELASAN TAMBAHAN:

{
  "score": number,
  "isCorrect": boolean,
  "justification": "string",
  "correctAnswer": "string",
  "keywordsMatched": string[],
  "keywordsMissing": string[]
}
`;

        // 🔧 Helper untuk parsing JSON aman
        const safeParse = (text: string) => {
            try {
                return JSON.parse(text);
            } catch {
                const start = text.indexOf("{");
                const end = text.lastIndexOf("}") + 1;
                if (start !== -1 && end !== -1) {
                    try {
                        return JSON.parse(text.substring(start, end));
                    } catch {
                        return null;
                    }
                }
                return null;
            }
        };

        try {
            console.log("[Smart Grading] Memulai penilaian melalui Groq...");

            const completion = await groq.chat.completions.create({
                messages: [{ role: "user", content: prompt }],
                model: "llama-3.1-8b-instant",
                temperature: 0.2,
                response_format: { type: "json_object" },
            });

            const raw = completion.choices[0]?.message?.content || "{}";
            const parsedResult = safeParse(raw);

            if (!parsedResult) throw new Error("Invalid JSON from Groq");

            console.log(`[Smart Grading] Groq Berhasil ✅ - Skor: ${parsedResult.score}`);

            return {
                score: parsedResult.score ?? 0,
                justification: parsedResult.justification ?? "",
                correctAnswer: parsedResult.correctAnswer ?? "",
                isCorrect: parsedResult.isCorrect ?? false,
                keywordsMatched: parsedResult.keywordsMatched ?? [],
                keywordsMissing: parsedResult.keywordsMissing ?? keywords,
            };

        } catch (error: any) {
            console.warn("[Smart Grading] Groq mengalami kendala. Mengalihkan ke Gemini...");

            try {
                const geminiRes = await getGeminiResponse(
                    "Anda adalah Pakar Evaluasi Pendidikan. Jawab HANYA dalam format JSON murni.",
                    prompt
                );

                const parsedResult = safeParse(geminiRes);

                if (!parsedResult) throw new Error("Invalid JSON from Gemini");

                console.log(`[Smart Grading] Gemini Berhasil ✅ - Skor: ${parsedResult.score}`);

                return {
                    score: parsedResult.score ?? 0,
                    justification: parsedResult.justification ?? "",
                    correctAnswer: parsedResult.correctAnswer ?? "",
                    isCorrect: parsedResult.isCorrect ?? false,
                    keywordsMatched: parsedResult.keywordsMatched ?? [],
                    keywordsMissing: parsedResult.keywordsMissing ?? keywords,
                };

            } catch (fallbackError: any) {
                console.error("❌ [Smart Grading Critical]: Seluruh provider gagal.");

                return {
                    score: 0,
                    justification: "Layanan penilaian AI sedang sibuk. Silakan coba lagi.",
                    correctAnswer: "",
                    isCorrect: false,
                    keywordsMatched: [],
                    keywordsMissing: keywords,
                };
            }
        }
    }
}