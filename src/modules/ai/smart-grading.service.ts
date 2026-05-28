import Groq from "groq-sdk";
import { getGeminiResponse } from "./providers/gemini.provider";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// =====================================================================
// 🔍 PRE-CHECK: Deteksi jawaban tidak bermakna SEBELUM ke AI
// Mencegah AI memberi skor > 0 pada jawaban kosong/nonsense
// =====================================================================

const NONSENSE_PATTERNS = [
  /^(.)\\1{4,}$/, // Karakter berulang: "aaaaaaa", "........"
  /^[^a-zA-Z\u00C0-\u024F\u0400-\u04FF\s]{5,}$/, // Hanya simbol/angka panjang
  /^(asdf|qwer|zxcv|hjkl|uiop)/i, // Keyboard mashing patterns
  /^(.{1,3})\1{3,}$/, // Pola pendek berulang: "abababab"
];

// ✅ UPDATED: Minimum 1 kata bermakna (min 2 karakter), tanpa batas minimum karakter
const MIN_MEANINGFUL_WORDS = 1;

interface GradingResult {
  score: number;
  justification: string;
  correctAnswer: string;
  keywordsMatched: string[];
  keywordsMissing: string[];
}

/**
 * Memeriksa apakah jawaban layak dinilai AI.
 * Return null jika layak, return GradingResult langsung jika tidak layak.
 */
const preCheckAnswer = (
  studentAnswer: string,
  keywords: string[],
): GradingResult | null => {
  const trimmed = studentAnswer.trim();

  // Kosong atau hanya spasi
  if (!trimmed) {
    return {
      score: 0,
      justification: "Jawaban kosong. Tidak ada konten yang dapat dinilai.",
      correctAnswer: "",
      keywordsMatched: [],
      keywordsMissing: keywords,
    };
  }

  // Deteksi ketidaktahuan / penolakan dini untuk menghemat kuota AI
  const IGNORANCE_PATTERNS = /(tidak tahu|belum paham|tidak mengerti|no idea|don't know|kurang tahu|tidak paham|tidak tahu apa|gatau|ga tau)/i;
  if (IGNORANCE_PATTERNS.test(trimmed)) {
    return {
      score: 0,
      justification: "Jawaban terdeteksi mengekspresikan ketidaktahuan atau penolakan.",
      correctAnswer: "",
      keywordsMatched: [],
      keywordsMissing: keywords,
    };
  }

  // ✅ UPDATED: Jumlah kata bermakna minimum 1 kata (min 2 karakter)
  const wordCount = trimmed.split(/\s+/).filter((w) => w.length >= 2).length;
  if (wordCount < MIN_MEANINGFUL_WORDS) {
    return {
      score: 0,
      justification: `Jawaban tidak mengandung kata yang bermakna. Tuliskan jawabanmu dengan kata yang jelas.`,
      correctAnswer: "",
      keywordsMatched: [],
      keywordsMissing: keywords,
    };
  }

  // Pola nonsense / keyboard mashing
  const isNonsense = NONSENSE_PATTERNS.some((pattern) => pattern.test(trimmed));
  if (isNonsense) {
    return {
      score: 0,
      justification:
        "Jawaban tidak dapat dikenali sebagai teks bermakna. Pastikan kamu menjawab dengan kalimat yang jelas.",
      correctAnswer: "",
      keywordsMatched: [],
      keywordsMissing: keywords,
    };
  }

  // Rasio alfanumerik terlalu rendah (mayoritas simbol/angka acak)
  const alphaCount = (trimmed.match(/[a-zA-Z\u00C0-\u024F]/g) || []).length;
  const alphaRatio = trimmed.length > 0 ? alphaCount / trimmed.length : 0;
  if (alphaRatio < 0.4 && trimmed.length > 10) {
    return {
      score: 0,
      justification:
        "Jawaban mengandung terlalu banyak karakter non-huruf. Tuliskan jawaban dalam kalimat yang wajar.",
      correctAnswer: "",
      keywordsMatched: [],
      keywordsMissing: keywords,
    };
  }

  return null; // Lolos pre-check, lanjut ke AI
};

export class SmartGradingService {
  /**
   * Menilai jawaban essay siswa secara otomatis.
   * Versi yang diperkuat dengan pre-check anti-nonsense dan prompt AI yang lebih ketat.
   * isCorrect DIHAPUS — essay tidak bersifat benar/salah, melainkan dinilai dengan skor gradasi.
   * ✅ UPDATED: Skor bebas 0-100 (tidak terbatas kelipatan tertentu), jawaban singkat yang benar tetap dapat poin.
   */
  static async gradeEssay(
    question: string,
    keywords: string[],
    studentAnswer: string,
  ): Promise<GradingResult> {
    // ✅ Pre-check SEBELUM memanggil AI — hemat quota, hasil lebih akurat
    const preCheckResult = preCheckAnswer(studentAnswer, keywords);
    if (preCheckResult !== null) {
      console.log(
        `[Smart Grading] Pre-check gagal: skor langsung 0. Alasan: ${preCheckResult.justification}`,
      );
      return preCheckResult;
    }

    // ✅ UPDATED: Prompt menegaskan skor bebas & proporsional untuk jawaban singkat
    const prompt = `Anda adalah Evaluator Pendidikan profesional yang adil dan objektif.

PERTANYAAN: "${question}"
KATA KUNCI ACUAN (konsep yang HARUS ada): ${keywords.join(", ")}
JAWABAN SISWA: "${studentAnswer}"

TUGAS ANDA:
1. Nilai jawaban berdasarkan relevansi dengan pertanyaan dan keberadaan kata kunci
2. Berikan skor 0-100 dengan kriteria berikut:
   - 90-100: Jawaban sangat lengkap, akurat, menyebut hampir semua kata kunci dengan konteks yang tepat
   - 70-89: Jawaban baik, relevan, menyebut sebagian besar kata kunci dengan benar
   - 50-69: Jawaban cukup, ada upaya menjawab tapi kurang lengkap atau ada yang kurang tepat
   - 25-49: Jawaban ada tapi dangkal, hanya menyinggung topik tanpa penjelasan
   - 1-24: Jawaban sangat singkat namun masih relevan dengan topik — TETAP BERI POIN sesuai kualitas, JANGAN beri 0 hanya karena singkat
   - 0: Jawaban tidak relevan SAMA SEKALI dengan topik, atau berisi teks tidak bermakna

PENTING:
   - Jawaban singkat yang BENAR dan RELEVAN tetap berhak mendapat poin yang adil (contoh: jawaban 1-2 kata yang tepat bisa mendapat 10-40 poin tergantung kualitas)
   - JANGAN memberi skor tinggi jika jawaban hanya mengulangi kata-kata dari pertanyaan tanpa penjelasan
   - Skor boleh berupa angka BERAPA SAJA antara 0-100, tidak harus kelipatan tertentu
   - Nilai secara proporsional dan jujur

3. Analisis TIAP kata kunci: apakah disebut/dibahas dalam jawaban siswa?
4. Berikan feedback edukatif singkat (maks 60 kata, dalam Bahasa Indonesia)
5. Berikan contoh jawaban ideal yang lebih baik (2-3 kalimat)

OUTPUT HANYA JSON MURNI, TANPA markdown, tanpa penjelasan luar:
{
  "score": <angka 0-100>,
  "justification": "<feedback edukatif singkat max 60 kata>",
  "correctAnswer": "<contoh jawaban ideal 2-3 kalimat>",
  "keywordsMatched": ["<keyword yang benar-benar dibahas dalam jawaban>"],
  "keywordsMissing": ["<keyword yang sama sekali tidak dibahas>"]
}`;

    // 🔧 Helper parsing JSON aman
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

    // 🔧 Validasi dan normalisasi hasil dari AI
    const normalizeResult = (parsed: any): GradingResult => {
      const score = Math.max(0, Math.min(100, parseInt(parsed.score) || 0));

      // Pastikan keywordsMatched hanya berisi keyword yang memang ada di daftar acuan
      const validKeywords = keywords.map((k) => k.toLowerCase().trim());
      const rawMatched: string[] = Array.isArray(parsed.keywordsMatched)
        ? parsed.keywordsMatched
        : [];
      const keywordsMatched = rawMatched.filter((k: string) =>
        validKeywords.some(
          (vk) =>
            vk.includes(k.toLowerCase().trim()) ||
            k.toLowerCase().trim().includes(vk),
        ),
      );
      const keywordsMissing = keywords.filter(
        (k) =>
          !keywordsMatched.some(
            (m: string) =>
              m.toLowerCase().includes(k.toLowerCase()) ||
              k.toLowerCase().includes(m.toLowerCase()),
          ),
      );

      return {
        score,
        justification: parsed.justification || "Penilaian selesai.",
        correctAnswer: parsed.correctAnswer || "",
        keywordsMatched,
        keywordsMissing,
      };
    };

    try {
      console.log("[Smart Grading] Memulai penilaian melalui Groq...");

      const completion = await groq.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: "llama-3.1-8b-instant",
        temperature: 0.1, // Lebih rendah = lebih konsisten dan objektif
        response_format: { type: "json_object" },
      });

      const raw = completion.choices[0]?.message?.content || "{}";
      const parsedResult = safeParse(raw);

      if (!parsedResult || typeof parsedResult.score === "undefined") {
        throw new Error("Invalid JSON from Groq");
      }

      const result = normalizeResult(parsedResult);
      console.log(`[Smart Grading] Groq Berhasil ✅ - Skor: ${result.score}`);
      return result;
    } catch (error: any) {
      console.warn("[Smart Grading] Groq kendala. Mengalihkan ke Gemini...");

      try {
        const geminiRes = await getGeminiResponse(
          "Anda adalah Evaluator Pendidikan. Jawab HANYA dalam format JSON murni tanpa markdown.",
          prompt,
        );

        const parsedResult = safeParse(geminiRes);

        if (!parsedResult || typeof parsedResult.score === "undefined") {
          throw new Error("Invalid JSON from Gemini");
        }

        const result = normalizeResult(parsedResult);
        console.log(
          `[Smart Grading] Gemini Berhasil ✅ - Skor: ${result.score}`,
        );
        return result;
      } catch (fallbackError: any) {
        console.error("❌ [Smart Grading Critical]: Seluruh provider gagal. Mengaktifkan sistem fallback kata kunci lokal...");

        const cleanAnswer = studentAnswer.toLowerCase().trim();
        const IGNORANCE_PATTERNS = /(tidak tahu|belum paham|tidak mengerti|no idea|don't know|kurang tahu|tidak paham|tidak tahu apa)/i;

        const matched = keywords.filter((kw) => {
          const cleanKw = kw.toLowerCase().trim();
          return cleanAnswer.includes(cleanKw);
        });
        const missing = keywords.filter((kw) => !matched.includes(kw));

        const matchedCount = matched.length;
        const totalKeywords = keywords.length;
        let fallbackScore =
          totalKeywords > 0
            ? Math.round((matchedCount / totalKeywords) * 100)
            : 50;

        let justification = `[Sistem Fallback] Kuis Anda berhasil dinilai berdasarkan pencocokan kata kunci (${matchedCount}/${totalKeywords} kata kunci ditemukan).`;

        if (IGNORANCE_PATTERNS.test(cleanAnswer)) {
          fallbackScore = 0;
          justification = `[Sistem Fallback] Jawaban terdeteksi mengekspresikan ketidaktahuan/penolakan (skor langsung 0).`;
        }

        return {
          score: fallbackScore,
          justification,
          correctAnswer: "Silakan tinjau kembali materi kuliah untuk jawaban ideal selengkapnya.",
          keywordsMatched: matched,
          keywordsMissing: missing,
        };
      }
    }
  }
}
