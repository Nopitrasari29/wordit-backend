import { prisma } from "../../config/database";

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

  return {
    overview: {
      totalGamesPlayed: stats._count.id || 0,
      averageScore: Math.round(stats._avg.scoreValue || 0),
      averageAccuracy: Math.round(stats._avg.accuracy || 0),
      totalXp: stats._sum.scoreValue || 0, // 🛠️ Kirim total akumulasi skor ke FE
      totalTimeSpentSeconds: stats._sum.timeSpent || 0,
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

export const getTeacherClassesAnalytics = async (teacherId: string) => {
  const games = await prisma.game.findMany({
    where: { creatorId: teacherId },
    select: { id: true, title: true },
  });

  const gameIds = games.map((g) => g.id);

  // ✅ FIX FE-20: Tambah filter role STUDENT agar akun guru tidak masuk hitungan
  const results = await prisma.result.findMany({
    where: {
      session: {
        gameId: { in: gameIds },
        user: { role: "STUDENT" }, // Filter hanya role STUDENT
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

  // ✅ FIX FE-20: Auto-grouping berdasarkan regex nama pemain (3A_Budi → grup 3A)
  // Jika nama tidak mengandung underscore, masuk grup "Umum"
  const extractGroup = (playerName: string): string => {
    const match = playerName.match(/^([^_]+)_/);
    const groupName = match?.[1]?.trim();
    return groupName ? groupName.toUpperCase() : "Umum";
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

  // Jika belum pernah main atau data kurang dari 3, default ke EASY
  if (lastResults.length < 3) return "EASY";

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
  let totalUsers = 0;
  let totalGames = 0;
  let totalSessions = 0;
  let systemLogs = [];

  try {
    totalUsers = await prisma.user.count();
    totalGames = await prisma.game.count({ where: { isPublished: true } });
    totalSessions = await prisma.gameSession.count({
      where: { isCompleted: true },
    });

    // @ts-ignore
    if ((prisma as any).systemLog) {
      // @ts-ignore
      systemLogs = await (prisma as any).systemLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
      });
    }
  } catch (e: any) {
    console.error(
      "⚠️ [AdminStats] Database schema mismatch or missing tables:",
      e.message,
    );
  }

  return {
    totalUsers,
    totalGames,
    totalSessions,
    systemLogs,
  };
};
