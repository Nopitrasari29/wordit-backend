import type { Request, Response, NextFunction } from "express";
import { verifyToken, type JwtPayload } from "../utils/jwt";
import { errorResponse } from "../utils/response";

// ✅ 1. EKSPOR INTERFACE-NYA DI SINI
export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

// 2. Middleware Factory
export const authMiddleware = (allowedRoles: string[] = []) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) {
        res.status(401).json(errorResponse("Unauthorized"));
        return;
      }
      const token = authHeader.split(" ")[1];
      if (!token) {
        res.status(401).json(errorResponse("Token not found"));
        return;
      }
      const decoded = verifyToken(token);
      req.user = decoded;

      if (allowedRoles.length > 0 && !allowedRoles.includes(decoded.role)) {
        res.status(403).json(errorResponse("Forbidden"));
        return;
      }
      next();
    } catch {
      res.status(401).json(errorResponse("Invalid token"));
    }
  };
};