import { z } from "zod";

export const HangmanContentSchema = z.object({
  template: z.literal("HANGMAN"),
  words: z.array(z.object({
    word: z.string().min(1, "Kata wajib ada"),
    hint: z.string().min(1, "Hint wajib diisi"),
  })),
}).passthrough();