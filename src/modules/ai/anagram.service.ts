import { getGroqResponse } from "./providers/groq.provider";
import { getGeminiResponse } from "./providers/gemini.provider";

type AnagramWord = {
  word: string;
  hint: string;
};

type AnagramResponse = {
  template: "ANAGRAM";
  words: AnagramWord[];
};

const extractJSON = (text: string): any => {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("JSON tidak ditemukan");
  return JSON.parse(match[0]);
};

const getLimit = (level: string): number => {
  if (level === "SD") return 7;
  if (level === "SMP") return 10;
  if (level === "SMA") return 10;
  return 99;
};

const isRealWord = (word: string): boolean => {
  if (!word) return false;

  const w = word.toUpperCase();

  if (/[BCDFGHJKLMNPQRSTVWXYZ]{5,}/.test(w)) return false;
  if (/(.)\1{3,}/.test(w)) return false;
  if (!/[AIUEO]/.test(w)) return false;
  if (w.length < 3) return false;

  return true;
};

const isValidWord = (word: string, limit: number): boolean => {
  if (!word) return false;

  const w = word.toUpperCase();

  if (w.length < 3 || w.length > limit) return false;
  if (!/^[A-Z]+$/.test(w)) return false;

  return isRealWord(w);
};

const isValidHint = (hint: string): boolean => {
  if (!hint) return false;
  if (hint.length < 20) return false;

  const banned = [
    "tidak diketahui",
    "tidak jelas",
    "hewan yang memiliki kaki panjang",
    "hewan yang dapat menyelam"
  ];

  return !banned.some(b =>
    hint.toLowerCase().includes(b)
  );
};

const isGoodEnough = (words: AnagramWord[], count: number): boolean => {
  if (!words || words.length < count) return false;

  const unique = new Set(words.map(w => w.word.toUpperCase()));
  if (unique.size < count) return false;

  return words.every(w =>
    isValidHint(w.hint)
  );
};

const buildPrompt = (
  topic: string,
  count: number,
  limit: number,
  level: string
): string => {
  return `
Buat ${count} kata Bahasa Indonesia tentang: ${topic}

LEVEL: ${level}

ATURAN KATA (WAJIB):
1. Gunakan kata Bahasa Indonesia yang BENAR dan UMUM (sesuai KBBI)
2. Boleh juga menggunakan kata sehari hari
3. HARUS kata utuh (tidak boleh dipotong, tidak boleh singkatan)
4. Jika kata terlalu panjang → GANTI kata lain (JANGAN DIPAKSA DIPOTONG)
5. Hanya gunakan kata benda nyata (objek yang bisa dibayangkan)
6. Semua kata harus relevan dengan topik
7. Maksimal ${limit} huruf (batas ini hanya seleksi, bukan alasan memotong kata)

REKOMENDASI LEVEL KESULITAN:
- SD (≤7 huruf): kata sangat sederhana, mudah dan umum
- SMP (≤7 huruf): kata umum sehari-hari
- SMA (≤10 huruf): kata umum sampai sedikit kompleks
- Kuliah: bebas (tanpa batas ketat)

ATURAN HINT:
- Informatif dan edukatif
- 1 kalimat saja
- Minimal 20 karakter
- Harus sesuai kata
- Boleh menjelaskan fungsi, ciri ciri, atau pengetahuan umum
- HINT HARUS FAKTUAL DAN BENAR SECARA ILMIAH
- DILARANG MENAMBAHKAN INFORMASI YANG TIDAK BENAR
- JIKA TIDAK YAKIN, GUNAKAN DESKRIPSI UMUM YANG AMAN

OUTPUT HANYA JSON:
{
  "template": "ANAGRAM",
  "words": [
    {
      "word": "IKAN",
      "hint": "Hewan air yang hidup di sungai dan laut serta menjadi sumber makanan manusia"
    }
  ]
}
`;
};

export const generateAnagram = async (
  topic: string,
  educationLevel: string,
  count: number
): Promise<AnagramResponse> => {

  const limit = getLimit(educationLevel);

  const systemPrompt = buildPrompt(topic, count, limit, educationLevel);
  const userPrompt = `Topik: ${topic}`;

  let result: AnagramResponse | null = null;
  let attempts = 0;

  while (attempts < 4) {
    try {
      const res = await getGroqResponse(systemPrompt, userPrompt);
      const data = extractJSON(res || "");

      let words: AnagramWord[] =
        data.words?.filter((w: AnagramWord) =>
          isValidWord(w.word, limit)
        ) || [];

      const map = new Map<string, AnagramWord>();

      words.forEach((w: AnagramWord) => {
        const key = w.word.toUpperCase();
        if (!map.has(key)) map.set(key, w);
      });

      words = Array.from(map.values());

      if (isGoodEnough(words, count)) {
        result = {
          template: "ANAGRAM",
          words: words.slice(0, count).map(w => ({
            word: w.word.toUpperCase(),
            hint: w.hint
          }))
        };
        break;
      }
    } catch {}

    attempts++;
  }

  if (!result) {
    try {
      const res = await getGeminiResponse(systemPrompt, userPrompt);
      const data = extractJSON(res || "");

      let words: AnagramWord[] =
        data.words?.filter((w: AnagramWord) =>
          isValidWord(w.word, limit)
        ) || [];

      const map = new Map<string, AnagramWord>();

      words.forEach((w: AnagramWord) => {
        const key = w.word.toUpperCase();
        if (!map.has(key)) map.set(key, w);
      });

      words = Array.from(map.values());

      result = {
        template: "ANAGRAM",
        words: words.slice(0, count).map(w => ({
          word: w.word.toUpperCase(),
          hint: w.hint
        }))
      };
    } catch {
      throw new Error("Gagal generate anagram");
    }
  }

  return result;
};