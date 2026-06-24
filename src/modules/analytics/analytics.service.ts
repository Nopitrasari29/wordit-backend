import { prisma } from "../../config/database";
import { Prisma, EducationLevel, Role, ApprovalStatus } from "@prisma/client";
import { redis } from "../../config/redis";

// =====================================================================
// 🏅 BADGE COMPUTATION (FE-19 Gamification)
// =====================================================================
const computeBadges = (
  totalGamesPlayed: number,
  averageScore: number,
  recentHistory: { score: number; timeSpent: number; accuracy: number; difficulty: string }[],
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
    {
      name: "Speedrun Demon",
      icon: "⚡",
      color: "bg-amber-100",
      description: "Selesaikan kuis dalam < 20 detik dengan akurasi >= 90%",
      isUnlocked: recentHistory.some((h) => h.timeSpent > 0 && h.timeSpent < 20 && h.accuracy >= 90),
    },
    {
      name: "Unstoppable",
      icon: "🔥",
      color: "bg-orange-100",
      description: "Raih akurasi 100% berturut-turut pada 3 kuis terakhir",
      isUnlocked: recentHistory.length >= 3 && recentHistory.slice(0, 3).every((h) => h.accuracy === 100),
    },
    {
      name: "Underdog Hero",
      icon: "🧠",
      color: "bg-indigo-200",
      description: "Selesaikan kuis tingkat kesulitan HARD dengan akurasi 100%",
      isUnlocked: recentHistory.some((h) => h.difficulty === "HARD" && h.accuracy === 100),
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
    accuracy: s.result?.accuracy || 0,
    difficulty: s.game?.difficulty || "MEDIUM",
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
    select: { id: true, title: true, creatorId: true, gameJson: true, templateType: true },
  });

  if (!game || game.creatorId !== creatorId) {
    throw new Error("Game tidak ditemukan atau kamu tidak memiliki akses.");
  }

  const results = await prisma.result.findMany({
    where: { session: { gameId } },
    select: {
      id: true,
      sessionId: true,
      scoreValue: true,
      accuracy: true,
      answersDetail: true,
      timeSpent: true,
      completedAt: true,
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

  // Filter results to keep only the latest session per student (case-insensitive name)
  const seenStudents = new Set<string>();
  const filteredResults = [];
  
  // Sort results by completedAt descending (latest first) to ensure we get the latest attempt
  const sortedResults = [...results].sort((a, b) => {
    return new Date(b.completedAt || 0).getTime() - new Date(a.completedAt || 0).getTime();
  });

  for (const r of sortedResults) {
    const studentName = (sessionNameMap[r.sessionId] || "Anonymous").toLowerCase().trim();
    if (!seenStudents.has(studentName)) {
      seenStudents.add(studentName);
      filteredResults.push(r);
    }
  }

  const groupStats: Record<string, { totalScore: number; totalAccuracy: number; count: number }> = {};
  const questionMistakes: Record<number, number> = {};

  filteredResults.forEach((res) => {
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

  const allStudentsData = filteredResults.map((r) => {
    const currentName = sessionNameMap[r.sessionId] || "Anonymous";
    const match = currentName.match(/^([^_]+)_/);
    return {
      id: r.id,
      name: currentName,
      className: match?.[1]?.toUpperCase() || "TANPA_KELAS",
      gameName: game.title,
      score: r.scoreValue,
      accuracy: r.accuracy ?? 0,
      timeSpent: r.timeSpent ?? 0,
      templateType: game.templateType,
      answersDetail: r.answersDetail,
    };
  });

  const atRiskStudents = allStudentsData.filter((student) => student.accuracy < 70);

  return {
    gameTitle: game.title,
    summary: {
      totalParticipants: filteredResults.length,
      averageAccuracy: filteredResults.length > 0 ? Math.round(filteredResults.reduce((acc, r) => acc + r.accuracy, 0) / filteredResults.length) : 0,
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
          game: { select: { title: true, templateType: true } },
        },
      },
    },
  });

  const extractGroup = (playerName: string): string => {
    if (playerName && playerName.includes("_")) {
      const firstPart = playerName.split("_")[0];
      const groupName = firstPart ? firstPart.trim() : "";
      return groupName ? groupName.toUpperCase() : "UMUM";
    }
    const match = playerName.match(/^(.+?)[_\-\s]/);
    const groupName = match && match[1] ? match[1].trim() : "";
    return groupName ? groupName.toUpperCase() : "UMUM";
  };

  // Filter results to keep only the latest session per student (case-insensitive name) per game
  const seenStudents = new Set<string>();
  const filteredResults = [];
  
  // Sort results by completedAt descending (latest first) to ensure we get the latest attempt
  const sortedResults = [...results].sort((a, b) => {
    return new Date(b.completedAt || 0).getTime() - new Date(a.completedAt || 0).getTime();
  });

  for (const r of sortedResults) {
    const studentName = (r.session.playerName || "Anonymous").toLowerCase().trim();
    const studentKey = `${r.session.gameId}_${studentName}`;
    if (!seenStudents.has(studentKey)) {
      seenStudents.add(studentKey);
      filteredResults.push(r);
    }
  }

  const groupMap: Record<string, { totalScore: number; totalAccuracy: number; count: number; studentIdentifiers: Set<string> }> = {};
  const questionMistakes: Record<string, { count: number; text: string }> = {};

  filteredResults.forEach((r) => {
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
        let idx = ans.questionIndex;
        if (idx === undefined || idx === null || isNaN(Number(idx))) {
          const qText = ans.question || ans.word || ans.front;
          const foundIdx = questionsList.findIndex((q: any) => {
            const matchText = q.question || q.word || q.front;
            return matchText && qText && matchText.trim().toLowerCase() === qText.trim().toLowerCase();
          });
          idx = foundIdx !== -1 ? foundIdx : 0;
        } else {
          idx = Number(idx);
        }
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

  const atRiskStudents = filteredResults
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

  const allStudentsData = filteredResults.map((r) => {
    const currentName = r.session.playerName || "Anonymous";
    return {
      id: r.id,
      name: currentName, 
      className: extractGroup(currentName),
      gameName: r.session.game.title,
      score: r.scoreValue,
      accuracy: r.accuracy ?? 0,
      timeSpent: r.timeSpent ?? 0,
      templateType: r.session.game.templateType,
      answersDetail: r.answersDetail,
    };
  });

  const difficultQuestions = Object.entries(questionMistakes)
    .map(([key, q]) => ({
      questionIndex: parseInt(key.split("_").pop()!),
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
    select: { accuracy: true },
  });
  if (lastResults.length < 3) return "MEDIUM";
  const avgAccuracy = lastResults.reduce((acc, res) => acc + res.accuracy, 0) / 3;
  if (avgAccuracy > 85) return "HARD";
  if (avgAccuracy > 60) return "MEDIUM";
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
      totalUsersRaw,
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
      totalSchoolAdminPending,
    ] = await Promise.all([
      prisma.user.count({ where: { role: { in: [Role.STUDENT, Role.TEACHER] } } }),
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
      prisma.user.count({ where: { adminRequestStatus: ApprovalStatus.PENDING } }),
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
      totalUsers: totalStudents + totalTeachersApproved + totalTeachersPending,
      totalStudents,
      teachers: { approved: totalTeachersApproved, pending: totalTeachersPending, rejected: totalTeachersRejected, total: totalTeachersApproved + totalTeachersPending + totalTeachersRejected },
      games: { published: totalGamesPublished, draft: totalGamesDraft, total: totalGamesPublished + totalGamesDraft },
      totalSessions,
      topGames,
      templateDistribution,
      topTeachers,
      levelDistribution,
      last7DaysSessions,
      schoolAdminRequests: { pending: totalSchoolAdminPending },
    };
  } catch (e: any) {
    console.error("⚠️ [AdminStats] Error:", e.message);
    return {
      totalUsers: 0, totalStudents: 0,
      teachers: { approved: 0, pending: 0, rejected: 0, total: 0 },
      games: { published: 0, draft: 0, total: 0 },
      totalSessions: 0, topGames: [], templateDistribution: [], topTeachers: [], levelDistribution: [], last7DaysSessions: [],
      schoolAdminRequests: { pending: 0 }
    };
  }
};

export const getAdminLogs = async (params: { page?: number; limit?: number; action?: string; search?: string; timeRange?: string; dateFrom?: string; dateTo?: string; }) => {
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
  } else if (params.dateFrom || params.dateTo) {
    const filter: { gte?: Date; lte?: Date } = {};
    if (params.dateFrom) filter.gte = new Date(params.dateFrom);
    if (params.dateTo) filter.lte = new Date(params.dateTo);
    where.createdAt = filter;
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

// =====================================================================
// ✏️ OVERRIDE / CORRECT ESSAY SCORE (TEACHER ACTION)
// =====================================================================
export const updateEssayScore = async (
  resultId: string,
  teacherId: string,
  payload: { questionIndex: number; newScore: number; justification?: string }
) => {
  const result = await prisma.result.findUnique({
    where: { id: resultId },
    include: { session: { include: { game: true, user: { select: { name: true } } } } }
  });
  if (!result) throw new Error("Data hasil tidak ditemukan");
  if (result.session.game.creatorId !== teacherId) throw new Error("Unauthorized: Kuis ini bukan buatan Anda");
  if (result.session.game.templateType !== "ESSAY") throw new Error("Hanya kuis bertipe ESSAY yang dapat dikoreksi nilainya secara manual");

  const answersDetail = (result.answersDetail as any[]) || [];
  const aiGradingResult = (result.aiGradingResult as any[]) || [];

  // Update specific questionIndex
  const ansIdx = answersDetail.findIndex((a) => a.questionIndex === payload.questionIndex);
  if (ansIdx === -1) throw new Error("Indeks pertanyaan tidak ditemukan pada detail hasil");

  const oldScore = answersDetail[ansIdx].pointsEarned || 0;
  answersDetail[ansIdx].pointsEarned = payload.newScore;
  answersDetail[ansIdx].isCorrect = payload.newScore >= 60;
  if (payload.justification) {
    answersDetail[ansIdx].justification = `[DIKOREKSI GURU]: ${payload.justification} (AI Sebelumnya: ${answersDetail[ansIdx].justification || 'Tidak ada'})`;
  } else {
    answersDetail[ansIdx].justification = `[DIKOREKSI GURU] (AI Sebelumnya: ${answersDetail[ansIdx].justification || 'Tidak ada'})`;
  }

  // Update aiGradingResult too for consistency
  const aiGradIdx = aiGradingResult.findIndex((a) => a.questionIndex === payload.questionIndex);
  if (aiGradIdx !== -1) {
    aiGradingResult[aiGradIdx].score = payload.newScore;
    if (payload.justification) {
      aiGradingResult[aiGradIdx].justification = `[DIKOREKSI GURU]: ${payload.justification} (AI Sebelumnya: ${aiGradingResult[aiGradIdx].justification || 'Tidak ada'})`;
    } else {
      aiGradingResult[aiGradIdx].justification = `[DIKOREKSI GURU] (AI Sebelumnya: ${aiGradingResult[aiGradIdx].justification || 'Tidak ada'})`;
    }
  }

  // Recalculate total score and average accuracy
  let totalScore = 0;
  answersDetail.forEach((ans) => {
    totalScore += ans.pointsEarned || 0;
  });
  const totalQuestions = answersDetail.length;
  const newAccuracy = totalQuestions > 0 ? Math.round(totalScore / totalQuestions) : 0;

  // Update in DB
  const updatedResult = await prisma.result.update({
    where: { id: resultId },
    data: {
      scoreValue: Math.round(totalScore),
      accuracy: newAccuracy,
      answersDetail: answersDetail as Prisma.InputJsonValue,
      aiGradingResult: aiGradingResult as Prisma.InputJsonValue,
    },
  });

  // Update Redis Leaderboard for real-time consistency
  try {
    const redisKey = `leaderboard:${result.session.gameId}`;
    const identity = result.session.playerName || result.session.userId || "Student";
    await redis.zadd(redisKey, Math.round(totalScore), identity);
  } catch (redisErr) {
    console.error("Gagal mengupdate leaderboard Redis:", redisErr);
  }

  // Create system log
  try {
    const { createSystemLog } = require("../../utils/system-logger");
    const user = await prisma.user.findUnique({ where: { id: teacherId } });
    const studentDisplayName = result.session.user?.name || result.session.playerName || "Anonymous Student";
    await createSystemLog({
      action: "TEACHER_OVERRIDE_ESSAY_SCORE",
      details: `Guru "${user?.name || 'Unknown'}" (Email: ${user?.email}) mengoreksi nilai essay siswa "${studentDisplayName}" untuk Pertanyaan #${payload.questionIndex + 1} dari ${oldScore} menjadi ${payload.newScore}.`,
      userId: teacherId,
      userName: user?.name || "Unknown",
    });
  } catch (logErr) {
    console.error("Gagal mencatat log system:", logErr);
  }

  return updatedResult;
};