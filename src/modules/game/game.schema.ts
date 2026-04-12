import { z } from "zod"

export const createGameSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().optional(),
  templateType: z.enum([
    "QUIZ",
    "TRUE_OR_FALSE",
    "FLASHCARD",
    "MATCHING_PAIR",
    "WORD_SEARCH",
    "SHORT_ANSWER",
    "HANGMAN",
  ]),
  educationLevel: z.enum(["SD", "SMP_SMA", "UNIVERSITY"]),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).default("MEDIUM"),
  gameJson: z.record(z.string(), z.unknown()),
})

export const updateGameSchema = createGameSchema.partial()

export const gameQuerySchema = z.object({
  educationLevel: z.enum(["SD", "SMP_SMA", "UNIVERSITY"]).optional(),
  templateType: z.string().optional(),
  search: z.string().optional(),
  page: z.string().default("1"),
  limit: z.string().default("12"),
})

export type CreateGameInput = z.infer<typeof createGameSchema>
export type UpdateGameInput = z.infer<typeof updateGameSchema>
export type GameQueryInput = z.infer<typeof gameQuerySchema>