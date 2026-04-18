import { z } from "zod";

export const SpinTheWheelContentSchema = z.object({
  template: z.literal("SPIN_THE_WHEEL"),
  questions: z.array(z.object({
    question: z.string().min(1, "Pertanyaan wajib ada"),
    answer: z.string().min(1, "Jawaban wajib diisi"),
  })),
}).passthrough();