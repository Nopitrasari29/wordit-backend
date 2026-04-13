import { Router } from "express";
import * as gameController from "./game.controller";
import { authMiddleware } from "../../middleware/auth.middleware";

const router = Router();

// ─── PUBLIC ROUTES ──────────────────────────────────────────────────
// Urutan: Taruh rute spesifik di atas rute generic (:id)
router.get("/templates/:level", gameController.getTemplatesByLevel);
router.get("/", gameController.getGames);

// ─── PROTECTED ROUTES (LOGGED IN) ───────────────────────────────────

// 1. My Games: Taruh di atas /:id biar gak dianggap sebagai ID
router.get("/user/my-games", authMiddleware(['TEACHER', 'ADMIN']), gameController.getMyGames);

// 2. Get Detail: Bisa diakses semua role yang login (termasuk STUDENT buat main)
router.get("/:id", authMiddleware(), gameController.getGameById);

// 3. Game Management: Hanya TEACHER & ADMIN yang boleh eksekusi
router.post("/", authMiddleware(['TEACHER', 'ADMIN']), gameController.createGame);
router.patch("/:id", authMiddleware(['TEACHER', 'ADMIN']), gameController.updateGame);
router.delete("/:id", authMiddleware(['TEACHER', 'ADMIN']), gameController.deleteGame);
router.patch("/:id/publish", authMiddleware(['TEACHER', 'ADMIN']), gameController.togglePublish);

export default router;