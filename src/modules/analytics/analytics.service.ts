import { prisma } from "../../config/database";
import { Prisma, EducationLevel, Role, ApprovalStatus } from "@prisma/client";

// =====================================================================
// 🏅 BADGE COMPUTATION (FE-19 Gamification)
// =====================================================================
const computeBadges = (
  totalGamesPlayed: number,
  averageScore: number,
  recentHistory: { score: number; timeSpent: number }[],
) => {
  const allBadges = [
    {
      name: "First Blood",
      icon: "🩸",
      color: "bg-rose-100",
      description: "Selesaikan kuis pertamamu",
      isUnlocked: totalGamesPlayed >= 1,
    },
    {
      name: "Rajin Belajar",
      icon: "📚",
      color: "bg-blue-100",
      description: "Mainkan lebih dari 5 kuis",
      isUnlocked: totalGamesPlayed >= 5,
    },
    {
      name: "Master Quiz",
      icon: "🏆",
      color: "bg-amber-100",
      description: "Mainkan lebih dari 20 kuis",
      isUnlocked: totalGamesPlayed >= 20,
    },
    {
      name: "Brainiac",
      icon: "🧠",
      color: "bg-indigo-100",
      description: "Rata-rata skor di atas 85",
      isUnlocked: totalGamesPlayed >= 1 && averageScore >= 85,
    },
    {
      name: "Perfectionist",
      icon: "💎",
      color: "bg-purple-100",
      description: "Raih skor 100 minimal sekali",
      isUnlocked: recentHistory.some((h) => h.score === 100),
    },
    {
      name: "Fast & Furious",
      icon: "⚡",
      color: "bg-yellow-100",
      description: "Selesaikan kuis dalam waktu kurang dari 60 detik",
      isUnlocked: recentHistory.some((h) => h.timeSpent > 0 && h.timeSpent < 60),
    },
    {
      name: "Konsisten",
      icon: "🎯",
      color: "bg-emerald-100",
      description: "Rata-rata akurasi di atas 70% dari minimal 3 kuis",
      isUnlocked: totalGamesPlayed >= 3 && averageScore >= 70,
    },
  ];
  return allBadges;
};

// =====================================================================
// 👨‍🎓 STUDENT ANALYTICS (BE-15)
// =====================================================================
export const getStudentAnalytics = async (userId: string) => {
  const stats = await prisma.result.aggregate({
    where: { session: { userId: userId } },
    _avg: { scoreValue: true, accuracy: true },
    _sum: { timeSpent: true, scoreValue: true },
    _max: { scoreValue: true },
    _count: { id: true },
  });

  const recentHistory = await prisma.gameSession.findMany({
    where: { userId: userId, isCompleted: true },
    include: {
      game: { select: { title: true, templateType: true, difficulty: true } },
      result: { select: { scoreValue: true, accuracy: true, timeSpent: true } },
    },
    orderBy: { finishedAt: "desc" },
    take: 5,
  });

  const recentForBadge = recentHistory.map((s) => ({
    score: s.result?.scoreValue || 0,
    timeSpent: s.result?.timeSpent || 0,
  }));

  const badges = computeBadges(
    stats._count.id || 0,
    Math.round(stats._avg.scoreValue || 0),
    recentForBadge,
  );

  const lowestScore = await prisma.result.aggregate({
    where: { session: { userId: userId } },
    _min: { scoreValue: true }
  });

  const allResults = await prisma.result.findMany({
    where: { session: { userId: userId } },
    select: { answersDetail: true }
  });

  const questionMistakes: Record<string, number> = {};
  allResults.forEach(res => {
    const answers = (res.answersDetail as any[]) || [];
    answers.forEach(ans => {
      if (ans.isCorrect === false && ans.question) {
        questionMistakes[ans.question] = (questionMistakes[ans.question] || 0) + 1;
      }
    });
  });

  let mostFrequentMistake = null;
  let maxMistakes = 0;
  for (const [q, count] of Object.entries(questionMistakes)) {
    if (count > maxMistakes) {
      maxMistakes = count;
      mostFrequentMistake = q;
    }
  }

  return {
    overview: {
      totalGamesPlayed: stats._count.id || 0,
      highestScore: stats._max.scoreValue || 0,
      lowestScore: lowestScore._min.scoreValue || 0,
      averageScore: Math.round(stats._avg.scoreValue || 0),
      averageAccuracy: Math.round(stats._avg.accuracy || 0),
      totalXp: stats._sum.scoreValue || 0, 
      totalTimeSpentSeconds: stats._sum.timeSpent || 0,
      mostFrequentMistake: mostFrequentMistake
    },
    recentHistory: recentHistory.map((session) => ({
      sessionId: session.id,
      gameTitle: session.game.title,
      templateType: session.game.templateType,
      difficulty: session.game.difficulty,
      score: session.result?.scoreValue || 0,
      accuracy: session.result?.accuracy || 0,
      timeSpent: session.result?.timeSpent || 0,
      finishedAt: session.finishedAt,
    })),
    badges,
  };
};

// =====================================================================
// 👨‍🏫 TEACHER ANALYTICS (BE-16 - GAME SPECIFIC FOR DASHBOARD SELECT)
// =====================================================================
export const getGameAnalyticsForTeacher = async (gameId: string, creatorId: string) => {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { id: true, title: true, creatorId: true, gameJson: true },
  });

  if (!game || game.creatorId !== creatorId) {
    throw new Error("Game tidak ditemukan atau kamu tidak memiliki akses.");
  }

  const results = await prisma.result.findMany({
    where: { session: { gameId } },
    select: {
      sessionId: true,
      scoreValue: true,
      accuracy: true,
      answersDetail: true,
    },
  });

  const sessionIds = results.map((res) => res.sessionId);
  const sessions = await prisma.gameSession.findMany({
    where: { id: { in: sessionIds } },
    select: { id: true, playerName: true }, 
  });
  
  const sessionNameMap: Record<string, string> = Object.fromEntries(
    sessions.map((session) => [session.id, session.playerName || "TANPA_NAMA"]),
  );

  const groupStats: Record<string, { totalScore: number; totalAccuracy: number; count: number }> = {};
  const questionMistakes: Record<number, number> = {};

  results.forEach((res) => {
    const currentName = sessionNameMap[res.sessionId] || "TANPA_NAMA";
    const match = currentName.match(/^([^_]+)_/);
    const className = match?.[1]?.toUpperCase() || "TANPA_KELAS";

    if (!groupStats[className]) {
      groupStats[className] = { totalScore: 0, totalAccuracy: 0, count: 0 };
    }
    const entry = groupStats[className]!;
    entry.totalScore += res.scoreValue;
    entry.totalAccuracy += res.accuracy || 0;
    entry.count += 1;

    const answers = (res.answersDetail as any[]) || [];
    answers.forEach((ans: any) => {
      if (ans.isCorrect === false) {
        const idx = ans.questionIndex;
        questionMistakes[idx] = (questionMistakes[idx] || 0) + 1;
      }
    });
  });

  const classDistribution = Object.entries(groupStats).map(([name, data]) => ({
    groupName: name,
    averageScore: Math.round(data.totalScore / data.count),
    averageAccuracy: Math.round(data.totalAccuracy / data.count),
    studentCount: data.count,
  }));

  const gameContent = game.gameJson as any;
  const questionsList = gameContent?.questions || gameContent?.words || gameContent?.cards || [];

  const difficultQuestions = Object.entries(questionMistakes)
    .map(([idx, count]) => {
      const qIndex = parseInt(idx);
      let questionText = `Pertanyaan #${qIndex + 1}`;
      const targetQuestion = questionsList[qIndex];
      if (targetQuestion) {
        questionText = targetQuestion.question || targetQuestion.word || targetQuestion.front || questionText;
      }
      return {
        questionIndex: qIndex,
        questionText,
        mistakeCount: count,
      };
    })
    .sort((a, b) => b.mistakeCount - a.mistakeCount);

  const allStudentsData = results.map((r) => {
    const currentName = sessionNameMap[r.sessionId] || "Anonymous";
    const match = currentName.match(/^([^_]+)_/);
    return {
      id: r.sessionId,
      name: currentName,
      className: match?.[1]?.toUpperCase() || "TANPA_KELAS",
      gameName: game.title,
      score: r.scoreValue,
      accuracy: r.accuracy ?? 0,
    };
  });

  const atRiskStudents = allStudentsData.filter((student) => student.accuracy < 70);

  return {
    gameTitle: game.title,
    summary: {
      totalParticipants: results.length,
      averageAccuracy: results.length > 0 ? Math.round(results.reduce((acc, r) => acc + r.accuracy, 0) / results.length) : 0,
    },
    classDistribution,
    difficultQuestions: difficultQuestions.slice(0, 5),
    allStudentsData,
    atRiskStudents,
  };
};

// ═════════════════════════════════════════════════════════════════════
// 🏫 GET TEACHER CLASSES ANALYTICS (GLOBAL REPORT ACTION)
// ═════════════════════════════════════════════════════════════════════
export const getTeacherClassesAnalytics = async (teacherId: string, educationLevel?: string, classGrade?: string) => {
  const whereFilter: Prisma.GameWhereInput = { creatorId: teacherId };
  if (educationLevel && educationLevel !== "ALL") {
    whereFilter.educationLevel = educationLevel as EducationLevel;
  }
  if (classGrade && classGrade !== "ALL") {
    whereFilter.classGrade = { contains: classGrade, mode: "insensitive" };
  }

  const games = await prisma.game.findMany({
    where: whereFilter,
    select: { id: true, title: true, gameJson: true },
  });

  const gameIds = games.map((g) => g.id);
  const gameJsonMap: Record<string, any> = {};
  games.forEach((g) => { gameJsonMap[g.id] = g.gameJson; });

  const results = await prisma.result.findMany({
    where: {
      session: { gameId: { in: gameIds }, userId: { not: teacherId } },
    },
    include: {
      session: {
        select: {
          id: true,
          playerName: true, 
          userId: true,     
          gameId: true,
          game: { select: { title: true } },
        },
      },
    },
  });

  const extractGroup = (playerName: string): string => {
    const match = playerName.match(/^(.+?)[_\-\s]/);
    const groupName = match?.[1]?.trim();
    return groupName ? groupName.toUpperCase() : "UMUM";
  };

  const groupMap: Record<string, { totalScore: number; totalAccuracy: number; count: number; studentIdentifiers: Set<string> }> = {};
  const questionMistakes: Record<string, { count: number; text: string }> = {};

  results.forEach((r) => {
    const pName = r.session.playerName || "UMUM_PLAYER";
    const group = extractGroup(pName);
    
    if (!groupMap[group]) {
      groupMap[group] = { totalScore: 0, totalAccuracy: 0, count: 0, studentIdentifiers: new Set() };
    }
    const entry = groupMap[group]!;
    entry.totalScore += r.scoreValue;
    entry.totalAccuracy += r.accuracy ?? 0;
    entry.count += 1;
    entry.studentIdentifiers.add(r.session.userId || pName);

    // Hitung soal tersulit global dengan ekstraksi teks pertanyaan dinamis
    const answers = (r.answersDetail as any[]) || [];
    const gJson = gameJsonMap[r.session.gameId];
    const questionsList = gJson?.questions || gJson?.words || gJson?.cards || [];

    answers.forEach((ans: any) => {
      if (ans.isCorrect === false) {
        const idx = ans.questionIndex;
        const key = `${r.session.gameId}_${idx}`;
        let txt = ans.question || `Pertanyaan #${idx + 1}`;
        if (questionsList[idx]) {
          txt = questionsList[idx].question || questionsList[idx].word || questionsList[idx].front || txt;
        }
        if (!questionMistakes[key]) {
          questionMistakes[key] = { count: 0, text: txt };
        }
        questionMistakes[key]!.count += 1;
      }
    });
  });

  const classesData = Object.entries(groupMap).map(([groupName, data]) => ({
    id: groupName,
    name: groupName,
    students: data.studentIdentifiers.size,
    averageScore: data.count > 0 ? Math.round(data.totalScore / data.count) : 0,
    averageAccuracy: data.count > 0 ? Math.round(data.totalAccuracy / data.count) : 0,
    totalPlays: data.count,
    icon: "🏫",
  }));

  const atRiskStudents = results
    .filter((r) => (r.accuracy ?? 0) < 70) 
    .map((r) => {
      const currentName = r.session.playerName || "Anonymous";
      return {
        id: r.id,
        name: currentName, 
        className: extractGroup(currentName),
        gameName: r.session.game.title,
        score: r.scoreValue,
        issue: (r.accuracy ?? 0) < 50 ? "Akurasi sangat rendah" : "Nilai di bawah batas KKM kuis",
      };
    })
    .slice(0, 10);

  const allStudentsData = results.map((r) => {
    const currentName = r.session.playerName || "Anonymous";
    return {
      id: r.id,
      name: currentName, 
      className: extractGroup(currentName),
      gameName: r.session.game.title,
      score: r.scoreValue,
      accuracy: r.accuracy ?? 0,
    };
  });

  const difficultQuestions = Object.entries(questionMistakes)
    .map(([key, q]) => ({
      questionIndex: parseInt(key.split("_")[1]!),
      questionText: q.text,
      mistakeCount: q.count
    }))
    .sort((a, b) => b.mistakeCount - a.mistakeCount)
    .slice(0, 5);

  return {
    classes: classesData,
    atRiskStudents,
    allStudentsData,
    difficultQuestions
  };
};

// =====================================================================
// 🧠 ADAPTIVE DIFFICULTY LOGIC (BE-18)
// =====================================================================
export const getAdaptiveDifficulty = async (userId: string): Promise<"EASY" | "MEDIUM" | "HARD"> => {
  const lastResults = await prisma.result.findMany({
    where: { session: { userId } },
    orderBy: { completedAt: "desc" },
    take: 3,
    select: { scoreValue: true },
  });
  if (lastResults.length < 3) return "MEDIUM";
  const avgScore = lastResults.reduce((acc, res) => acc + res.scoreValue, 0) / 3;
  if (avgScore > 85) return "HARD";
  if (avgScore > 60) return "MEDIUM";
  return "EASY";
};

// =====================================================================
// 👑 ADMIN ANALYTICS & LOG MANAGEMENT
// =====================================================================
export const getAdminStats = async () => {
  try {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const [
      totalUsers,
      totalStudents,
      totalTeachersApproved,
      totalTeachersPending,
      totalTeachersRejected,
      totalGamesPublished,
      totalGamesDraft,
      totalSessions,
      topGamesRaw,
      templateDistRaw,
      topTeachersRaw,
      levelDistRaw,
      recentSessionsRaw,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: Role.STUDENT } }),
      prisma.user.count({ where: { role: Role.TEACHER, approvalStatus: ApprovalStatus.APPROVED } }),
      prisma.user.count({ where: { role: Role.TEACHER, approvalStatus: ApprovalStatus.PENDING } }),
      prisma.user.count({ where: { role: Role.TEACHER, approvalStatus: ApprovalStatus.REJECTED } }),
      prisma.game.count({ where: { isPublished: true } }),
      prisma.game.count({ where: { isPublished: false } }),
      prisma.gameSession.count({ where: { isCompleted: true } }),
      prisma.game.findMany({
        where: { isPublished: true },
        orderBy: { playCount: "desc" },
        take: 5,
        select: {
          id: true,
          title: true,
          templateType: true,
          playCount: true,
          creator: { select: { name: true } },
        },
      }),
      prisma.game.groupBy({
        by: ["templateType"],
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
      }),
      prisma.user.findMany({
        where: { role: Role.TEACHER, approvalStatus: ApprovalStatus.APPROVED },
        select: {
          id: true,
          name: true,
          educationLevels: true,
          _count: { select: { gamesCreated: true } },
        },
        orderBy: { gamesCreated: { _count: "desc" } },
        take: 5,
      }),
      prisma.game.groupBy({
        by: ["educationLevel"],
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
      }),
      prisma.gameSession.findMany({
        where: { isCompleted: true, finishedAt: { gte: sevenDaysAgo, lte: today } },
        select: { finishedAt: true },
      }),
    ]);

    const topGames = topGamesRaw.map((g) => ({
      id: g.id,
      title: g.title,
      templateType: g.templateType,
      playCount: g.playCount || 0,
      creatorName: g.creator?.name || "—",
    }));

    const templateDistribution = templateDistRaw.map((t) => ({
      templateType: t.templateType,
      count: t._count.id,
    }));

    const topTeachers = topTeachersRaw.map((t) => ({
      id: t.id,
      name: t.name,
      educationLevels: t.educationLevels,
      gameCount: t._count.gamesCreated,
    }));

    const levelDistribution = levelDistRaw.map((l) => ({
      level: l.educationLevel,
      count: l._count.id,
    }));

    const DAYS_ID = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
    const dailyMap: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0]!; 
      dailyMap[key] = 0;
    }
    recentSessionsRaw.forEach((s) => {
      if (s.finishedAt) {
        const key = s.finishedAt.toISOString().split("T")[0]!;
        if (key in dailyMap) {
          dailyMap[key] = (dailyMap[key] || 0) + 1;
        }
      }
    });
    const last7DaysSessions = Object.entries(dailyMap).map(([date, count]) => {
      const d = new Date(date);
      return { date, label: DAYS_ID[d.getDay()] || date, count };
    });

    return {
      totalUsers,
      totalStudents,
      teachers: { approved: totalTeachersApproved, pending: totalTeachersPending, rejected: totalTeachersRejected, total: totalTeachersApproved + totalTeachersPending + totalTeachersRejected },
      games: { published: totalGamesPublished, draft: totalGamesDraft, total: totalGamesPublished + totalGamesDraft },
      totalSessions,
      topGames,
      templateDistribution,
      topTeachers,
      levelDistribution,
      last7DaysSessions,
    };
  } catch (e: any) {
    console.error("⚠️ [AdminStats] Error:", e.message);
    return {
      totalUsers: 0, totalStudents: 0,
      teachers: { approved: 0, pending: 0, rejected: 0, total: 0 },
      games: { published: 0, draft: 0, total: 0 },
      totalSessions: 0, topGames: [], templateDistribution: [], topTeachers: [], levelDistribution: [], last7DaysSessions: []
    };
  }
};

export const getAdminLogs = async (params: { page?: number; limit?: number; action?: string; search?: string; timeRange?: string; }) => {
  const page = Number(params.page) || 1;
  const limit = Number(params.limit) || 10;
  const skip = (page - 1) * limit;
  const where: Prisma.SystemLogWhereInput = {};
  if (params.action) where.action = params.action;

  if (params.timeRange && params.timeRange !== "ALL") {
    const now = new Date();
    let startDate: Date | null = null;
    if (params.timeRange === "yesterday") startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    else if (params.timeRange === "week") startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    else if (params.timeRange === "month") startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    else if (params.timeRange === "2months") startDate = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    if (startDate) where.createdAt = { gte: startDate };
  }
  if (params.search) {
    where.OR = [
      { action: { contains: params.search, mode: 'insensitive' } },
      { userName: { contains: params.search, mode: 'insensitive' } },
      { details: { contains: params.search, mode: 'insensitive' } },
    ];
  }
  const [logs, total] = await Promise.all([
    prisma.systemLog.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: limit }),
    prisma.systemLog.count({ where }),
  ]);
  return { logs, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } };
};

// =====================================================================
// 🔄 REMEDIAL / RESET SESSION (TEACHER ACTION)
// =====================================================================
export const deleteResultForRemedial = async (resultId: string, teacherId: string) => {
  const result = await prisma.result.findUnique({
    where: { id: resultId },
    include: { session: { include: { game: true, user: { select: { name: true } } } } }
  });
  if (!result) throw new Error("Data hasil tidak ditemukan");
  if (result.session.game.creatorId !== teacherId) throw new Error("Unauthorized: Kuis ini bukan buatan Anda");

  await prisma.$transaction(async (tx) => {
    await tx.result.delete({ where: { id: resultId } });
    await tx.gameSession.delete({ where: { id: result.sessionId } });
  });

  try {
    const { createSystemLog } = require("../../utils/system-logger");
    const user = await prisma.user.findUnique({ where: { id: teacherId } });
    const studentDisplayName = result.session.user?.name || result.session.playerName || "Anonymous Student";
    await createSystemLog({
      action: "REMEDIAL_ASSIGNED",
      details: `Remedial ditugaskan ke siswa "${studentDisplayName}" untuk game "${result.session.game.title}". Hasil kuis lama dihapus.`,
      userId: teacherId,
      userName: user?.name || "Unknown",
    });
  } catch (logErr) {
    console.error("Gagal mencatat log remedial:", logErr);
  }
  return { success: true };
};