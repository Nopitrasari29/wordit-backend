import { z } from "zod";

export const MultipleChoiceContentSchema = z.object({
    template: z.literal("MULTIPLE_CHOICE"),
    questions: z.array(z.object({
        question: z.string().min(1, "Pertanyaan wajib diisi"),
        options: z.array(z.string()).length(4, "Pilihan ganda harus berjumlah 4 opsi"),
        correctAnswer: z.string().min(1, "Kunci jawaban wajib dipilih"),
    })),
}).passthrough();