import { Router } from "express"
import * as userController from "./user.controller"
import { authMiddleware } from "../../middleware/auth.middleware"
import { uploadPhoto } from "../../middleware/upload.middleware"

const router = Router()

router.get("/profile", authMiddleware, userController.getProfile)
router.patch("/profile", authMiddleware, uploadPhoto, userController.updateProfile)
router.get("/my-games", authMiddleware, userController.getMyGames)

export default router