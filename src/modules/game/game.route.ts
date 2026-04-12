import { Router } from "express"
import * as gameController from "./game.controller"
import { authMiddleware } from "../../middleware/auth.middleware"

const router = Router()

// Public routes
router.get("/", gameController.getGames)
router.get("/templates/:level", gameController.getTemplatesByLevel)
router.get("/:id", gameController.getGameById)

// Protected routes (butuh login)
router.post("/", authMiddleware, gameController.createGame)
router.patch("/:id", authMiddleware, gameController.updateGame)
router.delete("/:id", authMiddleware, gameController.deleteGame)
router.patch("/:id/publish", authMiddleware, gameController.togglePublish)
router.get("/user/my-games", authMiddleware, gameController.getMyGames)

export default router