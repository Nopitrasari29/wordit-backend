import { z } from "zod"
import { EducationLevel } from "@prisma/client"

export const updateUserSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").optional(),
  email: z.string().email("Invalid email format").optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8, "Password must be at least 8 characters").optional(),
  bio: z.string().max(500, "Bio cannot exceed 500 characters").optional(),

  // 🛠️ FIX UTAMA: Daftarkan properti educationLevels agar lolos dari pembuangan Zod safeParse
  educationLevels: z
    .preprocess((val) => {
      // Jika data masuk sebagai string teks (imbas FormData dari frontend), parse kembali menjadi array asli
      if (typeof val === "string") {
        try {
          return JSON.parse(val);
        } catch {
          return val;
        }
      }
      return val;
    }, z.array(z.nativeEnum(EducationLevel)))
    .optional(),

  // ✅ FIX KRITIS: Daftarkan phoneNumber & schoolOrigin agar tidak dibuang Zod
  phoneNumber: z.string().max(20).optional().nullable(),
  schoolOrigin: z.string().max(150).optional().nullable(),

}).refine((data) => {
  // Kalau isi newPassword, wajib isi currentPassword juga
  if (data.newPassword && !data.currentPassword) {
    return false
  }
  return true
}, {
  message: "Current password is required when changing password",
  path: ["currentPassword"],
})

export type UpdateUserInput = z.infer<typeof updateUserSchema>