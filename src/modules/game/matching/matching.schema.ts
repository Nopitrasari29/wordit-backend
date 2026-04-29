import { z } from "zod";

export const MatchingContentSchema = z.object({
    template: z.literal("MATCHING"),
    pairs: z.array(z.object({
        leftItem: z.string().min(1, "Item sebelah kiri wajib diisi"),
        rightItem: z.string().min(1, "Item sebelah kanan wajib diisi"),
    })),
}).passthrough();