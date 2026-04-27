import { Router } from "express";
import * as gameController from "./game.controller";
import { authMiddleware } from "../../middleware/auth.middleware";

const router = Router();

// ═══════════════ PUBLIC ROUTES ═══════════════
router.get("/templates/:level", gameController.getTemplatesByLevel);
router.get("/", gameController.getGames);

// Mencari game berdasarkan Share Code - HARUS di atas /:id
router.get("/code/:shareCode", gameController.getGameByCode);

// Detail game by ID
router.get("/:id", authMiddleware(), gameController.getGameById);

// ═══════════════ PROTECTED ROUTES (TEACHER ONLY) ═══════════════
router.get("/user/my-games", authMiddleware(["TEACHER"]), gameController.getMyGames);
router.post("/", authMiddleware(["TEACHER"]), gameController.createGame);
router.patch("/:id", authMiddleware(["TEACHER"]), gameController.updateGame);
router.delete("/:id", authMiddleware(["TEACHER"]), gameController.deleteGame);
router.patch("/:id/publish", authMiddleware(["TEACHER"]), gameController.togglePublish);

// ═══════════════ GAME PLAYER ENGINE (STUDENT & TEACHER) ═══════════════

// 3. Play Game: Memulai sesi permainan (membuat GameSession)
router.post("/:id/play", authMiddleware(["STUDENT", "TEACHER"]), gameController.playGame);

// 4. Submit Answer: Update ranking real-time via Redis+Socket SAJA (tidak simpan ke DB)
router.post("/:id/submit", authMiddleware(["STUDENT", "TEACHER"]), gameController.submitAnswer);

// 5. Finish Game: Simpan SKOR FINAL ke PostgreSQL (dipanggil 1x di akhir game)
router.post("/:id/finish", authMiddleware(["STUDENT", "TEACHER"]), gameController.finishGame);

export default router;
