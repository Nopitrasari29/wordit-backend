import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import type { ZodSchema } from "zod"; // ✅ WAJIB dipisah karena ZodSchema adalah tipe

/**
 * Middleware untuk memvalidasi input request menggunakan Zod Schema (GAP 3 FIXED)
 * Mengatasi error 'verbatimModuleSyntax' dan properti ZodError.
 */
export const validate = (schema: ZodSchema) => 
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          message: "Validasi Gagal",
          // ✅ FIX: Gunakan 'issues' karena 'errors' tidak ada di tipe ZodError terbaru
          errors: error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message
          }))
        });
      }
      return res.status(500).json({ 
        success: false, 
        message: "Terjadi kesalahan internal pada sistem validasi." 
      });
    }
  };