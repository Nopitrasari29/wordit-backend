import { z } from "zod";

export const generateQuizSchema = z.object({
  topic: z.string().min(10, "Materi terlalu pendek, minimal 10 karakter"),
  educationLevel: z.enum(["SD", "SMP_SMA", "UNIVERSITY"]),
  count: z.number().min(1).max(15).default(10),
});

export type GenerateQuizInput = z.infer<typeof generateQuizSchema>;