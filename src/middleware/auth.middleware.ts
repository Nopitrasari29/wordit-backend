import type { Request, Response, NextFunction } from "express";
import { verifyToken, type JwtPayload } from "../utils/jwt";
import { errorResponse } from "../utils/response";

// 1. Declaration Merging: Memberitahu Express bahwa objek 'request' sekarang punya property 'user'
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

// 2. Middleware Factory: Mengizinkan kita untuk membatasi akses berdasarkan role
export const authMiddleware = (allowedRoles: string[] = []) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;

      // Cek apakah header authorization ada dan formatnya "Bearer <token>"
      if (!authHeader?.startsWith("Bearer ")) {
        res.status(401).json(errorResponse("Unauthorized: Token missing"));
        return;
      }

      const token = authHeader.split(" ")[1];
      if (!token) {
        res.status(401).json(errorResponse("Unauthorized: Token not found"));
        return;
      }

      // Verifikasi Token
      const decoded = verifyToken(token);
      req.user = decoded; // Menyimpan data user di req.user

      // ✅ RBAC (Role-Based Access Control)
      // Jika allowedRoles diisi, cek apakah role user ada di daftar tersebut
      if (allowedRoles.length > 0 && !allowedRoles.includes(decoded.role)) {
        res.status(403).json(errorResponse("Forbidden: Access denied"));
        return;
      }

      next();
    } catch {
      res.status(401).json(errorResponse("Invalid or expired token"));
    }
  };
};