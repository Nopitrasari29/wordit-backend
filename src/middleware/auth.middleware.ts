import type { Request, Response, NextFunction } from "express"
import { verifyToken } from "../utils/jwt"
import { errorResponse } from "../utils/response"

export const authMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json(errorResponse("Unauthorized"))
      return
    }

    const token = authHeader.split(" ")[1]
    if (!token) {
      res.status(401).json(errorResponse("Token not found"))
      return
    }

    const decoded = verifyToken(token)
    req.user = decoded
    next()
  } catch {
    res.status(401).json(errorResponse("Invalid or expired token"))
  }
}