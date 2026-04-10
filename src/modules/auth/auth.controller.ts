import type { Request, Response } from "express"
import { registerSchema, loginSchema } from "./auth.schema"
import * as authService from "./auth.service"
import { successResponse, errorResponse } from "../../utils/response"

export const register = async (req: Request, res: Response) => {
  try {
    const parsed = registerSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json(errorResponse("Validation error", parsed.error.flatten().fieldErrors))
      return
    }

    const result = await authService.register(parsed.data)
    res.status(201).json(successResponse(result, "Register successful"))
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Register failed"
    res.status(400).json(errorResponse(message))
  }
}

export const login = async (req: Request, res: Response) => {
  try {
    const parsed = loginSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json(errorResponse("Validation error", parsed.error.flatten().fieldErrors))
      return
    }

    const result = await authService.login(parsed.data)
    res.status(200).json(successResponse(result, "Login successful"))
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Login failed"
    res.status(401).json(errorResponse(message))
  }
}

export const logout = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId
    if (!userId) {
      res.status(401).json(errorResponse("Unauthorized"))
      return
    }

    const result = await authService.logout(userId)
    res.status(200).json(successResponse(result, "Logout successful"))
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Logout failed"
    res.status(400).json(errorResponse(message))
  }
}