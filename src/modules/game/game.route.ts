import { Router } from "express";
import * as gameController from "./game.controller";
import { authMiddleware } from "../../middleware/auth.middleware";
// import { uploadMiddleware } from "../../middleware/upload.middleware"; // Gunakan jika ada upload thumbnail

const router = Router();

// ─── PUBLIC ROUTES ──────────────────────────────────────────────────
// Siapa pun bisa melihat daftar kuis dan template yang tersedia
router.get("/templates/:level", gameController.getTemplatesByLevel);
router.get("/", gameController.getGames);

/**
 * 🚀 BARU & KRUSIAL: Mencari game berdasarkan Share Code (Student Join)
 * Harus ditaruh DI ATAS rute "/:id" agar tidak dianggap sebagai ID UUID
 */
router.get("/code/:shareCode", gameController.getGameByCode);

// Mendapatkan detail game berdasarkan ID
router.get("/:id", authMiddleware(), gameController.getGameById);

// ─── PROTECTED ROUTES (TEACHER ONLY) ────────────────────────────────

// ✅ 1. My Games: Khusus untuk TEACHER melihat daftar kuis buatannya sendiri
router.get("/user/my-games", authMiddleware(['TEACHER']), gameController.getMyGames);

// ✅ 2. Game Management: Operasi CRUD kuis hanya boleh dilakukan oleh TEACHER
router.post("/", authMiddleware(['TEACHER']), gameController.createGame);
router.patch("/:id", authMiddleware(['TEACHER']), gameController.updateGame);
router.delete("/:id", authMiddleware(['TEACHER']), gameController.deleteGame);
router.patch("/:id/publish", authMiddleware(['TEACHER']), gameController.togglePublish);

// ─── GAME PLAYER ENGINE (STUDENT & TEACHER) ─────────────────────────

// ✅ 3. Play Game (BE-11): Memulai sesi permainan (membuat GameSession)
// Endpoint: POST /api/v1/games/:id/play
router.post("/:id/play", authMiddleware(['STUDENT', 'TEACHER']), gameController.playGame);

// ✅ 4. Submit Answer (BE-12): Mengirim hasil akhir permainan dan menghitung skor
// Endpoint: POST /api/v1/games/:id/submit
router.post("/:id/submit", authMiddleware(['STUDENT', 'TEACHER']), gameController.submitAnswer);

export default router;