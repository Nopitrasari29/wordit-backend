import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email format"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["STUDENT", "TEACHER"]).default("STUDENT"),
  educationLevel: z.enum(["SD", "SMP", "SMA", "UNIVERSITY"]).optional(),
}).refine(
  (data) => {
    // Teacher WAJIB isi educationLevel
    if (data.role === "TEACHER" && !data.educationLevel) return false;
    return true;
  },
  {
    message: "Teacher wajib memilih satu jenjang pendidikan",
    path: ["educationLevel"],
  }
);

export const loginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;