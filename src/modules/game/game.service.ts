import { prisma } from "../../config/database";
import { Prisma, EducationLevel, TemplateType } from "@prisma/client";
import type {
  CreateGameInput,
  UpdateGameInput,
  GameQueryInput,
} from "./game.schema";
import { generateShareCode } from "../../utils/share-code";
import { redis } from "../../config/redis";
import { getIO } from "../../socket";
import { getAdaptiveDifficulty } from "../analytics/analytics.service";
import { createSystemLog } from "../../utils/system-logger";
import { ltiProvider } from "../../config/lti";

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
    ...(query.educationLevel && {
      educationLevel: query.educationLevel as EducationLevel,
    }),
    ...(query.templateType && {
      templateType: query.templateType as TemplateType,
    }),
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
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");

  if (!user.educationLevels.includes(data.educationLevel as EducationLevel)) {
    throw new Error("Anda tidak memiliki akses untuk membuat game di jenjang ini.");
  }

  const shareCode = generateShareCode();
  const createdGame = await prisma.game.create({
    data: {
      title: data.title,
      description: data.description,
      templateType: data.templateType as TemplateType,
      educationLevel: data.educationLevel as EducationLevel,
      difficulty: data.difficulty,
      classGrade: data.classGrade,
      subject: data.subject,
      chapter: data.chapter,
      topic: data.topic,
      creatorId: userId,
      shareCode,
      gameJson: data.gameJson as Prisma.InputJsonValue,
      isPublished: data.isPublished || false,
    },
  });

  await createSystemLog({
    action: "CREATE_GAME",
    details: `Game "${createdGame.title}" (${createdGame.templateType}) created for ${createdGame.educationLevel}`,
    userId,
    userName: user.name,
  });

  return createdGame;
};

export const updateGame = async (
  gameId: string,
  userId: string,
  data: UpdateGameInput,
) => {
  const game = await prisma.game.findUnique({ where: { id: gameId } });
  if (!game) throw new Error("Game not found");
  if (game.creatorId !== userId) throw new Error("Unauthorized");

  if (data.educationLevel) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error("User not found");
    if (!user.educationLevels.includes(data.educationLevel as EducationLevel)) {
      throw new Error("Anda tidak memiliki akses ke jenjang pendidikan ini.");
    }
  }

  const updatedGame = await prisma.game.update({
    where: { id: gameId },
    data: {
      ...data,
      classGrade: data.classGrade,
      subject: data.subject,
      chapter: data.chapter,
      topic: data.topic,
      gameJson: data.gameJson
        ? (data.gameJson as Prisma.InputJsonValue)
        : undefined,
    },
  });

  const user = await prisma.user.findUnique({ where: { id: userId } });
  await createSystemLog({
    action: "UPDATE_GAME",
    details: `Game "${updatedGame.title}" (${updatedGame.templateType}) updated`,
    userId,
    userName: user?.name || "Unknown",
  });

  return updatedGame;
};

export const deleteGame = async (gameId: string, userId: string) => {
  const game = await prisma.game.findUnique({ where: { id: gameId } });
  if (!game) throw new Error("Game not found");
  if (game.creatorId !== userId) throw new Error("Unauthorized");

  const sessions = await prisma.gameSession.findMany({
    where: { gameId },
    select: { id: true },
  });
  const sessionIds = sessions.map((s) => s.id);

  await prisma.$transaction(async (tx) => {
    await tx.ltiContext.deleteMany({
      where: { gameId },
    });

    if (sessionIds.length > 0) {
      await tx.result.deleteMany({
        where: { sessionId: { in: sessionIds } },
      });

      await tx.gameSession.deleteMany({
        where: { gameId },
      });
    }

    await tx.game.delete({ where: { id: gameId } });
  });

  try {
    await redis.del(`leaderboard:${gameId}`);
    console.log(`🗑️ Redis leaderboard key leaderboard:${gameId} cleared.`);
  } catch (redisErr) {
    console.error(`⚠️ Gagal menghapus key Redis leaderboard:${gameId}:`, redisErr);
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  await createSystemLog({
    action: "DELETE_GAME",
    details: `Game "${game.title}" (${game.templateType}) deleted`,
    userId,
    userName: user?.name || "Unknown",
  });

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

  const updatedGame = await prisma.game.update({
    where: { id: gameId },
    data: dataToUpdate,
  });

  const user = await prisma.user.findUnique({ where: { id: userId } });
  await createSystemLog({
    action: "TOGGLE_PUBLISH",
    details: `Game "${updatedGame.title}" ${isPublishing ? "published" : "unpublished"}`,
    userId,
    userName: user?.name || "Unknown",
  });

  return updatedGame;
};

export const getMyGames = async (userId: string) => {
  return await prisma.game.findMany({
    where: { creatorId: userId },
    orderBy: { createdAt: "desc" },
  });
};

// ═══════════════ GAME PLAYER ENGINE ═══════════════

export const startGame = async (gameId: string, userId: string, playerName?: string) => {
  const game = await prisma.game.findUnique({ where: { id: gameId } });
  if (!game || !game.isPublished) throw new Error("Game tidak tersedia");

  const recommendedDifficulty = await getAdaptiveDifficulty(userId);

  // Resolving playerName to the user's actual registered name if logged in
  let resolvedPlayerName = playerName;
  if (!resolvedPlayerName && userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });
    if (user) resolvedPlayerName = user.name;
  }
  if (!resolvedPlayerName) resolvedPlayerName = "Guest";

  const existingSession = await prisma.gameSession.findFirst({
    where: { gameId, userId, isCompleted: false },
    orderBy: { startedAt: "desc" },
  });

  if (existingSession) {
    console.log(`♻️  Menggunakan kembali & menyinkronkan sesi kuis: ${existingSession.id}`);
    
    const updatedSession = await prisma.gameSession.update({
      where: { id: existingSession.id },
      data: { 
        playerName: resolvedPlayerName,
        isCompleted: false 
      },
    });
    return { ...updatedSession, recommendedDifficulty };
  }

  const session = await prisma.gameSession.create({
    data: { 
      gameId, 
      userId,
      playerName: resolvedPlayerName
    },
  });

  await prisma.game.update({
    where: { id: gameId },
    data: { playCount: { increment: 1 } },
  });

  return { ...session, recommendedDifficulty };
};

export const submitAnswer = async (
  gameId: string,
  userId: string,
  questionIndex: number,
  selectedAnswer: any,
  playerName?: string,
  earnedPoints?: number,
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

  const redisKey = `leaderboard:${gameId}`;
  const identity = playerName || userId;
  await redis.zincrby(redisKey, score, identity);

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

export const finishGame = async (
  gameId: string,
  userId: string,
  payload: {
    scoreValue: number;
    maxScore: number;
    accuracy: number;
    timeSpent: number;
    answersDetail: any[];
    ltik?: string;
  },
) => {
  const session = await prisma.gameSession.findFirst({
    where: { gameId, userId, isCompleted: false },
    orderBy: { startedAt: "desc" },
  });
  console.log("========== FINISH DEBUG ==========");
  console.log("gameId:", gameId);
  console.log("userId:", userId);
  console.log("session:", session);
  console.log("==================================");

  const game = await prisma.game.findUnique({ where: { id: gameId } });
  if (!game) throw new Error("Game tidak ditemukan");

  // 🛠️ FIX SINKRONISASI UTAMA: Ambil nilai murni in-game siswa (300 XP / 520 XP) secara mutlak!
  let finalScore = payload.scoreValue !== undefined ? payload.scoreValue : 0;
  let finalAccuracy = payload.accuracy !== undefined ? payload.accuracy : 0;
  const maxPossibleScore = payload.maxScore > 0 ? payload.maxScore : 100;
  const content = game.gameJson as any;

  let totalQuestions = 0;
  let correctAnswers = 0;
  let aiGradingResult: any = null;

  // De-duplicate jawaban
  const uniqueAnswersMap = new Map();
  for (const ans of payload.answersDetail || []) {
    if (ans) {
      const key = ans.questionIndex !== undefined ? ans.questionIndex : (ans.word || ans.front || JSON.stringify(ans));
      uniqueAnswersMap.set(key, ans);
    }
  }
  const deDuplicatedAnswers = Array.from(uniqueAnswersMap.values());
  let tempMappedAnswers: any[] = [];

  // Verifikasi status isCorrect secara aman di backend untuk non-essay
  if (game.templateType !== TemplateType.ESSAY) {
    tempMappedAnswers = deDuplicatedAnswers.map((ans: any) => {
      let isAnsCorrect = false;
      switch (game.templateType) {
        case TemplateType.MULTIPLE_CHOICE:
          isAnsCorrect = MultipleChoiceService.verifyAnswer(content, ans.questionIndex, ans.selectedAnswer);
          break;
        case TemplateType.TRUE_FALSE:
          isAnsCorrect = TrueFalseService.verifyAnswer(content, ans.questionIndex, ans.selectedAnswer);
          break;
        case TemplateType.MATCHING:
          isAnsCorrect = MatchingService.verifyAnswer(content, ans.questionIndex, ans.selectedAnswer);
          break;
        case TemplateType.ANAGRAM:
          isAnsCorrect = AnagramService.verifyAnswer(content, ans.questionIndex, ans.selectedAnswer);
          break;
        case TemplateType.HANGMAN:
          isAnsCorrect = HangmanService.verifyAnswer(content, ans.questionIndex, ans.selectedAnswer);
          break;
        case TemplateType.WORD_SEARCH:
          isAnsCorrect = WordSearchService.verifyAnswer(content, ans.questionIndex, ans.selectedAnswer);
          break;
        case TemplateType.FLASHCARD:
          isAnsCorrect = FlashcardService.verifyAnswer(content, ans.questionIndex, ans.selectedAnswer);
          break;
        case TemplateType.MAZE_CHASE:
          isAnsCorrect = MazeChaseService.verifyAnswer(content, ans.questionIndex, ans.selectedAnswer);
          break;
        case TemplateType.SPIN_THE_WHEEL:
          isAnsCorrect = SpinTheWheelService.verifyAnswer(content, ans.questionIndex, ans.selectedAnswer);
          break;
      }
      return { ...ans, isCorrect: isAnsCorrect };
    });

    correctAnswers = tempMappedAnswers.filter((ans: any) => ans.isCorrect).length;
  }

  // Cari tahu total soal sebenarnya berdasarkan tipe template game
  if (game.templateType === TemplateType.MULTIPLE_CHOICE || game.templateType === TemplateType.TRUE_FALSE || game.templateType === TemplateType.MAZE_CHASE || game.templateType === TemplateType.SPIN_THE_WHEEL) {
    totalQuestions = content.questions?.length || 0;
  } else if (game.templateType === TemplateType.MATCHING) {
    totalQuestions = content.pairs?.length || 0;
  } else if (game.templateType === TemplateType.ANAGRAM || game.templateType === TemplateType.HANGMAN || game.templateType === TemplateType.WORD_SEARCH) {
    totalQuestions = content.words?.length || 0;
  } else if (game.templateType === TemplateType.FLASHCARD) {
    totalQuestions = content.cards?.length || 0;
  } else {
    totalQuestions = content.questions?.length || 0;
  }

  // 🛠️ CALCULATION OVERRIDE: Hitung pembagian poin per soal secara dinamis di riwayat siswa
  let updatedAnswersDetail: any[] = [];
  if (game.templateType !== TemplateType.ESSAY) {
    const pointsPerCorrectAnswer = correctAnswers > 0 ? Math.round(finalScore / correctAnswers) : 0;

    updatedAnswersDetail = tempMappedAnswers.map((ans: any) => ({
      ...ans,
      pointsEarned: ans.isCorrect ? pointsPerCorrectAnswer : 0,
      score: ans.isCorrect ? pointsPerCorrectAnswer : 0,
      points: ans.isCorrect ? pointsPerCorrectAnswer : 0
    }));
  } else {
    updatedAnswersDetail = deDuplicatedAnswers;
  }

  // Jika kuis bertipe ESSAY, jalankan AI grading engine seperti biasa
  if (game.templateType === TemplateType.ESSAY) {
    const gradingResults = [];
    updatedAnswersDetail = [];
    let totalAiScore = 0;

    for (const ans of payload.answersDetail) {
      const questionObj = content.questions[ans.questionIndex];
      if (questionObj) {
        const studentAnswer = ans.selectedAnswer?.trim() || "";
        if (!studentAnswer) {
          updatedAnswersDetail.push({
            questionIndex: ans.questionIndex,
            question: questionObj.question,
            selectedAnswer: "",
            isCorrect: false,
            pointsEarned: 0,
            justification: "Soal tidak dijawab.",
            correctAnswer: "",
            keywordsMatched: [],
            keywordsMissing: questionObj.keywords || [],
          });
          gradingResults.push({ questionIndex: ans.questionIndex, question: questionObj.question, answer: "", score: 0, justification: "Soal tidak dijawab.", correctAnswer: "" });
          continue;
        }

        let result;
        if (content.gradingMode === "KEYWORD") {
          const cleanAnswer = studentAnswer.toLowerCase().trim();
          const IGNORANCE_PATTERNS = /(tidak tahu|belum paham|tidak mengerti|no idea|don't know|kurang tahu|tidak paham)/i;
          const matched = (questionObj.keywords || []).filter((kw: string) => cleanAnswer.includes(kw.toLowerCase().trim()));
          const missing = (questionObj.keywords || []).filter((kw: string) => !matched.includes(kw));
          const matchedCount = matched.length;
          const totalKeywords = (questionObj.keywords || []).length;
          let score = totalKeywords > 0 ? Math.round((matchedCount / totalKeywords) * 100) : 50;
          let justification = `[Mode Gratis] Evaluasi kata kunci (${matchedCount}/${totalKeywords} kata kunci terdeteksi).`;
          if (IGNORANCE_PATTERNS.test(cleanAnswer)) { score = 0; justification = `Jawaban terdeteksi mengekspresikan ketidaktahuan.`; }
          result = { score, justification, correctAnswer: questionObj.answer || "Tinjau kembali materi.", keywordsMatched: matched, keywordsMissing: missing };
        } else {
          result = await SmartGradingService.gradeEssay(questionObj.question, questionObj.keywords, studentAnswer);
        }

        gradingResults.push({ questionIndex: ans.questionIndex, question: questionObj.question, answer: studentAnswer, score: result.score, justification: result.justification, correctAnswer: result.correctAnswer });
        updatedAnswersDetail.push({ questionIndex: ans.questionIndex, question: questionObj.question, selectedAnswer: studentAnswer, isCorrect: result.score >= 60, pointsEarned: result.score, justification: result.justification, correctAnswer: result.correctAnswer, keywordsMatched: result.keywordsMatched, keywordsMissing: result.keywordsMissing });
        totalAiScore += result.score;
      }
    }
    payload.answersDetail = updatedAnswersDetail;
    finalScore = Math.round(totalAiScore);
    finalAccuracy = totalQuestions > 0 ? Math.round(totalAiScore / totalQuestions) : 0;
    aiGradingResult = gradingResults;
  }

  if (game.templateType !== TemplateType.ESSAY) {
    if (payload.accuracy !== undefined) {
      finalAccuracy = payload.accuracy;
    }
  }

  // 🛠️ UPDATE REAL-TIME REDIS LEADERBOARD: Paksa timpa sisa poin kecepatan di Redis dengan nilai in-game murni siswa + sertakan metadata detail
  try {
    const redisKey = `leaderboard:${gameId}`;
    const activeSession = await prisma.gameSession.findFirst({
      where: { id: session?.id },
      select: { playerName: true }
    });
    const identity = activeSession?.playerName || userId;
    
    await redis.zadd(redisKey, finalScore, identity);

    const rawTopScores = await redis.zrevrange(redisKey, 0, 9, "WITHSCORES");
    const formattedScores: any[] = [];
    
    for (let i = 0; i < rawTopScores.length; i += 2) {
      const name = rawTopScores[i];
      const scoreStr = rawTopScores[i + 1];
      if (name !== undefined && scoreStr !== undefined) {
        if (name === identity) {
          formattedScores.push({
            name,
            score: parseInt(scoreStr, 10),
            accuracy: finalAccuracy,
            progress: `${correctAnswers}/${totalQuestions}`
          });
        } else {
          formattedScores.push({
            name,
            score: parseInt(scoreStr, 10),
            accuracy: finalAccuracy, 
            progress: `${totalQuestions}/${totalQuestions}`
          });
        }
      }
    }
    
    const io = getIO();
    if (game.shareCode) {
      io.to(game.shareCode).emit("ranking_update", formattedScores);
    }
  } catch (redisErr) {
    console.error("⚠️ Gagal menimpa ulang papan peringkat Redis:", redisErr);
  }

  // Fungsi pembantu sinkronisasi profil user
  const syncUserProfile = async (uId: string) => {
    try {
      const { getStudentAnalytics } = require("../analytics/analytics.service");
      const updatedAnalytics = await getStudentAnalytics(uId);
      const unlockedBadges = (updatedAnalytics.badges || []).filter((b: any) => b.isUnlocked);

      await prisma.userProfile.upsert({
        where: { userId: uId },
        update: { totalPoints: Math.round(updatedAnalytics.overview.totalXp), badges: unlockedBadges as Prisma.InputJsonValue },
        create: { userId: uId, bio: "Halo, saya pengguna baru WordIT!", totalPoints: Math.round(updatedAnalytics.overview.totalXp), badges: unlockedBadges as Prisma.InputJsonValue },
      });
      console.log(`✅ UserProfile synced for ${uId}`);
    } catch (profileError) {
      console.error("❌ Gagal memperbarui UserProfile:", profileError);
    }
  };

  if (!session) {
    console.warn(`⚠️ No active session found for user ${userId} game ${gameId}. Creating fallback session.`);
    let resolvedPlayerName = "Guest";
    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true },
      });
      if (user) resolvedPlayerName = user.name;
    }
    const newSession = await prisma.gameSession.create({
      data: { gameId, userId, playerName: resolvedPlayerName, isCompleted: true, finishedAt: new Date() },
    });

    const result = await prisma.result.upsert({
      where: { sessionId: newSession.id },
      update: { scoreValue: Math.round(finalScore), maxScore: maxPossibleScore, accuracy: finalAccuracy, timeSpent: payload.timeSpent, answersDetail: updatedAnswersDetail as Prisma.InputJsonValue, aiGradingResult: aiGradingResult as Prisma.InputJsonValue },
      create: { sessionId: newSession.id, scoreValue: Math.round(finalScore), maxScore: maxPossibleScore, accuracy: finalAccuracy, timeSpent: payload.timeSpent, difficultyPlayed: game.difficulty, answersDetail: updatedAnswersDetail as Prisma.InputJsonValue, aiGradingResult: aiGradingResult as Prisma.InputJsonValue },
    });

    await syncUserProfile(userId);
    // 🛠️ KUNCI SINKRONISASI OBJEK KEMBALIAN SISI FALLBACK
    return { session: newSession, result: { ...result, answersDetail: updatedAnswersDetail } };
  }

  const closedSession = await prisma.gameSession.update({
    where: { id: session.id },
    data: { isCompleted: true, finishedAt: new Date() },
  });

  const result = await prisma.result.upsert({
    where: { sessionId: session.id },
    update: {
      scoreValue: Math.round(finalScore),
      maxScore: maxPossibleScore,
      accuracy: finalAccuracy,
      timeSpent: payload.timeSpent,
      answersDetail: updatedAnswersDetail as Prisma.InputJsonValue,
      aiGradingResult: aiGradingResult as Prisma.InputJsonValue,
    },
    create: {
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

  console.log(`✅ Game finished securely: User ${userId}, Validated Score ${Math.round(finalScore)}`);
  await syncUserProfile(userId);

  if (payload.ltik) {
    try {
      await ltiProvider.Grade.scorePublish(payload.ltik, { scoreGiven: Math.round(finalScore), scoreMaximum: maxPossibleScore, activityProgress: 'Completed', gradingProgress: 'FullyGraded' });
    } catch (e) {
      console.error(`❌ [LTI] Gagal mengirim nilai ke Moodle:`, e);
    }
  }

  // 🛠️ KUNCI SINKRONISASI UTAMA: Kembalikan objek array answersDetail ter-override agar ditangkap Axios frontend
  return { session: closedSession, result: { ...result, answersDetail: updatedAnswersDetail } };
};

// ═══════════════ TEMPLATE MAPPING ═══════════════

export const getTemplatesByLevel = async (educationLevel: EducationLevel) => {
  const templateMapping: Record<EducationLevel, TemplateType[]> = {
    SD: [
      TemplateType.FLASHCARD,
      TemplateType.HANGMAN,
      TemplateType.WORD_SEARCH,
      TemplateType.ANAGRAM,
      TemplateType.MAZE_CHASE,
      TemplateType.MULTIPLE_CHOICE,
      TemplateType.TRUE_FALSE,
      TemplateType.MATCHING,
      TemplateType.ESSAY,
    ],
    SMP: [
      TemplateType.FLASHCARD,
      TemplateType.HANGMAN,
      TemplateType.WORD_SEARCH,
      TemplateType.ANAGRAM,
      TemplateType.MAZE_CHASE,
      TemplateType.MULTIPLE_CHOICE,
      TemplateType.TRUE_FALSE,
      TemplateType.MATCHING,
      TemplateType.ESSAY,
    ],
    SMA: [
      TemplateType.FLASHCARD,
      TemplateType.ANAGRAM,
      TemplateType.SPIN_THE_WHEEL,
      TemplateType.MULTIPLE_CHOICE,
      TemplateType.TRUE_FALSE,
      TemplateType.MATCHING,
      TemplateType.ESSAY,
    ],
    UNIVERSITY: [
      TemplateType.FLASHCARD,
      TemplateType.ANAGRAM,
      TemplateType.SPIN_THE_WHEEL,
      TemplateType.MULTIPLE_CHOICE,
      TemplateType.TRUE_FALSE,
      TemplateType.MATCHING,
      TemplateType.ESSAY,
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
    MULTIPLE_CHOICE: "Kuis pilihan ganda klasik dengan 4 opsi jawaban",
    TRUE_FALSE: "Tentukan pernyataan benar atau salah dengan cepat",
    MATCHING: "Pasangkan pernyataan di kolom kiri dengan jawaban di kolom kanan",
    ESSAY: "Jawab pertanyaan secara terbuka dengan penilaian otomatis dari AI",
  };
  return descriptions[type] ?? "";
};

export const saveLeaderboard = async (
  roomCode: string,
  finalPlayers: any[],
) => {
  try {
    const game = await prisma.game.findFirst({
      where: { shareCode: roomCode.toUpperCase() },
    });
    if (!game) return;

    // Calculate dynamic maxScore based on template content questions/words/pairs/cards count
    const content = game.gameJson as any;
    let totalQuestions = 0;
    if (game.templateType === TemplateType.MULTIPLE_CHOICE || game.templateType === TemplateType.TRUE_FALSE || game.templateType === TemplateType.MAZE_CHASE || game.templateType === TemplateType.SPIN_THE_WHEEL) {
      totalQuestions = content?.questions?.length || 0;
    } else if (game.templateType === TemplateType.MATCHING) {
      totalQuestions = content?.pairs?.length || 0;
    } else if (game.templateType === TemplateType.ANAGRAM || game.templateType === TemplateType.HANGMAN || game.templateType === TemplateType.WORD_SEARCH) {
      totalQuestions = content?.words?.length || 0;
    } else if (game.templateType === TemplateType.FLASHCARD) {
      totalQuestions = content?.cards?.length || 0;
    } else {
      totalQuestions = content?.questions?.length || 0;
    }
    const dynamicMaxScore = totalQuestions * 100 || 100;

    // 1. Tutup semua sesi aktif untuk kuis ini
    await prisma.gameSession.updateMany({
      where: { gameId: game.id, isCompleted: false },
      data: { isCompleted: true, finishedAt: new Date() },
    });

    // 2. Simpan skor pemain guest/simulator/siswa ke dalam database
    for (const player of finalPlayers) {
      if (!player.name) continue;

      // Cek sesi terakhir dari pemain ini (baik siswa terdaftar maupun guest)
      const existingSession = await prisma.gameSession.findFirst({
        where: {
          gameId: game.id,
          ...(player.userId 
            ? { userId: player.userId } 
            : { playerName: player.name })
        },
        orderBy: { startedAt: "desc" },
        include: { result: true },
      });

      if (!existingSession) {
        // Buat sesi baru untuk guest/tester/siswa jika belum pernah terdaftar sama sekali
        const newSession = await prisma.gameSession.create({
          data: {
            gameId: game.id,
            playerName: player.name,
            userId: player.userId || null,
            isCompleted: true,
            finishedAt: new Date(),
          },
        });

        // Buat data hasil nilai untuk sesi tersebut
        await prisma.result.create({
          data: {
            sessionId: newSession.id,
            scoreValue: player.score || 0,
            maxScore: dynamicMaxScore,
            accuracy: player.accuracy !== undefined ? player.accuracy : 100,
            timeSpent: player.timeSpent || 60,
            difficultyPlayed: game.difficulty,
            answersDetail: [],
          },
        });
        console.log(`💾 Persisted player session & score: ${player.name} (${player.score} pts, userId: ${player.userId || "Guest"})`);
      } else {
        // Update userId jika sebelumnya belum terasosiasi tapi sekarang ada userId
        if (!existingSession.userId && player.userId) {
          await prisma.gameSession.update({
            where: { id: existingSession.id },
            data: { userId: player.userId }
          });
        }

        // Ambil nilai yang sudah ada dari database jika ada untuk dibandingkan
        const existingResult = existingSession.result;
        const currentScore = existingResult?.scoreValue ?? 0;
        const currentAccuracy = existingResult?.accuracy ?? 0;
        const currentTimeSpent = existingResult?.timeSpent ?? 999999;

        const newScore = Math.max(currentScore, player.score || 0);
        const newAccuracy = Math.max(currentAccuracy, player.accuracy !== undefined ? player.accuracy : 0);
        const newTimeSpent = Math.min(currentTimeSpent, player.timeSpent || 60);

        // Upsert hasil nilai untuk sesi terakhir agar skor terupdate (Case Remidi / Penyelesaian Sesi)
        await prisma.result.upsert({
          where: { sessionId: existingSession.id },
          update: {
            scoreValue: newScore,
            accuracy: newAccuracy,
            timeSpent: newTimeSpent === 999999 ? 60 : newTimeSpent,
            maxScore: dynamicMaxScore,
          },
          create: {
            sessionId: existingSession.id,
            scoreValue: player.score || 0,
            maxScore: dynamicMaxScore,
            accuracy: player.accuracy !== undefined ? player.accuracy : 100,
            timeSpent: player.timeSpent || 60,
            difficultyPlayed: game.difficulty,
            answersDetail: [],
          },
        });
        console.log(`💾 Synced player score for existing session: ${player.name} (${newScore} pts, sessionId: ${existingSession.id})`);
      }
    }

    console.log(`✅ Sesi game ${roomCode} berhasil ditutup dan data leaderboard disimpan.`);
  } catch (error) {
    console.error("❌ Gagal menyimpan leaderboard:", error);
  }
};