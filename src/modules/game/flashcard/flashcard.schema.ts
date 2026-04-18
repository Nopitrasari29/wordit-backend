import { z } from "zod";

export const FlashcardContentSchema = z.object({
  template: z.literal("FLASHCARD"),
  cards: z.array(z.object({ 
    front: z.string().min(1, "Sisi depan kartu wajib ada"), 
    back: z.string().min(1, "Sisi belakang kartu wajib ada") 
  })),
}).passthrough();