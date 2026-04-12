import { Router } from "express";
import * as authController from "./auth.controller";
import { authMiddleware } from "../../middleware/auth.middleware";

const router = Router();

// Public Routes
router.post("/register", authController.register);
router.post("/login", authController.login);

// Protected Routes: Butuh login (semua role boleh akses)
router.post("/logout", authMiddleware(), authController.logout);

export default router;