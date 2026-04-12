import type { Request, Response } from "express"
import { createGameSchema, updateGameSchema, gameQuerySchema } from "./game.schema"
import * as gameService from "./game.service"
import { successResponse, errorResponse } from "../../utils/response"

export const getGames = async (req: Request, res: Response) => {
  try {
    const parsed = gameQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      res.status(400).json(errorResponse("Validation error", parsed.error.flatten().fieldErrors))
      return
    }

    const result = await gameService.getGames(parsed.data)
    res.status(200).json(successResponse(result, "Games fetched"))
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to get games"
    res.status(400).json(errorResponse(message))
  }
}

export const getGameById = async (req: Request, res: Response) => {
  try {
    const id = req.params["id"] as string
    const userId = req.user?.userId

    const game = await gameService.getGameById(id, userId)
    res.status(200).json(successResponse(game, "Game fetched"))
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to get game"
    const status = message === "Game not found" ? 404 : 400
    res.status(status).json(errorResponse(message))
  }
}

export const createGame = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId
    if (!userId) {
      res.status(401).json(errorResponse("Unauthorized"))
      return
    }

    const parsed = createGameSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json(errorResponse("Validation error", parsed.error.flatten().fieldErrors))
      return
    }

    const game = await gameService.createGame(userId, parsed.data)
    res.status(201).json(successResponse(game, "Game created"))
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create game"
    res.status(400).json(errorResponse(message))
  }
}

export const updateGame = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId
    if (!userId) {
      res.status(401).json(errorResponse("Unauthorized"))
      return
    }

    const id = req.params["id"] as string
    const parsed = updateGameSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json(errorResponse("Validation error", parsed.error.flatten().fieldErrors))
      return
    }

    const game = await gameService.updateGame(id, userId, parsed.data)
    res.status(200).json(successResponse(game, "Game updated"))
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update game"
    const status = message === "Unauthorized" ? 403 : 400
    res.status(status).json(errorResponse(message))
  }
}

export const deleteGame = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId
    if (!userId) {
      res.status(401).json(errorResponse("Unauthorized"))
      return
    }

    const id = req.params["id"] as string
    const result = await gameService.deleteGame(id, userId)
    res.status(200).json(successResponse(result, "Game deleted"))
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to delete game"
    const status = message === "Unauthorized" ? 403 : 400
    res.status(status).json(errorResponse(message))
  }
}

export const togglePublish = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId
    if (!userId) {
      res.status(401).json(errorResponse("Unauthorized"))
      return
    }

    const id = req.params["id"] as string
    const result = await gameService.togglePublish(id, userId)
    const message = result.isPublished ? "Game published" : "Game unpublished"
    res.status(200).json(successResponse(result, message))
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to toggle publish"
    const status = message === "Unauthorized" ? 403 : 400
    res.status(status).json(errorResponse(message))
  }
}

export const getMyGames = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId
    if (!userId) {
      res.status(401).json(errorResponse("Unauthorized"))
      return
    }

    const games = await gameService.getMyGames(userId)
    res.status(200).json(successResponse(games, "My games fetched"))
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to get my games"
    res.status(400).json(errorResponse(message))
  }
}

export const getTemplatesByLevel = async (req: Request, res: Response) => {
  try {
    const level = req.params["level"] as string
    const validLevels = ["SD", "SMP_SMA", "UNIVERSITY"]

    if (!validLevels.includes(level)) {
      res.status(400).json(errorResponse("Invalid education level. Use SD, SMP_SMA, or UNIVERSITY"))
      return
    }

    const templates = await gameService.getTemplatesByLevel(level)
    res.status(200).json(successResponse(templates, "Templates fetched"))
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to get templates"
    res.status(400).json(errorResponse(message))
  }
}