import { z } from "zod";
import { HangmanContentSchema } from "./hangman/hangman.schema";
import { AnagramContentSchema } from "./anagram/anagram.schema";
import { FlashcardContentSchema } from "./flashcard/flashcard.schema";
import { MazeChaseContentSchema } from "./maze-chase/maze-chase.schema";
import { WordSearchContentSchema } from "./word-search/word-search.schema";
import { SpinTheWheelContentSchema } from "./spin-the-wheel/spin-the-wheel.schema";

// ============================================================
// SPRINT 3: STANDARD ASSESSMENT SCHEMAS (NEW)
// ============================================================

import { MultipleChoiceContentSchema } from "./multiple-choice/multiple-choice.schema";
import { TrueFalseContentSchema } from "./true-false/true-false.schema";
import { MatchingContentSchema } from "./matching/matching.schema";
import { EssayContentSchema } from "./essay/essay.schema";

export { 
  MultipleChoiceContentSchema, 
  TrueFalseContentSchema, 
  MatchingContentSchema, 
  EssayContentSchema 
};




// --- ENUMS ---
// Enum ini disesuaikan dengan skema database Prisma
export const TemplateTypeEnum = z.enum([
  "ANAGRAM", "FLASHCARD", "HANGMAN", "MAZE_CHASE", "SPIN_THE_WHEEL", "WORD_SEARCH",
  // ✅ Penambahan 4 Template Baru
  "MULTIPLE_CHOICE", "TRUE_FALSE", "MATCHING", "ESSAY"
]);
export const EducationLevelEnum = z.enum(["SD", "SMP", "SMA", "UNIVERSITY"]);
export const DifficultyLevelEnum = z.enum(["EASY", "MEDIUM", "HARD"]);

// --- MERGED GAME JSON SCHEMA ---
// Menggunakan discriminatedUnion agar Zod tahu skema mana yang dipakai berdasarkan field 'template'
const GameJsonSchema = z.discriminatedUnion("template", [
  FlashcardContentSchema,
  HangmanContentSchema,
  WordSearchContentSchema,
  AnagramContentSchema,
  MazeChaseContentSchema,
  SpinTheWheelContentSchema,
  // ✅ Penambahan 4 Schema Baru ke dalam Union
  MultipleChoiceContentSchema,
  TrueFalseContentSchema,
  MatchingContentSchema,
  EssayContentSchema,
]);

// --- CRUD SCHEMAS ---
export const createGameSchema = z.object({
  title: z.string().min(3, "Judul kuis minimal 3 karakter"),
  description: z.string().max(255).optional(),
  templateType: TemplateTypeEnum,
  educationLevel: EducationLevelEnum,
  difficulty: DifficultyLevelEnum.default("MEDIUM"),
  thumbnailUrl: z.string().optional(),
  // ✅ Penambahan field ini memperbaiki error 'Property does not exist' di game.service.ts
  isPublished: z.boolean().default(false).optional(),
  gameJson: GameJsonSchema,
}).passthrough(); // ✅ Mengizinkan field tambahan dari FE agar tidak memicu 400 Bad Request

export const updateGameSchema = createGameSchema.partial();

export const gameQuerySchema = z.object({
  educationLevel: EducationLevelEnum.optional(),
  templateType: TemplateTypeEnum.optional(),
  search: z.string().optional(),
  page: z.string().default("1"),
  limit: z.string().default("10"),
});

// --- SPRINT 2: SUBMIT ANSWER SCHEMA ---
export const submitAnswerSchema = z.object({
  answers: z.array(z.any()).optional(),
  timeSpent: z.number().min(0).optional(),
  accuracy: z.number().min(0).max(100).optional(),
  questionIndex: z.number(),
  selectedAnswer: z.any(),
  earnedPoints: z.number().optional(),
});


export type CreateGameInput = z.infer<typeof createGameSchema>;
export type UpdateGameInput = z.infer<typeof updateGameSchema>;
export type GameQueryInput = z.infer<typeof gameQuerySchema>;