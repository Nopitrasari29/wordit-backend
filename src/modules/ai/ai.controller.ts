import type { Request, Response } from "express";
import { AIService } from "./ai.service";
import { generateQuizSchema } from "./ai.schema";
import { successResponse, errorResponse } from "../../utils/response";

export const generateQuiz = async (req: Request, res: Response) => {
  try {
    const parsed = generateQuizSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(errorResponse("Input tidak valid", parsed.error.flatten().fieldErrors));
    }

    const result = await AIService.generateQuiz(parsed.data);
    res.status(200).json(successResponse(result, "AI Quiz Generated Successfully"));
  } catch (err: any) {
    res.status(500).json(errorResponse(err.message));
  }
};