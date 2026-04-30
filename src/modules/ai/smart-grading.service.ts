import Groq from "groq-sdk";
import { getGeminiResponse } from "./providers/gemini.provider"; // ✅ WAJIB DIIMPORT

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
});

export class SmartGradingService {
    /**
     * Menilai jawaban essay siswa secara otomatis dengan strategi Dual-Provider Fallback.
     * Target akurasi > 85% melalui optimasi prompt (AI-07 & AI-08).
     */
    static async gradeEssay(
        question: string,
        keywords: string[],
        studentAnswer: string
    ): Promise<{ score: number; justification: string }> {
        // Pembuatan instruksi penilaian yang mendalam
        const prompt = `
        Anda adalah Pakar Evaluasi Pendidikan. Tugas Anda menilai jawaban esai mahasiswa.
        
        PERTANYAAN: "${question}"
        KATA KUNCI ACUAN: ${keywords.join(", ")}
        JAWABAN MAHASISWA: "${studentAnswer}"

        KRITERIA SKOR (0-100):
        - 85-100: Akurat, lengkap, dan logis.
        - 60-84: Benar secara umum, namun ada poin kunci terlewat.
        - 1-59: Terlalu singkat atau hanya menyebut kata kunci tanpa konteks.
        - 0: Salah total atau tidak relevan.

        OUTPUT WAJIB JSON:
        { "score": number, "justification": "Penjelasan singkat max 50 kata" }
        `;

        try {
            console.log("[Smart Grading] Memulai penilaian melalui Groq...");

            const completion = await groq.chat.completions.create({
                messages: [{ role: "user", content: prompt }],
                model: "llama-3.1-8b-instant", 
                temperature: 0.2,
                response_format: { type: "json_object" },
            });

            const parsedResult = JSON.parse(completion.choices[0]?.message?.content || "{}");
            console.log(`[Smart Grading] Groq Berhasil ✅ - Skor: ${parsedResult.score}`);

            return {
                score: parsedResult.score || 0,
                justification: parsedResult.justification || "Berhasil dinilai.",
            };

        } catch (error: any) {
            // 🔄 IMPLEMENTASI FALLBACK KE GEMINI (AI-02)
            console.warn("[Smart Grading] Groq mengalami kendala. Mengalihkan ke Gemini...");
            
            try {
                // Memanggil provider cadangan
                const geminiRes = await getGeminiResponse(
                    "Anda adalah Pakar Evaluasi Pendidikan. Jawab HANYA dalam format JSON murni.",
                    prompt
                );
                
                // Ekstraksi JSON dari string respons Gemini
                const start = geminiRes.indexOf('{');
                const end = geminiRes.lastIndexOf('}') + 1;
                const parsedResult = JSON.parse(geminiRes.substring(start, end));
                
                console.log(`[Smart Grading] Gemini Berhasil ✅ - Skor: ${parsedResult.score}`);

                return {
                    score: parsedResult.score || 0,
                    justification: parsedResult.justification || "Dinilai melalui sistem cadangan.",
                };

            } catch (fallbackError: any) {
                console.error("❌ [Smart Grading Critical]: Seluruh provider gagal.");
                return {
                    score: 0,
                    justification: "Layanan penilaian AI sedang sibuk. Silakan coba beberapa saat lagi.",
                };
            }
        }
    }
}