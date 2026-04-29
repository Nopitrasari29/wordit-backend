import type { Request, Response, NextFunction } from "express";
import { EducationLevel } from "@prisma/client";
import { createGameSchema, updateGameSchema, gameQuerySchema, submitAnswerSchema } from "./game.schema";

import * as gameService from "./game.service";
import { successResponse, errorResponse } from "../../utils/response";
import { type AuthenticatedRequest } from "../../middleware/auth.middleware";

/**
 * Helper untuk mengambil User ID dengan jaminan tipe String untuk TS
 */
const getUserId = (req: Request): string | undefined => {
  return (req as AuthenticatedRequest).user?.userId;
};

// â”€â”€â”€ CRUD GAMES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const getGames = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = gameQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json(errorResponse("Validation error", parsed.error.flatten().fieldErrors));
      return;
    }
    const result = await gameService.getGames(parsed.data);
    res.status(200).json(successResponse(result, "Games fetched"));
  } catch (error: unknown) {
    next(error);
  }
};

export const getGameById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    if (!id) throw new Error("Game ID is required");
    
    const userId = getUserId(req);
    const result = await gameService.getGameById(id, userId);
    if (!result) {
      res.status(404).json(errorResponse("Game not found"));
      return;
    }
    res.status(200).json(successResponse(result, "Game fetched"));
  } catch (error: unknown) {
    next(error);
  }
};

/**
 * ðŸš€ FIXED: Mencari Game berdasarkan Share Code (Untuk Student Join)
 */
export const getGameByCode = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Paksa cast ke string untuk menghindari error Property 'toUpperCase' does not exist
    const shareCode = req.params.shareCode as string; 
    
    console.log(`ðŸ” [JOIN] Student searching for code: ${shareCode}`);

    if (!shareCode) {
      res.status(400).json(errorResponse("Share Code wajib diisi"));
      return;
    }

    // Gunakan helper toUpperCase dengan aman
    const result = await gameService.getGameByCode(shareCode.toUpperCase());
    
    if (!result) {
      console.warn(`âš ï¸ [JOIN] Code ${shareCode} not found in DB`);
      res.status(404).json(errorResponse("Game tidak ditemukan! Cek kembali kodenya."));
      return;
    }

    console.log(`âœ… [JOIN] Code ${shareCode} matched with Game: ${result.title}`);
    res.status(200).json(successResponse(result, "Game ditemukan"));
  } catch (error: unknown) {
    next(error);
  }
};

export const getMyGames = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json(errorResponse("Unauthorized"));
      return;
    }
    const result = await gameService.getMyGames(userId);
    res.status(200).json(successResponse(result, "My games fetched"));
  } catch (error: unknown) {
    next(error);
  }
};

export const createGame = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json(errorResponse("Unauthorized"));
      return;
    }

    const parsed = createGameSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json(errorResponse("Validation error", parsed.error.flatten().fieldErrors));
      return;
    }

    const result = await gameService.createGame(userId as string, parsed.data);
    res.status(201).json(successResponse(result, "Game created"));
  } catch (error: any) {
    next(error);
  }
};

export const updateGame = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json(errorResponse("Unauthorized"));
      return;
    }

    const id = req.params.id as string;
    const parsed = updateGameSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json(errorResponse("Validation error", parsed.error.flatten().fieldErrors));
      return;
    }

    const result = await gameService.updateGame(id, userId as string, parsed.data);
    res.status(200).json(successResponse(result, "Game updated"));
  } catch (error: unknown) {
    next(error);
  }
};

export const deleteGame = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json(errorResponse("Unauthorized"));
      return;
    }

    const id = req.params.id as string;
    await gameService.deleteGame(id, userId as string);
    res.status(200).json(successResponse(null, "Game deleted"));
  } catch (error: unknown) {
    next(error);
  }
};

export const togglePublish = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json(errorResponse("Unauthorized"));
      return;
    }

    const id = req.params.id as string;
    const result = await gameService.togglePublish(id, userId as string);
    res.status(200).json(successResponse(result, `Game ${result.isPublished ? "published" : "unpublished"}`));
  } catch (error: unknown) {
    next(error);
  }
};

export const getTemplatesByLevel = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { level } = req.params;
    const templates = await gameService.getTemplatesByLevel(level as EducationLevel);
    res.status(200).json(successResponse(templates, "Templates fetched"));
  } catch (error: unknown) {
    next(error);
  }
};

// â”€â”€â”€ GAME PLAYER ENGINE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const playGame = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json(errorResponse("Unauthorized"));
      return;
    }

    const id = req.params.id as string;
    console.log(`ðŸŽ® User ${userId} starting game session for: ${id}`);
    
    const session = await gameService.startGame(id, userId as string);
    res.status(200).json(successResponse(session, "Sesi game dimulai"));
  } catch (error) {
    next(error);
  }
};

export const submitAnswer = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json(errorResponse("Unauthorized"));
      return;
    }

    const id = req.params.id as string;
    const parsed = submitAnswerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json(errorResponse("Validation error", parsed.error.flatten().fieldErrors));
      return;
    }

    const { questionIndex, selectedAnswer, earnedPoints } = parsed.data;
    
    console.log(`[SUBMIT_ANSWER] Validated body:`, parsed.data);
    
    const result = await gameService.submitAnswer(
      id, 
      userId as string, 
      questionIndex as number, 
      selectedAnswer,
      undefined,
      earnedPoints
    );

    res.status(200).json(successResponse(result, "Jawaban berhasil dikirim"));
  } catch (error: any) {
    res.status(500).json(errorResponse(error.message));
  }
};
export const finishGame = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json(errorResponse("Unauthorized"));
      return;
    }

    const id = req.params.id as string;
    const { scoreValue, maxScore, accuracy, timeSpent, answersDetail } = req.body;

    console.log(`[FINISH_GAME] User ${userId} finishing game ${id}, score: ${scoreValue}`);

    const result = await gameService.finishGame(id, userId as string, {
      scoreValue: scoreValue ?? 0,
      maxScore: maxScore ?? 0,
      accuracy: accuracy ?? 0,
      timeSpent: timeSpent ?? 0,
      answersDetail: answersDetail ?? [],
    });

    res.status(200).json(successResponse(result, "Skor berhasil disimpan!"));
  } catch (error: any) {
    res.status(500).json(errorResponse(error.message));
  }
};
