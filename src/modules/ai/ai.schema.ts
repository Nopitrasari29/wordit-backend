import { z } from "zod";

export const generateQuizSchema = z.object({
  topic: z.string().min(10, "Materi terlalu pendek, minimal 10 karakter"),
  // ✅ REVISI: Sinkron dengan EducationLevelEnum global
  educationLevel: z.enum(["SD", "SMP", "SMA", "UNIVERSITY"]),
  // ✅ TAMBAHKAN INI: Agar AI tahu mau bikin game apa
  templateType: z.enum(["ANAGRAM", "FLASHCARD", "HANGMAN", "MAZE_CHASE", "SPIN_THE_WHEEL", "WORD_SEARCH"]),
  count: z.number().min(1).max(15).default(5),
});

export type GenerateQuizInput = z.infer<typeof generateQuizSchema>;