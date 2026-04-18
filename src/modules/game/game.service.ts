import { prisma } from "../../config/database";
import { Prisma, EducationLevel, TemplateType } from "@prisma/client";
import type { CreateGameInput, UpdateGameInput, GameQueryInput } from "./game.schema";
import { generateShareCode } from "../../utils/share-code";
import { redis } from "../../config/redis";
import { getIO } from "../../socket";

// ─── IMPORT SEMUA GAME ENGINE (THE GOLDEN SIX) ──────────────────────
import { AnagramService } from "./anagram/anagram.service";
import { FlashcardService } from "./flashcard/flashcard.service";
import { HangmanService } from "./hangman/hangman.service";
import { WordSearchService } from "./word-search/word-search.service";
import { MazeChaseService } from "./maze-chase/maze-chase.service";
import { SpinTheWheelService } from "./spin-the-wheel/spin-the-wheel.service";

// ─── CRUD GAMES (TEACHER & EXPLORE) ──────────────────────────────────

export const getGames = async (query: GameQueryInput) => {
  const page = parseInt(query.page) || 1;
  const limit = parseInt(query.limit) || 10;
  const skip = (page - 1) * limit;

  const where: Prisma.GameWhereInput = {
    isPublished: true,
    ...(query.educationLevel && { educationLevel: query.educationLevel as EducationLevel }),
    ...(query.templateType && { templateType: query.templateType as TemplateType }),
    ...(query.search && {
      title: { contains: query.search, mode: 'insensitive' },
    }),
  };

  const [games, total] = await Promise.all([
    prisma.game.findMany({
      where,
      select: {
        id: true,
        title: true,
        description: true,
        templateType: true,
        educationLevel: true,
        difficulty: true,
        playCount: true,
        thumbnailUrl: true,
        shareCode: true,
        createdAt: true,
        creator: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.game.count({ where }),
  ]);

  return { 
    games, 
    pagination: { 
      page, 
      limit, 
      total, 
      totalPages: Math.ceil(total / limit) 
    } 
  };
};

export const getGameById = async (gameId: string, userId?: string) => {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: { creator: { select: { id: true, name: true } } },
  });

  if (!game) throw new Error("Game not found");
  
  if (!game.isPublished && game.creatorId !== userId) {
    throw new Error("Game ini belum dipublikasikan");
  }

  return game;
};

export const getGameByCode = async (shareCode: string) => {
  return await prisma.game.findFirst({
    where: { 
        shareCode: shareCode.toUpperCase(),
        isPublished: true 
    },
    include: {
        creator: { select: { name: true } }
    }
  });
};

export const createGame = async (userId: string, data: CreateGameInput) => {
  const shareCode = generateShareCode();

  return await prisma.game.create({
    data: {
      title: data.title,
      description: data.description,
      templateType: data.templateType as TemplateType,
      educationLevel: data.educationLevel as EducationLevel,
      difficulty: data.difficulty,
      creatorId: userId,
      shareCode,
      gameJson: data.gameJson as Prisma.InputJsonValue,
      isPublished: data.isPublished || false,
    },
  });
};

export const updateGame = async (gameId: string, userId: string, data: UpdateGameInput) => {
  const game = await prisma.game.findUnique({ where: { id: gameId } });
  if (!game) throw new Error("Game not found");
  if (game.creatorId !== userId) throw new Error("Unauthorized");

  return await prisma.game.update({
    where: { id: gameId },
    data: {
      ...data,
      gameJson: data.gameJson ? (data.gameJson as Prisma.InputJsonValue) : undefined,
    },
  });
};

export const deleteGame = async (gameId: string, userId: string) => {
  const game = await prisma.game.findUnique({ where: { id: gameId } });
  if (!game) throw new Error("Game not found");
  if (game.creatorId !== userId) throw new Error("Unauthorized");

  await prisma.game.delete({ where: { id: gameId } });
  return { message: "Game deleted successfully" };
};

export const togglePublish = async (gameId: string, userId: string) => {
  const game = await prisma.game.findUnique({ where: { id: gameId } });
  if (!game) throw new Error("Game not found");
  if (game.creatorId !== userId) throw new Error("Unauthorized");

  return await prisma.game.update({
    where: { id: gameId },
    data: { isPublished: !game.isPublished },
  });
};

export const getMyGames = async (userId: string) => {
  return await prisma.game.findMany({
    where: { creatorId: userId },
    orderBy: { createdAt: "desc" },
  });
};

// ─── GAME PLAYER ENGINE (QUIZIZZ SYSTEM) ───────────────────────────

export const startGame = async (gameId: string, userId: string) => {
  const game = await prisma.game.findUnique({ where: { id: gameId } });
  if (!game || !game.isPublished) throw new Error("Game tidak tersedia");

  const session = await prisma.gameSession.create({
    data: { gameId, userId },
  });

  await prisma.game.update({
    where: { id: gameId },
    data: { playCount: { increment: 1 } }
  });

  return session;
};

/**
 * BE-12 & BE-13: Submit jawaban, Hitung skor, dan Update Ranking
 */
export const submitAnswer = async (
  gameId: string,
  userId: string,
  questionIndex: number,
  selectedAnswer: any,
  playerName?: string
) => {
  const session = await prisma.gameSession.findFirst({
    where: { gameId, userId, isCompleted: false },
    orderBy: { startedAt: 'desc' }
  });

  if (!session) throw new Error("Sesi tidak ditemukan.");

  const game = await prisma.game.findUnique({ where: { id: gameId } });
  if (!game) throw new Error("Game tidak ditemukan");

  let isCorrect = false;

  // 1. Verifikasi Jawaban (Sesuai Golden Six)
  switch (game.templateType) {
    case TemplateType.ANAGRAM:
      isCorrect = AnagramService.verifyAnswer(game.gameJson, questionIndex, selectedAnswer);
      break;
    case TemplateType.FLASHCARD:
      isCorrect = FlashcardService.verifyAnswer(game.gameJson, questionIndex, selectedAnswer);
      break;
    case TemplateType.HANGMAN:
      isCorrect = HangmanService.verifyAnswer(game.gameJson, questionIndex, selectedAnswer);
      break;
    case TemplateType.WORD_SEARCH:
      isCorrect = WordSearchService.verifyAnswer(game.gameJson, questionIndex, selectedAnswer);
      break;
    case TemplateType.MAZE_CHASE:
      isCorrect = MazeChaseService.verifyAnswer(game.gameJson, questionIndex, selectedAnswer);
      break;
    case TemplateType.SPIN_THE_WHEEL:
      isCorrect = SpinTheWheelService.verifyAnswer(game.gameJson, questionIndex, selectedAnswer);
      break;
    default:
      isCorrect = false;
  }

  const score = isCorrect ? 100 : 0;

  // 2. Simpan ke Database
  const result = await prisma.result.create({
    data: {
      sessionId: session.id,
      scoreValue: score,
      accuracy: isCorrect ? 100 : 0,
      timeSpent: 0, 
      difficultyPlayed: game.difficulty,
    },
  });

  // 3. Update Redis
  const redisKey = `leaderboard:${gameId}`;
  const identity = playerName || userId;
  await redis.zincrby(redisKey, score, identity);

  // 4. 🔥 FIX: Type-Safe Broadcast Ranking
  const rawTopScores = await redis.zrevrange(redisKey, 0, 9, "WITHSCORES");
  
  const formattedScores: { name: string; score: number }[] = [];
  for (let i = 0; i < rawTopScores.length; i += 2) {
    const name = rawTopScores[i];
    const scoreStr = rawTopScores[i + 1];

    // Pastikan variabel ada sebelum diproses
    if (name !== undefined && scoreStr !== undefined) {
      formattedScores.push({
        name: name,
        score: parseInt(scoreStr, 10) // Gunakan radix 10 untuk keamanan
      });
    }
  }

  getIO().to(gameId).emit("ranking_update", formattedScores);

  return { isCorrect, score, result };
};

// ─── TEMPLATE MAPPING ───────────────────────────────────────────────

export const getTemplatesByLevel = async (educationLevel: EducationLevel) => {
  const templateMapping: Record<EducationLevel, TemplateType[]> = {
    SD: [TemplateType.FLASHCARD, TemplateType.HANGMAN, TemplateType.WORD_SEARCH, TemplateType.ANAGRAM, TemplateType.MAZE_CHASE],
    SMP: [TemplateType.FLASHCARD, TemplateType.HANGMAN, TemplateType.WORD_SEARCH, TemplateType.ANAGRAM, TemplateType.MAZE_CHASE],
    SMA: [TemplateType.FLASHCARD, TemplateType.ANAGRAM, TemplateType.SPIN_THE_WHEEL],
    UNIVERSITY: [TemplateType.FLASHCARD, TemplateType.ANAGRAM, TemplateType.SPIN_THE_WHEEL],
  };

  const templates = templateMapping[educationLevel] ?? [];

  return templates.map((t) => ({
    type: t,
    label: t.replace(/_/g, " "),
    description: getTemplateDescription(t),
  }));
};

const getTemplateDescription = (type: TemplateType): string => {
  const descriptions: Record<TemplateType, string> = {
    ANAGRAM: "Susun huruf acak menjadi kata yang benar",
    FLASHCARD: "Kartu hafalan interaktif bolak-balik",
    HANGMAN: "Tebak kata rahasia huruf demi huruf",
    MAZE_CHASE: "Jawab soal sambil berpetualang di labirin",
    SPIN_THE_WHEEL: "Putar roda untuk mendapatkan pertanyaan acak",
    WORD_SEARCH: "Temukan kata-kata tersembunyi di dalam kotak huruf",
  };
  return descriptions[type] ?? "";
};