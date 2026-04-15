import type { Request, Response } from "express"
import { updateUserSchema } from "./user.schema"
import * as userService from "./user.service"
import { successResponse, errorResponse } from "../../utils/response"

export const getProfile = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId
    if (!userId) {
      res.status(401).json(errorResponse("Unauthorized"))
      return
    }

    const profile = await userService.getProfile(userId)
    res.status(200).json(successResponse(profile, "Profile fetched"))
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to get profile"
    res.status(400).json(errorResponse(message))
  }
}

export const updateProfile = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId
    if (!userId) {
      res.status(401).json(errorResponse("Unauthorized"))
      return
    }

    const parsed = updateUserSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json(errorResponse("Validation error", parsed.error.flatten().fieldErrors))
      return
    }

    // ✅ Langsung kirim req.file ke service!
    const updated = await userService.updateProfile(userId, parsed.data, req.file)
    
    res.status(200).json(successResponse(updated, "Profile updated"))
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update profile"
    res.status(400).json(errorResponse(message))
  }
}

export const getMyGames = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId
    if (!userId) {
      res.status(401).json(errorResponse("Unauthorized"))
      return
    }

    const games = await userService.getUserGames(userId)
    res.status(200).json(successResponse(games, "Games fetched"))
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to get games"
    res.status(400).json(errorResponse(message))
  }
}

// ✅ FUNGSI BARU UNTUK ADMIN (Yang tadi bikin error merah)
export const getAllUsers = async (req: Request, res: Response) => {
  try {
    // Ambil query parameter untuk pagination/search (jika ada)
    const query = req.query as any; 

    // Panggil fungsi getAllUsers dari service
    const result = await userService.getAllUsers(query);
    
    // Kirim response
    res.status(200).json({
      status: "success",
      message: "Users fetched successfully",
      // Handle jika service mengembalikan objek pagination { data, meta }
      data: (result as any).data ? (result as any).data : result,
      meta: (result as any).meta ? (result as any).meta : undefined
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to get users"
    res.status(400).json(errorResponse(message))
  }
}