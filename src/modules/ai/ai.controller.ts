import type { Request, Response } from "express";
import {
  generateQuizContent,
  generateFeedbackContent,
} from "./ai.service";

/**
 * Generate Quiz Controller
 */
export const generateQuiz = async (req: Request, res: Response) => {
  try {
    const { topic, educationLevel, templateType } = req.body;

    const quizData = await generateQuizContent(
      topic,
      educationLevel,
      templateType
    );

    return res.status(200).json({
      success: true,
      data: quizData,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * AI Feedback Controller
 */
export const getAIFeedback = async (req: Request, res: Response) => {
  try {
    const { questionText, correctAnswer } = req.body;

    const feedbackData = await generateFeedbackContent(
      questionText,
      correctAnswer
    );

    return res.status(200).json({
      success: true,
      data: feedbackData,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};