import { z } from "zod"

// ─── SHARED ENUMS ───────────────────────────────────────────────────
// Kita definisikan di sini agar bisa dipakai ulang di create & query
const TemplateTypeEnum = z.enum([
  "ANAGRAM",
  "FLASHCARD",
  "HANGMAN",
  "MAZE_CHASE",
  "SPIN_THE_WHEEL",
  "WORD_SEARCH",
])

const EducationLevelEnum = z.enum(["SD", "SMP", "SMA", "UNIVERSITY"]); 
const DifficultyLevelEnum = z.enum(["EASY", "MEDIUM", "HARD"]);
// ─── SCHEMAS ────────────────────────────────────────────────────────

export const createGameSchema = z.object({
  title: z.string().min(3, "Judul minimal 3 karakter"),
  description: z.string().max(255, "Deskripsi terlalu panjang").optional(),
  templateType: TemplateTypeEnum, // ✅ Menggunakan 6 template Golden Six
  educationLevel: EducationLevelEnum,
  difficulty: DifficultyLevelEnum.default("MEDIUM"),
  
  // gameJson divalidasi sebagai object fleksibel sesuai kebutuhan template
  gameJson: z.record(z.string(), z.unknown()).refine((data) => Object.keys(data).length > 0, {
    message: "Konten game (soal) tidak boleh kosong",
  }),
})

// Update schema adalah versi parsial dari create schema
export const updateGameSchema = createGameSchema.partial()

// Schema untuk validasi filter/query di URL
export const gameQuerySchema = z.object({
  educationLevel: EducationLevelEnum.optional(),
  templateType: TemplateTypeEnum.optional(), // ✅ Sekarang tervalidasi ketat
  search: z.string().optional(),
  page: z.string().default("1"),
  limit: z.string().default("12"),
})

// ─── TYPES ──────────────────────────────────────────────────────────

export type CreateGameInput = z.infer<typeof createGameSchema>
export type UpdateGameInput = z.infer<typeof updateGameSchema>
export type GameQueryInput = z.infer<typeof gameQuerySchema>