import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().min(2, "Nama minimal 2 karakter"),
  email: z.string().email("Format email tidak valid"),
  password: z.string().min(8, "Password minimal 8 karakter"),
  role: z.enum(["STUDENT", "TEACHER"]).default("STUDENT"),
  educationLevels: z.array(z.enum(["SD", "SMP", "SMA", "UNIVERSITY"])).optional(),
  schoolOrigin: z.string().optional(),
  phoneNumber: z
    .string()
    .regex(/^[\d\s\-\+\(\)]{8,20}$/, "Format nomor HP tidak valid")
    .optional()
    .or(z.literal("")),
}).refine(
  (data) => {
    // Teacher WAJIB isi educationLevels
    if (data.role === "TEACHER" && (!data.educationLevels || data.educationLevels.length === 0)) return false;
    return true;
  },
  {
    message: "Teacher wajib memilih setidaknya satu jenjang pendidikan",
    path: ["educationLevels"],
  }
);

export const loginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

export const ltiLoginSchema = z.object({
  email: z.string().email("Invalid email format"),
  name: z.string().min(2, "Name must be at least 2 characters"),
});

export type LtiLoginInput = z.infer<typeof ltiLoginSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email format"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;