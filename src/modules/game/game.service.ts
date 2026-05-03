import { prisma } from "../../config/database";
import { Prisma, EducationLevel, TemplateType } from "@prisma/client";
import type { CreateGameInput, UpdateGameInput, GameQueryInput } from "./game.schema";
import { generateShareCode } from "../../utils/share-code";
import { redis } from "../../config/redis";
import { getIO } from "../../socket";
import { getAdaptiveDifficulty } from "../analytics/analytics.service";

// ═══════════════ IMPORT SEMUA GAME ENGINE ═══════════════
import { AnagramService } from "./anagram/anagram.service";
import { FlashcardService } from "./flashcard/flashcard.service";
import { HangmanService } from "./hangman/hangman.service";
import { WordSearchService } from "./word-search/word-search.service";
import { MazeChaseService } from "./maze-chase/maze-chase.service";
import { SpinTheWheelService } from "./spin-the-wheel/spin-the-wheel.service";

// ═══════════════ IMPORT NEW STANDARD ASSESSMENTS ═══════════════
import { MultipleChoiceService } from "./multiple-choice/multiple-choice.service";
import { TrueFalseService } from "./true-false/true-false.service";
import { MatchingService } from "./matching/matching.service";
import { EssayService } from "./essay/essay.service";
import { SmartGradingService } from "../ai/smart-grading.service";


// ═══════════════ CRUD GAMES (TEACHER & EXPLORE) ═══════════════

export const getGames = async (query: GameQueryInput) => {
  const page = parseInt(query.page) || 1;
  const limit = parseInt(query.limit) || 10;
  const skip = (page - 1) * limit;

  const where: Prisma.GameWhereInput = {
    isPublished: true,
    ...(query.educationLevel && { educationLevel: query.educationLevel as EducationLevel }),
    ...(query.templateType && { templateType: query.templateType as TemplateType }),
    ...(query.search && {
      title: { contains: query.search, mode: "insensitive" },
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
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
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
    where: { shareCode: shareCode.toUpperCase(), isPublished: true },
    include: { creator: { select: { name: true } } },
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

  const isPublishing = !game.isPublished;
  const dataToUpdate: any = { isPublished: isPublishing };
  if (isPublishing) {
    dataToUpdate.shareCode = generateShareCode();
  }

  return await prisma.game.update({ where: { id: gameId }, data: dataToUpdate });
};

export const getMyGames = async (userId: string) => {
  return await prisma.game.findMany({
    where: { creatorId: userId },
    orderBy: { createdAt: "desc" },
  });
};

// ═══════════════ GAME PLAYER ENGINE ═══════════════

export const startGame = async (gameId: string, userId: string) => {
  const game = await prisma.game.findUnique({ where: { id: gameId } });
  if (!game || !game.isPublished) throw new Error("Game tidak tersedia");

  // 🧠 PANGGIL LOGIKA ADAPTIVE DIFFICULTY
  const recommendedDifficulty = await getAdaptiveDifficulty(userId);
  console.log(`🧠 Adaptive Difficulty untuk User ${userId}: Direkomendasikan level ${recommendedDifficulty}`);

  const existingSession = await prisma.gameSession.findFirst({
    where: { gameId, userId, isCompleted: false },
    orderBy: { startedAt: "desc" },
  });

  if (existingSession) {
    console.log(`♻️  Reusing existing session: ${existingSession.id}`);
    return { ...existingSession, recommendedDifficulty };
  }

  const session = await prisma.gameSession.create({
    data: { gameId, userId },
  });

  await prisma.game.update({
    where: { id: gameId },
    data: { playCount: { increment: 1 } },
  });

  return { ...session, recommendedDifficulty };
};

/**
 * submitAnswer: Update skor real-time via Redis + Socket.
 */
export const submitAnswer = async (
  gameId: string,
  userId: string,
  questionIndex: number,
  selectedAnswer: any,
  playerName?: string,
  earnedPoints?: number
) => {
  const session = await prisma.gameSession.findFirst({
    where: { gameId, userId, isCompleted: false },
    orderBy: { startedAt: "desc" },
  });

  if (!session) throw new Error("Sesi tidak ditemukan.");

  const game = await prisma.game.findUnique({ where: { id: gameId } });
  if (!game) throw new Error("Game tidak ditemukan");

  let isCorrect = false;

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

    // ✅ NEW STANDARD ASSESSMENT INTEGRATION
    case TemplateType.MULTIPLE_CHOICE:
      isCorrect = MultipleChoiceService.verifyAnswer(game.gameJson, questionIndex, selectedAnswer);
      break;
    case TemplateType.TRUE_FALSE:
      isCorrect = TrueFalseService.verifyAnswer(game.gameJson, questionIndex, selectedAnswer);
      break;
    case TemplateType.MATCHING:
      isCorrect = MatchingService.verifyAnswer(game.gameJson, questionIndex, selectedAnswer);
      break;
    case TemplateType.ESSAY:
      isCorrect = EssayService.verifyAnswer(game.gameJson, questionIndex, selectedAnswer);
      break;
    default:
      isCorrect = false;
  }

  const score = earnedPoints !== undefined ? earnedPoints : isCorrect ? 100 : 0;

  // Update Redis leaderboard real-time
  const redisKey = `leaderboard:${gameId}`;
  const identity = playerName || userId;
  await redis.zincrby(redisKey, score, identity);

  // Broadcast ke room
  const rawTopScores = await redis.zrevrange(redisKey, 0, 9, "WITHSCORES");
  const formattedScores: { name: string; score: number }[] = [];
  for (let i = 0; i < rawTopScores.length; i += 2) {
    const name = rawTopScores[i];
    const scoreStr = rawTopScores[i + 1];
    if (name !== undefined && scoreStr !== undefined) {
      formattedScores.push({ name, score: parseInt(scoreStr, 10) });
    }
  }

  const roomCode = game.shareCode;
  const io = getIO();
  if (roomCode) {
    io.to(roomCode).emit("ranking_update", formattedScores);
  } else {
    io.to(gameId).emit("ranking_update", formattedScores);
  }

  return { isCorrect, score };
};

/**
 * finishGame: Simpan SKOR FINAL ke tabel Result (1x per sesi) + tutup sesi.
 */
export const finishGame = async (
  gameId: string,
  userId: string,
  payload: {
    scoreValue: number;
    maxScore: number;
    accuracy: number;
    timeSpent: number;
    answersDetail: any[];
  }
) => {
  const session = await prisma.gameSession.findFirst({
    where: { gameId, userId, isCompleted: false },
    orderBy: { startedAt: "desc" },
  });

  const game = await prisma.game.findUnique({ where: { id: gameId } });
  if (!game) throw new Error("Game tidak ditemukan");

  // =========================================================================
  // 🤖 AUTO-GRADER INTERCEPTOR (ANTI-CHEAT)
  // Kalkulasi ulang menggunakan service masing-masing agar aman dari manipulasi FE
  // =========================================================================
  let finalScore = payload.scoreValue;
  let finalAccuracy = payload.accuracy;
  const maxPossibleScore = payload.maxScore > 0 ? payload.maxScore : 100;
  const content = game.gameJson as any;

  let totalQuestions = 0;
  let correctAnswers = 0;

  let aiGradingResult: any = null;
  let updatedAnswersDetail: any[] = payload.answersDetail;

  if (game.templateType === TemplateType.MULTIPLE_CHOICE) {
    totalQuestions = content.questions?.length || 0;
    correctAnswers = payload.answersDetail.filter((ans: any) =>
      MultipleChoiceService.verifyAnswer(content, ans.questionIndex, ans.selectedAnswer)
    ).length;
    finalAccuracy = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;
    finalScore = MultipleChoiceService.calculateScore({ ...payload, accuracy: finalAccuracy }, content);
  }
  else if (game.templateType === TemplateType.TRUE_FALSE) {
    totalQuestions = content.questions?.length || 0;
    correctAnswers = payload.answersDetail.filter((ans: any) =>
      TrueFalseService.verifyAnswer(content, ans.questionIndex, ans.selectedAnswer)
    ).length;
    finalAccuracy = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;
    finalScore = TrueFalseService.calculateScore({ ...payload, accuracy: finalAccuracy }, content);
  }
  else if (game.templateType === TemplateType.MATCHING) {
    totalQuestions = content.pairs?.length || 0;
    correctAnswers = payload.answersDetail.filter((ans: any) =>
      MatchingService.verifyAnswer(content, ans.questionIndex, ans.selectedAnswer)
    ).length;
    finalAccuracy = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;
    finalScore = MatchingService.calculateScore({ ...payload, accuracy: finalAccuracy, answers: payload.answersDetail.map(ans => ({ ...ans, isCorrect: MatchingService.verifyAnswer(content, ans.questionIndex, ans.selectedAnswer) })) }, content);
  }
  else if (game.templateType === TemplateType.ESSAY) {
    totalQuestions = content.questions?.length || 0;
    const gradingResults = [];
    updatedAnswersDetail = [];
    let totalAiScore = 0;

  for (const ans of payload.answersDetail) {
  const questionObj = content.questions[ans.questionIndex];

  if (questionObj) {
    const result = await SmartGradingService.gradeEssay(
      questionObj.question,
      questionObj.keywords,
      ans.selectedAnswer
    );

    gradingResults.push({
      questionIndex: ans.questionIndex,
      question: questionObj.question,
      answer: ans.selectedAnswer,
      score: result.score,
      justification: result.justification,
      correctAnswer: result.correctAnswer
    });

    // 🔥 INI YANG FIX UTAMA
    updatedAnswersDetail.push({
      questionIndex: ans.questionIndex,
      question: questionObj.question,
      selectedAnswer: ans.selectedAnswer,

      isCorrect: result.score >= 60,
      pointsEarned: result.score,

      justification: result.justification,
      correctAnswer: result.correctAnswer,

      keywordsMatched: result.keywordsMatched,
      keywordsMissing: result.keywordsMissing,
    });

    totalAiScore += result.score;
  }
}
    payload.answersDetail = updatedAnswersDetail;
    finalScore = totalQuestions > 0 ? Math.round(totalAiScore / totalQuestions) : 0;
    finalAccuracy = finalScore; // Untuk essay, akurasi disamakan dengan skor rata-rata
    aiGradingResult = gradingResults;
  }


  // Jika tidak ada sesi aktif, buat satu baru dan langsung selesaikan
  if (!session) {
    console.warn(`⚠️ No active session found for user ${userId} game ${gameId}. Creating one.`);
    const newSession = await prisma.gameSession.create({
      data: { gameId, userId, isCompleted: true, finishedAt: new Date() },
    });

    const result = await prisma.result.create({
      data: {
        sessionId: newSession.id,
        scoreValue: Math.round(finalScore),
        maxScore: maxPossibleScore,
        accuracy: finalAccuracy,
        timeSpent: payload.timeSpent,
        difficultyPlayed: game.difficulty,
        answersDetail: updatedAnswersDetail as Prisma.InputJsonValue,
        aiGradingResult: aiGradingResult as Prisma.InputJsonValue,
      },
    });

    return { session: newSession, result };

  }

  // Cek idempoten
  const existingResult = await prisma.result.findUnique({
    where: { sessionId: session.id },
  });

  if (existingResult) {
    return { session, result: existingResult };
  }

  const closedSession = await prisma.gameSession.update({
    where: { id: session.id },
    data: { isCompleted: true, finishedAt: new Date() },
  });

  const result = await prisma.result.create({
    data: {
      sessionId: session.id,
      scoreValue: Math.round(finalScore),
      maxScore: maxPossibleScore,
      accuracy: finalAccuracy,
      timeSpent: payload.timeSpent,
      difficultyPlayed: game.difficulty,
      answersDetail: updatedAnswersDetail as Prisma.InputJsonValue,
      aiGradingResult: aiGradingResult as Prisma.InputJsonValue,
    },
  });


  console.log(`✅ Game finished: User ${userId}, Validated Score ${Math.round(finalScore)}, Accuracy ${finalAccuracy}%`);
  return { session: closedSession, result };
};

// ═══════════════ TEMPLATE MAPPING ═══════════════

export const getTemplatesByLevel = async (educationLevel: EducationLevel) => {
  const templateMapping: Record<EducationLevel, TemplateType[]> = {
    SD: [
      TemplateType.FLASHCARD, TemplateType.HANGMAN, TemplateType.WORD_SEARCH,
      TemplateType.ANAGRAM, TemplateType.MAZE_CHASE,
      TemplateType.MULTIPLE_CHOICE, TemplateType.TRUE_FALSE, TemplateType.MATCHING, TemplateType.ESSAY
    ],
    SMP: [
      TemplateType.FLASHCARD, TemplateType.HANGMAN, TemplateType.WORD_SEARCH,
      TemplateType.ANAGRAM, TemplateType.MAZE_CHASE,
      TemplateType.MULTIPLE_CHOICE, TemplateType.TRUE_FALSE, TemplateType.MATCHING, TemplateType.ESSAY
    ],
    SMA: [
      TemplateType.FLASHCARD, TemplateType.ANAGRAM, TemplateType.SPIN_THE_WHEEL,
      TemplateType.MULTIPLE_CHOICE, TemplateType.TRUE_FALSE, TemplateType.MATCHING, TemplateType.ESSAY
    ],
    UNIVERSITY: [
      TemplateType.FLASHCARD, TemplateType.ANAGRAM, TemplateType.SPIN_THE_WHEEL,
      TemplateType.MULTIPLE_CHOICE, TemplateType.TRUE_FALSE, TemplateType.MATCHING, TemplateType.ESSAY
    ],
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
    // Penjelasan untuk Standard Assessment
    MULTIPLE_CHOICE: "Kuis pilihan ganda klasik dengan 4 opsi jawaban",
    TRUE_FALSE: "Tentukan pernyataan benar atau salah dengan cepat",
    MATCHING: "Pasangkan pernyataan di kolom kiri dengan jawaban di kolom kanan",
    ESSAY: "Jawab pertanyaan secara terbuka dengan penilaian otomatis dari AI",
  };
  return descriptions[type] ?? "";
};

export const saveLeaderboard = async (roomCode: string, finalPlayers: any[]) => {
  try {
    const game = await prisma.game.findFirst({ where: { shareCode: roomCode.toUpperCase() } });
    if (!game) return;

    await prisma.gameSession.updateMany({
      where: { gameId: game.id, isCompleted: false },
      data: { isCompleted: true, finishedAt: new Date() },
    });
    console.log(`✅ Sesi game ${roomCode} berhasil ditutup.`);
  } catch (error) {
    console.error("❌ Gagal menyimpan leaderboard:", error);
  }
};