import Groq from "groq-sdk";

// Inisialisasi Groq (Pastikan GROQ_API_KEY sudah ada di .env)
const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
});

export class SmartGradingService {
    /**
     * Menilai jawaban essay siswa menggunakan AI.
     * @param question Pertanyaan essay
     * @param keywords Kata kunci acuan penilaian
     * @param studentAnswer Jawaban yang diinputkan siswa
     * @returns Object berisi { score, justification }
     */
    static async gradeEssay(
        question: string,
        keywords: string[],
        studentAnswer: string
    ): Promise<{ score: number; justification: string }> {
        try {
            // =====================================================================
            // 🤖 AREA CANTIKA (AI PROMPT ENGINEERING)
            // Cantika bisa memodifikasi prompt di bawah ini untuk tuning akurasi.
            // Pastikan response_format tetap JSON agar Backend tidak error.
            // =====================================================================
            const prompt = `
        Kamu adalah seorang guru ahli yang bertugas menilai jawaban esai siswa secara objektif.
        
        Pertanyaan: "${question}"
        Kata Kunci / Poin Penting yang Diharapkan: ${keywords.join(", ")}
        Jawaban Siswa: "${studentAnswer}"

        Tugasmu:
        1. Berikan nilai dari skala 0 hingga 100 berdasarkan kelengkapan jawaban dan kesesuaian dengan kata kunci.
        2. Berikan penjelasan singkat (justifikasi) maksimal 50 kata mengapa siswa mendapatkan nilai tersebut.
        
        Keluarkan hasil HANYA dalam format JSON persis seperti ini tanpa markdown atau teks tambahan:
        {
          "score": 85,
          "justification": "Jawaban sudah mencakup sebagian besar kata kunci dengan pemahaman yang baik, namun kurang menjelaskan detail X."
        }
      `;

            // Memanggil API Groq
            const completion = await groq.chat.completions.create({
                messages: [{ role: "user", content: prompt }],
                model: "mixtral-8x7b-32768", // Model bisa diganti oleh Cantika nanti
                temperature: 0.2, // Temperature rendah agar konsisten
                response_format: { type: "json_object" }, // Wajib agar AI selalu me-return JSON
            });

            // Parsing respons AI
            const aiResponse = completion.choices[0]?.message?.content || "{}";
            const parsedResult = JSON.parse(aiResponse);

            return {
                score: parsedResult.score || 0,
                justification: parsedResult.justification || "Gagal mendapatkan justifikasi dari AI.",
            };
        } catch (error) {
            console.error("❌ Smart Grading Error:", error);
            // Fallback aman jika API Groq sedang limit atau down
            return {
                score: 0,
                justification: "Sistem AI sedang sibuk. Jawaban akan dinilai manual oleh Guru.",
            };
        }
    }
}