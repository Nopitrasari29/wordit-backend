import type { Request, Response } from "express";
import { getStudentAnalytics, getGameAnalyticsForTeacher, getTeacherClassesAnalytics, getAdminStats as getAdminStatsService } from "./analytics.service";

// Dashboard Siswa (Me)
export const getMyAnalytics = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id || (req as any).user?.userId;

        if (!userId) {
            return res.status(401).json({ status: "error", message: "Unauthorized." });
        }

        const data = await getStudentAnalytics(userId);
        return res.status(200).json({ status: "success", data });
    } catch (error: any) {
        return res.status(500).json({ status: "error", message: error.message });
    }
};

// Dashboard Guru (Detail Per Game)
export const getGameAnalytics = async (req: Request, res: Response) => {
    try {
        const { id: gameId } = req.params;
        const creatorId = (req as any).user?.id || (req as any).user?.userId;

        if (!gameId || !creatorId) {
            return res.status(400).json({ status: "error", message: "ID Game atau ID Creator tidak valid." });
        }

        const data = await getGameAnalyticsForTeacher(gameId as string, creatorId as string);

        return res.status(200).json({ status: "success", data });
    } catch (error: any) {
        // Jika error karena kepemilikan, kirim 403 Forbidden
        const statusCode = error.message.includes("akses") ? 403 : 500;
        return res.status(statusCode).json({ status: "error", message: error.message });
    }
};

// Dashboard Guru (Semua Kelas/Game)
export const getTeacherClasses = async (req: Request, res: Response) => {
    try {
        const creatorId = (req as any).user?.id || (req as any).user?.userId;

        if (!creatorId) {
            return res.status(401).json({ status: "error", message: "Unauthorized." });
        }

        const data = await getTeacherClassesAnalytics(creatorId as string);

        return res.status(200).json({ status: "success", data });
    } catch (error: any) {
        return res.status(500).json({ status: "error", message: error.message });
    }
};

// Dashboard Admin (Stats & Logs)
export const getAdminStats = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        if (!user || user.role !== "ADMIN") {
            return res.status(403).json({ status: "error", message: "Forbidden. Admin only." });
        }

        const data = await getAdminStatsService();

        return res.status(200).json({ status: "success", data });
    } catch (error: any) {
        console.error("🔥 GET ADMIN STATS ERROR:", error);
        return res.status(500).json({ status: "error", message: error.message, stack: error.stack });
    }
};