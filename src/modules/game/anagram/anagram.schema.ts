import { z } from "zod";

export const AnagramContentSchema = z.object({
  template: z.literal("ANAGRAM"),
  words: z.array(z.object({
    word: z.string().min(1, "Kata wajib ada"),
    hint: z.string().min(1, "Hint wajib diisi"),
  })),
}).passthrough();