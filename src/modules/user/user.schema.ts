import { z } from "zod"

export const updateUserSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").optional(),
  email: z.string().email("Invalid email format").optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8, "Password must be at least 8 characters").optional(),
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