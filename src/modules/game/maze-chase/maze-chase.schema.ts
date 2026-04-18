import { z } from "zod";

export const MazeChaseContentSchema = z.object({
  template: z.literal("MAZE_CHASE"),
  questions: z.array(z.object({ 
    question: z.string().min(1, "Pertanyaan wajib ada"), 
    answer: z.string().min(1, "Jawaban wajib diisi")
  })),
}).passthrough();