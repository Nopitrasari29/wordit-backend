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

  // Cari semua session ID untuk game ini
  const sessions = await prisma.gameSession.findMany({
    where: { gameId },
    select: { id: true },
  });
  const sessionIds = sessions.map((s) => s.id);

  // Jalankan penghapusan berantai dalam satu transaksi yang aman
  await prisma.$transaction(async (tx) => {
    // 0. Hapus LtiContext terlebih dahulu untuk menghindari Foreign Key Violation
    await tx.ltiContext.deleteMany({
      where: { gameId },
    });

    if (sessionIds.length > 0) {
      // 1. Hapus Results yang menginduk ke GameSession
      await tx.result.deleteMany({
        where: { sessionId: { in: sessionIds } },
      });

      // 2. Hapus GameSessions yang menginduk ke Game
      await tx.gameSession.deleteMany({
        where: { gameId },
      });
    }

    // 3. Terakhir, baru hapus Game utamanya
    await tx.game.delete({ where: { id: gameId } });
  });

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

export const startGame = async (gameId: string, userId: string) => {
  const game = await prisma.game.findUnique({ where: { id: gameId } });
  if (!game || !game.isPublished) throw new Error("Game tidak tersedia");

  // 🧠 PANGGIL LOGIKA ADAPTIVE DIFFICULTY
  const recommendedDifficulty = await getAdaptiveDifficulty(userId);
  console.log(
    `🧠 Adaptive Difficulty untuk User ${userId}: Direkomendasikan level ${recommendedDifficulty}`,
  );

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
      isCorrect = AnagramService.verifyAnswer(
        game.gameJson,
        questionIndex,
        selectedAnswer,
      );
      break;
    case TemplateType.FLASHCARD:
      isCorrect = FlashcardService.verifyAnswer(
        game.gameJson,
        questionIndex,
        selectedAnswer,
      );
      break;
    case TemplateType.HANGMAN:
      isCorrect = HangmanService.verifyAnswer(
        game.gameJson,
        questionIndex,
        selectedAnswer,
      );
      break;
    case TemplateType.WORD_SEARCH:
      isCorrect = WordSearchService.verifyAnswer(
        game.gameJson,
        questionIndex,
        selectedAnswer,
      );
      break;
    case TemplateType.MAZE_CHASE:
      isCorrect = MazeChaseService.verifyAnswer(
        game.gameJson,
        questionIndex,
        selectedAnswer,
      );
      break;
    case TemplateType.SPIN_THE_WHEEL:
      isCorrect = SpinTheWheelService.verifyAnswer(
        game.gameJson,
        questionIndex,
        selectedAnswer,
      );
      break;

    // ✅ NEW STANDARD ASSESSMENT INTEGRATION
    case TemplateType.MULTIPLE_CHOICE:
      isCorrect = MultipleChoiceService.verifyAnswer(
        game.gameJson,
        questionIndex,
        selectedAnswer,
      );
      break;
    case TemplateType.TRUE_FALSE:
      isCorrect = TrueFalseService.verifyAnswer(
        game.gameJson,
        questionIndex,
        selectedAnswer,
      );
      break;
    case TemplateType.MATCHING:
      isCorrect = MatchingService.verifyAnswer(
        game.gameJson,
        questionIndex,
        selectedAnswer,
      );
      break;
    case TemplateType.ESSAY:
      isCorrect = EssayService.verifyAnswer(
        game.gameJson,
        questionIndex,
        selectedAnswer,
      );
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
    ltik?: string;
  },
) => {
  const session = await prisma.gameSession.findFirst({
    where: { gameId, userId, isCompleted: false },
    orderBy: { startedAt: "desc" },
  });

  const game = await prisma.game.findUnique({ where: { id: gameId } });
  if (!game) throw new Error("Game tidak ditemukan");

  let finalScore = payload.scoreValue;
  let finalAccuracy = payload.accuracy;
  const maxPossibleScore = payload.maxScore > 0 ? payload.maxScore : 100;
  const content = game.gameJson as any;

  let totalQuestions = 0;
  let correctAnswers = 0;

  let aiGradingResult: any = null;
  let updatedAnswersDetail: any[] = payload.answersDetail;

  // 1. Map `isCorrect` status for non-essay templates to prevent client spoofing
  if (game.templateType !== TemplateType.ESSAY) {
    updatedAnswersDetail = (payload.answersDetail || []).map((ans: any) => {
      let isAnsCorrect = false;
      switch (game.templateType) {
        case TemplateType.MULTIPLE_CHOICE:
          isAnsCorrect = MultipleChoiceService.verifyAnswer(
            content,
            ans.questionIndex,
            ans.selectedAnswer
          );
          break;
        case TemplateType.TRUE_FALSE:
          isAnsCorrect = TrueFalseService.verifyAnswer(
            content,
            ans.questionIndex,
            ans.selectedAnswer
          );
          break;
        case TemplateType.MATCHING:
          isAnsCorrect = MatchingService.verifyAnswer(
            content,
            ans.questionIndex,
            ans.selectedAnswer
          );
          break;
        case TemplateType.ANAGRAM:
          isAnsCorrect = AnagramService.verifyAnswer(
            content,
            ans.questionIndex,
            ans.selectedAnswer
          );
          break;
        case TemplateType.HANGMAN:
          isAnsCorrect = HangmanService.verifyAnswer(
            content,
            ans.questionIndex,
            ans.selectedAnswer
          );
          break;
        case TemplateType.WORD_SEARCH:
          isAnsCorrect = WordSearchService.verifyAnswer(
            content,
            ans.questionIndex,
            ans.selectedAnswer
          );
          break;
        case TemplateType.FLASHCARD:
          isAnsCorrect = FlashcardService.verifyAnswer(
            content,
            ans.questionIndex,
            ans.selectedAnswer
          );
          break;
        case TemplateType.MAZE_CHASE:
          isAnsCorrect = MazeChaseService.verifyAnswer(
            content,
            ans.questionIndex,
            ans.selectedAnswer
          );
          break;
        case TemplateType.SPIN_THE_WHEEL:
          isAnsCorrect = SpinTheWheelService.verifyAnswer(
            content,
            ans.questionIndex,
            ans.selectedAnswer
          );
          break;
      }
      return { ...ans, isCorrect: isAnsCorrect };
    });

    correctAnswers = updatedAnswersDetail.filter((ans: any) => ans.isCorrect).length;
  }

  // 2. Recalculate score and accuracy securely on backend
  if (game.templateType === TemplateType.MULTIPLE_CHOICE) {
    totalQuestions = content.questions?.length || 0;
    finalAccuracy =
      totalQuestions > 0
        ? Math.round((correctAnswers / totalQuestions) * 100)
        : 0;
    finalScore = MultipleChoiceService.calculateScore(
      { ...payload, accuracy: finalAccuracy, answers: updatedAnswersDetail },
      content
    );
  } else if (game.templateType === TemplateType.TRUE_FALSE) {
    totalQuestions = content.questions?.length || 0;
    finalAccuracy =
      totalQuestions > 0
        ? Math.round((correctAnswers / totalQuestions) * 100)
        : 0;
    finalScore = TrueFalseService.calculateScore(
      { ...payload, accuracy: finalAccuracy, answers: updatedAnswersDetail },
      content
    );
  } else if (game.templateType === TemplateType.MATCHING) {
    totalQuestions = content.pairs?.length || 0;
    finalAccuracy =
      totalQuestions > 0
        ? Math.round((correctAnswers / totalQuestions) * 100)
        : 0;
    finalScore = MatchingService.calculateScore(
      { ...payload, accuracy: finalAccuracy, answers: updatedAnswersDetail },
      content
    );
  } else if (game.templateType === TemplateType.ANAGRAM) {
    totalQuestions = content.words?.length || 0;
    finalAccuracy =
      totalQuestions > 0
        ? Math.round((correctAnswers / totalQuestions) * 100)
        : 0;
    finalScore = AnagramService.calculateScore(
      { ...payload, accuracy: finalAccuracy, answers: updatedAnswersDetail },
      content
    );
  } else if (game.templateType === TemplateType.HANGMAN) {
    totalQuestions = content.words?.length || 0;
    finalAccuracy =
      totalQuestions > 0
        ? Math.round((correctAnswers / totalQuestions) * 100)
        : 0;
    finalScore = HangmanService.calculateScore(
      { ...payload, accuracy: finalAccuracy, answers: updatedAnswersDetail },
      content
    );
  } else if (game.templateType === TemplateType.WORD_SEARCH) {
    totalQuestions = content.words?.length || 0;
    finalAccuracy =
      totalQuestions > 0
        ? Math.round((correctAnswers / totalQuestions) * 100)
        : 0;
    finalScore = WordSearchService.calculateScore({
      ...payload,
      accuracy: finalAccuracy,
      answers: updatedAnswersDetail,
    });
  } else if (game.templateType === TemplateType.FLASHCARD) {
    totalQuestions = content.cards?.length || 0;
    finalAccuracy =
      totalQuestions > 0
        ? Math.round((correctAnswers / totalQuestions) * 100)
        : 0;
    finalScore = FlashcardService.calculateScore({
      ...payload,
      accuracy: finalAccuracy,
      answers: updatedAnswersDetail,
    });
  } else if (game.templateType === TemplateType.MAZE_CHASE) {
    totalQuestions = content.questions?.length || 0;
    finalAccuracy =
      totalQuestions > 0
        ? Math.round((correctAnswers / totalQuestions) * 100)
        : 0;
    finalScore = MazeChaseService.calculateScore({
      ...payload,
      accuracy: finalAccuracy,
      answers: updatedAnswersDetail,
    });
  } else if (game.templateType === TemplateType.SPIN_THE_WHEEL) {
    totalQuestions = content.questions?.length || 0;
    finalAccuracy =
      totalQuestions > 0
        ? Math.round((correctAnswers / totalQuestions) * 100)
        : 0;
    finalScore = SpinTheWheelService.calculateScore({
      ...payload,
      accuracy: finalAccuracy,
      answers: updatedAnswersDetail,
    });
  } else if (game.templateType === TemplateType.ESSAY) {
    totalQuestions = content.questions?.length || 0;
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
          gradingResults.push({
            questionIndex: ans.questionIndex,
            question: questionObj.question,
            answer: "",
            score: 0,
            justification: "Soal tidak dijawab.",
            correctAnswer: "",
          });
          continue;
        }

        let result;
        if (content.gradingMode === "KEYWORD") {
          console.log("[Smart Grading] Bypassing AI: Menggunakan mode penilaian KEYWORD gratis...");
          const cleanAnswer = studentAnswer.toLowerCase().trim();
          const matched = (questionObj.keywords || []).filter((kw: string) => {
            const cleanKw = kw.toLowerCase().trim();
            return cleanAnswer.includes(cleanKw);
          });
          const missing = (questionObj.keywords || []).filter((kw: string) => !matched.includes(kw));

          const matchedCount = matched.length;
          const totalKeywords = (questionObj.keywords || []).length;
          const score = totalKeywords > 0
            ? Math.round((matchedCount / totalKeywords) * 100)
            : 50;

          result = {
            score,
            justification: `[Mode Gratis] Evaluasi selesai menggunakan pencocokan kata kunci (${matchedCount}/${totalKeywords} kata kunci terdeteksi).`,
            correctAnswer: questionObj.answer || "Tinjau kembali materi untuk jawaban ideal selengkapnya.",
            keywordsMatched: matched,
            keywordsMissing: missing,
          };
        } else {
          result = await SmartGradingService.gradeEssay(
            questionObj.question,
            questionObj.keywords,
            studentAnswer
          );
        }

        gradingResults.push({
          questionIndex: ans.questionIndex,
          question: questionObj.question,
          answer: studentAnswer,
          score: result.score,
          justification: result.justification,
          correctAnswer: result.correctAnswer,
        });

        updatedAnswersDetail.push({
          questionIndex: ans.questionIndex,
          question: questionObj.question,
          selectedAnswer: studentAnswer,
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
    finalScore = Math.round(totalAiScore);
    finalAccuracy =
      totalQuestions > 0 ? Math.round(totalAiScore / totalQuestions) : 0;
    aiGradingResult = gradingResults;
  }

  // Helper to sync user profile XP & Badges
  const syncUserProfile = async (uId: string) => {
    try {
      const { getStudentAnalytics } = require("../analytics/analytics.service");
      const updatedAnalytics = await getStudentAnalytics(uId);
      const unlockedBadges = (updatedAnalytics.badges || []).filter(
        (b: any) => b.isUnlocked
      );

      await prisma.userProfile.upsert({
        where: { userId: uId },
        update: {
          totalPoints: Math.round(updatedAnalytics.overview.totalXp),
          badges: unlockedBadges as Prisma.InputJsonValue,
        },
        create: {
          userId: uId,
          bio: "Halo, saya pengguna baru WordIT!",
          totalPoints: Math.round(updatedAnalytics.overview.totalXp),
          badges: unlockedBadges as Prisma.InputJsonValue,
        },
      });
      console.log(
        `✅ UserProfile synced for ${uId}: XP = ${updatedAnalytics.overview.totalXp}, Badges count = ${unlockedBadges.length}`
      );
    } catch (profileError) {
      console.error("❌ Gagal memperbarui UserProfile:", profileError);
    }
  };

  // Jika tidak ada sesi aktif, buat satu baru dan langsung selesaikan
  if (!session) {
    console.warn(
      `⚠️ No active session found for user ${userId} game ${gameId}. Creating one.`,
    );
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

    await syncUserProfile(userId);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    await createSystemLog({
      action: "FINISH_GAME",
      details: `Student finished game "${game.title}" with score ${Math.round(finalScore)}/${maxPossibleScore} (${finalAccuracy}% accuracy)`,
      userId,
      userName: user?.name || "Unknown",
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

  console.log(
    `✅ Game finished: User ${userId}, Validated Score ${Math.round(finalScore)}, Accuracy ${finalAccuracy}%`,
  );

  await syncUserProfile(userId);

  // =========================================================================
  // 🎓 MOODLE LTI GRADE PASSBACK INTERCEPTOR
  // =========================================================================
  if (payload.ltik) {
    console.log(`🎓 [LTI] LTI Token terdeteksi! Mempersiapkan sinkronisasi nilai ke Moodle...`);
    // TODO: Implementasi LTIJS ScorePublish akan ditaruh di sini nanti
    /*
    try {
      await ltijs.Grade.ScorePublish(payload.ltik, {
        scoreGiven: Math.round(finalScore),
        scoreMaximum: maxPossibleScore,
        activityProgress: 'Completed',
        gradingProgress: 'FullyGraded'
      });
      console.log(`✅ [LTI] Berhasil mengirim nilai ${Math.round(finalScore)} ke Moodle Gradebook!`);
    } catch (e) {
      console.error(`❌ [LTI] Gagal mengirim nilai ke Moodle:`, e);
    }
    */
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  await createSystemLog({
    action: "FINISH_GAME",
    details: `Student finished game "${game.title}" with score ${Math.round(finalScore)}/${maxPossibleScore} (${finalAccuracy}% accuracy)`,
    userId,
    userName: user?.name || "Unknown",
  });

  return { session: closedSession, result };
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
    // Penjelasan untuk Standard Assessment
    MULTIPLE_CHOICE: "Kuis pilihan ganda klasik dengan 4 opsi jawaban",
    TRUE_FALSE: "Tentukan pernyataan benar atau salah dengan cepat",
    MATCHING:
      "Pasangkan pernyataan di kolom kiri dengan jawaban di kolom kanan",
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

    await prisma.gameSession.updateMany({
      where: { gameId: game.id, isCompleted: false },
      data: { isCompleted: true, finishedAt: new Date() },
    });
    console.log(`✅ Sesi game ${roomCode} berhasil ditutup.`);
  } catch (error) {
    console.error("❌ Gagal menyimpan leaderboard:", error);
  }
};
