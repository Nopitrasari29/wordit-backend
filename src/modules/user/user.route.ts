import { Router } from "express";
import * as userController from "./user.controller";
import { authMiddleware } from "../../middleware/auth.middleware";
import { uploadMiddleware } from "../../middleware/upload.middleware"; 

const router = Router();

router.get("/", authMiddleware(["ADMIN"]), userController.getAllUsers);
router.get("/profile", authMiddleware(), userController.getProfile);
router.patch(
  "/profile", 
  authMiddleware(), 
  uploadMiddleware("profile_picture"), 
  userController.updateProfile
);
router.get("/my-games", authMiddleware(), userController.getMyGames);

export default router;