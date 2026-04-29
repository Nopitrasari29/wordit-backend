import { z } from "zod";

export const TrueFalseContentSchema = z.object({
    template: z.literal("TRUE_FALSE"),
    questions: z.array(z.object({
        question: z.string().min(1, "Pernyataan wajib diisi"),
        // ✅ FIX: Ganti 'required_error' menjadi 'message' sesuai versi Zod kamu
        correctAnswer: z.boolean({ message: "Kunci jawaban (Benar/Salah) wajib ditentukan" }),
    })),
}).passthrough();