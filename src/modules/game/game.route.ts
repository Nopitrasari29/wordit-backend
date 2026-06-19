import { Router } from "express";
import * as gameController from "./game.controller";
import { authMiddleware, optionalAuth } from "../../middleware/auth.middleware";

const router = Router();

// ═══════════════ PUBLIC ROUTES ═══════════════
router.get("/templates/:level", gameController.getTemplatesByLevel);
router.get("/", gameController.getGames);

// Mencari game berdasarkan Share Code - HARUS di atas /:id
router.get("/code/:shareCode", gameController.getGameByCode);

// Detail game by ID (Sekarang publik dengan optionalAuth)
router.get("/:id", optionalAuth, gameController.getGameById);

// ═══════════════ PROTECTED ROUTES (TEACHER & SCHOOL_ADMIN) ═══════════════
router.get("/user/my-games", authMiddleware(["TEACHER", "SCHOOL_ADMIN"]), gameController.getMyGames);
router.post("/", authMiddleware(["TEACHER", "SCHOOL_ADMIN"]), gameController.createGame);
router.patch("/:id", authMiddleware(["TEACHER", "SCHOOL_ADMIN"]), gameController.updateGame);
router.delete("/:id", authMiddleware(["TEACHER", "SCHOOL_ADMIN"]), gameController.deleteGame);
router.patch("/:id/publish", authMiddleware(["TEACHER", "SCHOOL_ADMIN"]), gameController.togglePublish);

// ═══════════════ GAME PLAYER ENGINE (STUDENT, TEACHER, SCHOOL_ADMIN & SUPER_ADMIN) ═══════════════

// 3. Play Game: Memulai sesi permainan (membuat GameSession)
router.post("/:id/play", authMiddleware(["STUDENT", "TEACHER", "SCHOOL_ADMIN", "SUPER_ADMIN"]), gameController.playGame);

// 4. Submit Answer: Update ranking real-time via Redis+Socket SAJA (tidak simpan ke DB)
router.post("/:id/submit", authMiddleware(["STUDENT", "TEACHER", "SCHOOL_ADMIN", "SUPER_ADMIN"]), gameController.submitAnswer);

// 5. Finish Game: Simpan SKOR FINAL ke PostgreSQL (dipanggil 1x di akhir game)
router.post("/:id/finish", authMiddleware(["STUDENT", "TEACHER", "SCHOOL_ADMIN", "SUPER_ADMIN"]), gameController.finishGame);

export default router;
