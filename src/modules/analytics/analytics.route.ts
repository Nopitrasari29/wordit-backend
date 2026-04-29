import { Router } from "express";
import { getMyAnalytics, getGameAnalytics, getTeacherClasses, getAdminStats } from "./analytics.controller";
import { authMiddleware } from "../../middleware/auth.middleware";

const router = Router();

// =====================================================================
// 📊 ANALYTICS ROUTES
// =====================================================================

// 1. Endpoint Siswa: Melihat performa diri sendiri
router.get("/student/me", authMiddleware(), getMyAnalytics);

// 2. Endpoint Guru: Melihat daftar kelas (semua game yang dibuat)
router.get("/teacher/classes", authMiddleware(), getTeacherClasses);

// 3. Endpoint Guru: Melihat statistik kelas per Game ID
router.get("/game/:id", authMiddleware(), getGameAnalytics);

// 4. Endpoint Admin: Melihat statistik aplikasi dan log
router.get("/admin/stats", authMiddleware(), getAdminStats);

export default router;