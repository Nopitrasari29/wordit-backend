import { prisma } from "../../config/database";

// =====================================================================
// 👨‍🎓 STUDENT ANALYTICS (BE-15)
// =====================================================================
export const getStudentAnalytics = async (userId: string) => {
    const stats = await prisma.result.aggregate({
        where: { session: { userId: userId } },
        _avg: { scoreValue: true, accuracy: true },
        _sum: { timeSpent: true },
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

    return {
        overview: {
            totalGamesPlayed: stats._count.id || 0,
            averageScore: Math.round(stats._avg.scoreValue || 0),
            averageAccuracy: Math.round(stats._avg.accuracy || 0),
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
    };
};

// =====================================================================
// 👨‍🏫 TEACHER ANALYTICS (BE-16)
// =====================================================================
export const getGameAnalyticsForTeacher = async (gameId: string, creatorId: string) => {
    // 1. Verifikasi Kepemilikan Game
    const game = await prisma.game.findUnique({
        where: { id: gameId },
        select: { id: true, title: true, creatorId: true }
    });

    if (!game || game.creatorId !== creatorId) {
        throw new Error("Game tidak ditemukan atau kamu tidak memiliki akses.");
    }

    // 2. Ambil Semua Hasil (Result) untuk Game ini
    const results = await prisma.result.findMany({
        where: { session: { gameId } },
        include: { session: { include: { user: { select: { name: true } } } } }
    });

    const groupStats: Record<string, { totalScore: number; count: number }> = {};
    const questionMistakes: Record<number, number> = {};

    results.forEach((res) => {
        // A. Pengelompokan Otomatis via Regex (Contoh: "Kelas_3A_Nopi")
        const playerName = res.session.user.name;
        const match = playerName.match(/^Kelas_([^_]+)/i);
        const className = match ? match[0].toUpperCase() : "TANPA_KELAS";

        if (!groupStats[className]) groupStats[className] = { totalScore: 0, count: 0 };
        groupStats[className].totalScore += res.scoreValue;
        groupStats[className].count += 1;

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
        studentCount: data.count
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
            averageAccuracy: results.length > 0
                ? Math.round(results.reduce((acc, r) => acc + r.accuracy, 0) / results.length)
                : 0,
        },
        classDistribution,
        difficultQuestions: difficultQuestions.slice(0, 5), // Ambil Top 5 soal tersulit
    };
};

export const getTeacherClassesAnalytics = async (teacherId: string) => {
    // Ambil semua game milik guru ini
    const games = await prisma.game.findMany({
        where: { creatorId: teacherId },
        select: { id: true, title: true }
    });

    const gameIds = games.map(g => g.id);

    // Ambil semua result terkait game-game tersebut
    const results = await prisma.result.findMany({
        where: { session: { gameId: { in: gameIds } } },
        include: { session: { include: { user: { select: { id: true, name: true } }, game: { select: { title: true } } } } }
    });

    const classesData = games.map(game => {
        const gameResults = results.filter(r => r.session.gameId === game.id);
        const uniqueStudents = new Set(gameResults.map(r => r.session.userId)).size;
        const avgScore = gameResults.length > 0 
            ? Math.round(gameResults.reduce((acc, r) => acc + r.scoreValue, 0) / gameResults.length) 
            : 0;

        return {
            id: game.id,
            name: game.title,
            students: uniqueStudents,
            averageScore: avgScore,
            icon: "🏫"
        };
    });

    const atRiskStudents = results
        .filter(r => r.scoreValue < 60)
        .map(r => ({
            id: r.id,
            name: r.session.user.name,
            className: r.session.game.title,
            score: r.scoreValue,
            issue: r.accuracy < 50 ? "Akurasi rendah" : "Skor di bawah batas minimal"
        }))
        .slice(0, 10); // Ambil maksimal 10 siswa berisiko tertinggi

    return {
        classes: classesData,
        atRiskStudents
    };
};

// =====================================================================
// 🧠 ADAPTIVE DIFFICULTY LOGIC (BE-18)
// =====================================================================
export const getAdaptiveDifficulty = async (userId: string): Promise<"EASY" | "MEDIUM" | "HARD"> => {
    // 1. Ambil 3 hasil permainan terakhir
    const lastResults = await prisma.result.findMany({
        where: { session: { userId } },
        orderBy: { completedAt: "desc" },
        take: 3,
        select: { scoreValue: true }
    });

    // Jika belum pernah main atau data kurang dari 3, default ke EASY
    if (lastResults.length < 3) return "EASY";

    // 2. Hitung rata-rata skor dari 3 game terakhir
    const avgScore = lastResults.reduce((acc, res) => acc + res.scoreValue, 0) / 3;

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
        totalSessions = await prisma.gameSession.count({ where: { isCompleted: true } });
        
        // @ts-ignore
        if ((prisma as any).systemLog) {
            // @ts-ignore
            systemLogs = await (prisma as any).systemLog.findMany({
                orderBy: { createdAt: "desc" },
                take: 50
            });
        }
    } catch (e: any) {
        console.error("⚠️ [AdminStats] Database schema mismatch or missing tables:", e.message);
    }

    return {
        totalUsers,
        totalGames,
        totalSessions,
        systemLogs
    };
};