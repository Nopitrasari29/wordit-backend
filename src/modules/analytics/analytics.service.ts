import { prisma } from "../../config/database";
import { Prisma, EducationLevel, Role, ApprovalStatus } from "@prisma/client";

// =====================================================================
// 🏅 BADGE COMPUTATION (FE-19 Gamification)
// Dipanggil dari getStudentAnalytics untuk menghasilkan badge real dari data
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
      isUnlocked: recentHistory.some(
        (h) => h.timeSpent > 0 && h.timeSpent < 60,
      ),
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
// 👨‍🎓 STUDENT ANALYTICS (BE-15) - UPDATED FOR SYNC
// =====================================================================
export const getStudentAnalytics = async (userId: string) => {
  const stats = await prisma.result.aggregate({
    where: { session: { userId: userId } },
    _avg: { scoreValue: true, accuracy: true },
    _sum: {
      timeSpent: true,
      scoreValue: true, // 🛠️ Tambahkan SUM untuk kalkulasi XP di Frontend
    },
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

  // 🏅 FE-19: Hitung badge real dari data aktual siswa
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

  // Calculate most frequent missed question
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
      totalXp: stats._sum.scoreValue || 0, // 🛠️ Kirim total akumulasi skor ke FE
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
    // 🏅 FE-19: Badge gamifikasi dikalkulasi real dari data DB
    badges,
  };
};

// ... (logika teacher dan adaptive difficulty tetap sama sesuai file asli Anda)

// =====================================================================
// 👨‍🏫 TEACHER ANALYTICS (BE-16)
// =====================================================================
export const getGameAnalyticsForTeacher = async (
  gameId: string,
  creatorId: string,
) => {
  // 1. Verifikasi Kepemilikan Game
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { id: true, title: true, creatorId: true },
  });

  if (!game || game.creatorId !== creatorId) {
    throw new Error("Game tidak ditemukan atau kamu tidak memiliki akses.");
  }

  // 2. Ambil Semua Hasil (Result) untuk Game ini
  const results = await prisma.result.findMany({
    where: { session: { gameId } },
    include: { session: { include: { user: { select: { name: true } } } } },
  });

  const groupStats: Record<string, { totalScore: number; count: number }> = {};
  const questionMistakes: Record<number, number> = {};

  results.forEach((res) => {
    // A. Pengelompokan Otomatis via Regex (Contoh: "Kelas_3A_Nopi")
    const playerName = res.session.user.name;
    const match = playerName.match(/^([^_]+)_/);
    const className = match?.[1]?.toUpperCase() || "TANPA_KELAS";

    if (!groupStats[className])
      groupStats[className] = { totalScore: 0, count: 0 };
    const entry = groupStats[className]!;
    entry.totalScore += res.scoreValue;
    entry.count += 1;

    // B. Deteksi Soal Tersulit (Parsing answersDetail)
    const answers = (res.answersDetail as any[]) || [];
    answers.forEach((ans: any) => {
      if (ans.isCorrect === false) {
        const idx = ans.questionIndex;
        questionMistakes[idx] = (questionMistakes[idx] || 0) + 1;
      }
    });
  });

  // 3. Formatting Data untuk Chart
  const classDistribution = Object.entries(groupStats).map(([name, data]) => ({
    groupName: name,
    averageScore: Math.round(data.totalScore / data.count),
    studentCount: data.count,
  }));

  const difficultQuestions = Object.entries(questionMistakes)
    .map(([idx, count]) => ({
      questionIndex: parseInt(idx),
      mistakeCount: count,
    }))
    .sort((a, b) => b.mistakeCount - a.mistakeCount);

  return {
    gameTitle: game.title,
    summary: {
      totalParticipants: results.length,
      averageAccuracy:
        results.length > 0
          ? Math.round(
            results.reduce((acc, r) => acc + r.accuracy, 0) / results.length,
          )
          : 0,
    },
    classDistribution,
    difficultQuestions: difficultQuestions.slice(0, 5), // Ambil Top 5 soal tersulit
  };
};

export const getTeacherClassesAnalytics = async (teacherId: string, educationLevel?: string, classGrade?: string) => {
  const whereFilter: Prisma.GameWhereInput = { creatorId: teacherId };
  if (educationLevel && educationLevel !== "ALL") {
    whereFilter.educationLevel = educationLevel as EducationLevel;
  }
  if (classGrade && classGrade !== "ALL") {
    whereFilter.classGrade = {
      contains: classGrade,
      mode: "insensitive",
    };
  }

  const games = await prisma.game.findMany({
    where: whereFilter,
    select: { id: true, title: true },
  });

  const gameIds = games.map((g) => g.id);

  // ✅ FIX FE-20: Filter agar akun pembuat game (guru ybs) tidak masuk hitungan
  const results = await prisma.result.findMany({
    where: {
      session: {
        gameId: { in: gameIds },
        user: { id: { not: teacherId } }
      },
    },
    include: {
      session: {
        include: {
          user: { select: { id: true, name: true, role: true } },
          game: { select: { title: true } },
        },
      },
    },
  });

  // ✅ FIX FE-20: Auto-grouping berdasarkan format "kelas_nama", dipisah dengan "_" atau " " atau "-"
  // Jika tidak bisa di-group, masuk grup "UMUM"
  const extractGroup = (playerName: string): string => {
    // Regex for grabbing anything before the first underscore, space, or hyphen
    const match = playerName.match(/^(.+?)[_\-\s]/);
    const groupName = match?.[1]?.trim();
    return groupName ? groupName.toUpperCase() : "UMUM";
  };

  // Kelompokkan hasil berdasarkan prefix nama pemain
  const groupMap: Record<
    string,
    {
      totalScore: number;
      totalAccuracy: number;
      count: number;
      studentIds: Set<string>;
    }
  > = {};

  results.forEach((r) => {
    const group = extractGroup(r.session.user.name);
    if (!groupMap[group]) {
      groupMap[group] = {
        totalScore: 0,
        totalAccuracy: 0,
        count: 0,
        studentIds: new Set(),
      };
    }
    const entry = groupMap[group]!;
    entry.totalScore += r.scoreValue;
    entry.totalAccuracy += r.accuracy ?? 0;
    entry.count += 1;
    entry.studentIds.add(r.session.user.id);
  });

  const classesData = Object.entries(groupMap).map(([groupName, data]) => ({
    id: groupName, // Gunakan nama grup sebagai ID
    name: groupName,
    students: data.studentIds.size,
    averageScore: data.count > 0 ? Math.round(data.totalScore / data.count) : 0,
    averageAccuracy:
      data.count > 0 ? Math.round(data.totalAccuracy / data.count) : 0,
    totalPlays: data.count,
    icon: "🏫",
  }));

  // ✅ FIX: atRiskStudents juga hanya dari STUDENT, dengan nama grup
  const atRiskStudents = results
    .filter((r) => r.scoreValue < 60)
    .map((r) => ({
      id: r.id,
      name: r.session.user.name,
      className: extractGroup(r.session.user.name),
      gameName: r.session.game.title,
      score: r.scoreValue,
      issue:
        (r.accuracy ?? 0) < 50
          ? "Akurasi rendah"
          : "Skor di bawah batas minimal",
    }))
    .slice(0, 10);

  return {
    classes: classesData,
    atRiskStudents,
  };
};

// =====================================================================
// 🧠 ADAPTIVE DIFFICULTY LOGIC (BE-18)
// =====================================================================
export const getAdaptiveDifficulty = async (
  userId: string,
): Promise<"EASY" | "MEDIUM" | "HARD"> => {
  // 1. Ambil 3 hasil permainan terakhir
  const lastResults = await prisma.result.findMany({
    where: { session: { userId } },
    orderBy: { completedAt: "desc" },
    take: 3,
    select: { scoreValue: true },
  });

  // Jika belum pernah main atau data kurang dari 3, default ke MEDIUM
  if (lastResults.length < 3) return "MEDIUM";

  // 2. Hitung rata-rata skor dari 3 game terakhir
  const avgScore =
    lastResults.reduce((acc, res) => acc + res.scoreValue, 0) / 3;

  // 3. Logika Penyesuaian
  if (avgScore > 85) return "HARD";
  if (avgScore > 60) return "MEDIUM";

  return "EASY";
};

// =====================================================================
// 👑 ADMIN ANALYTICS
// =====================================================================
export const getAdminStats = async () => {
  try {
    // Buat rentang 7 hari ke belakang untuk tren sesi harian
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
      // Top 5 game paling sering dimainkan
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
      // Distribusi game per template type
      prisma.game.groupBy({
        by: ["templateType"],
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
      }),
      // Top 5 guru paling aktif (berdasarkan jumlah game yang dibuat)
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
      // Distribusi game per education level
      prisma.game.groupBy({
        by: ["educationLevel"],
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
      }),
      // Sesi yang selesai dalam 7 hari terakhir (untuk tren harian)
      prisma.gameSession.findMany({
        where: {
          isCompleted: true,
          finishedAt: { gte: sevenDaysAgo, lte: today },
        },
        select: { finishedAt: true },
      }),
    ]);

    // Format top games
    const topGames = topGamesRaw.map((g) => ({
      id: g.id,
      title: g.title,
      templateType: g.templateType,
      playCount: g.playCount || 0,
      creatorName: g.creator?.name || "—",
    }));

    // Format template distribution
    const templateDistribution = templateDistRaw.map((t) => ({
      templateType: t.templateType,
      count: t._count.id,
    }));

    // Format top teachers
    const topTeachers = topTeachersRaw.map((t) => ({
      id: t.id,
      name: t.name,
      educationLevels: t.educationLevels,
      gameCount: t._count.gamesCreated,
    }));

    // Format education level distribution
    const levelDistribution = levelDistRaw.map((l) => ({
      level: l.educationLevel,
      count: l._count.id,
    }));

    // Hitung sesi per hari selama 7 hari terakhir
    const DAYS_ID = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
    const dailyMap: Record<string, number> = {};
    // Inisialisasi 7 hari dengan angka 0
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0]!; // "YYYY-MM-DD"
      dailyMap[key] = 0;
    }
    // Isi dengan data nyata
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
      return {
        date,
        label: DAYS_ID[d.getDay()] || date,
        count,
      };
    });

    return {
      totalUsers,
      totalStudents,
      teachers: {
        approved: totalTeachersApproved,
        pending: totalTeachersPending,
        rejected: totalTeachersRejected,
        total: totalTeachersApproved + totalTeachersPending + totalTeachersRejected,
      },
      games: {
        published: totalGamesPublished,
        draft: totalGamesDraft,
        total: totalGamesPublished + totalGamesDraft,
      },
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
      totalUsers: 0,
      totalStudents: 0,
      teachers: { approved: 0, pending: 0, rejected: 0, total: 0 },
      games: { published: 0, draft: 0, total: 0 },
      totalSessions: 0,
      topGames: [],
      templateDistribution: [],
      topTeachers: [],
      levelDistribution: [],
      last7DaysSessions: [],
    };
  }
};

export const getAdminLogs = async (params: {
  page?: number;
  limit?: number;
  action?: string;
  search?: string;
  timeRange?: string;
}) => {
  const page = Number(params.page) || 1;
  const limit = Number(params.limit) || 10;
  const skip = (page - 1) * limit;

  const where: Prisma.SystemLogWhereInput = {};
  if (params.action) {
    where.action = params.action;
  }

  if (params.timeRange && params.timeRange !== "ALL") {
    const now = new Date();
    let startDate: Date | null = null;
    if (params.timeRange === "yesterday") {
      startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    } else if (params.timeRange === "week") {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (params.timeRange === "month") {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else if (params.timeRange === "2months") {
      startDate = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    }

    if (startDate) {
      where.createdAt = {
        gte: startDate,
      };
    }
  }
  if (params.search) {
    where.OR = [
      { action: { contains: params.search, mode: 'insensitive' } },
      { userName: { contains: params.search, mode: 'insensitive' } },
      { details: { contains: params.search, mode: 'insensitive' } },
    ];
  }

  const [logs, total] = await Promise.all([
    prisma.systemLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.systemLog.count({ where }),
  ]);

  return {
    logs,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

// =====================================================================
// 🔄 REMEDIAL / RESET SESSION (TEACHER ACTION)
// =====================================================================
export const deleteResultForRemedial = async (resultId: string, teacherId: string) => {
  // 1. Dapatkan result beserta session dan game-nya untuk memastikan game ini milik si guru (teacherId)
  const result = await prisma.result.findUnique({
    where: { id: resultId },
    include: {
      session: {
        include: {
          game: true,
          user: { select: { name: true } }
        }
      }
    }
  });

  if (!result) {
    throw new Error("Data hasil tidak ditemukan");
  }

  if (result.session.game.creatorId !== teacherId) {
    throw new Error("Unauthorized: Kuis ini bukan buatan Anda");
  }

  // 2. Hapus dalam transaction yang aman
  await prisma.$transaction(async (tx) => {
    // Hapus result
    await tx.result.delete({
      where: { id: resultId }
    });
    // Hapus session
    await tx.gameSession.delete({
      where: { id: result.sessionId }
    });
  });

  // Log system log
  try {
    const { createSystemLog } = require("../../utils/system-logger");
    const user = await prisma.user.findUnique({ where: { id: teacherId } });
    await createSystemLog({
      action: "REMEDIAL_ASSIGNED",
      details: `Remedial ditugaskan ke siswa "${result.session.user.name}" untuk game "${result.session.game.title}". Hasil kuis lama dihapus.`,
      userId: teacherId,
      userName: user?.name || "Unknown",
    });
  } catch (logErr) {
    console.error("Gagal mencatat log remedial:", logErr);
  }

  return { success: true };
};

