import { z } from "zod";

export const EssayContentSchema = z.object({
    template: z.literal("ESSAY"),
    gradingMode: z.enum(["AI", "KEYWORD"]).default("AI").optional(),
    questions: z.array(z.object({
        question: z.string().min(1, "Pertanyaan wajib diisi"),
        keywords: z.array(z.string()).min(1, "Minimal harus ada 1 kata kunci untuk panduan AI"),
        answer: z.string().optional(),
        hint: z.string().optional(),
    })),
}).passthrough();