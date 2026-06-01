import { Router } from "express";
import * as authController from "./auth.controller";
import { authMiddleware } from "../../middleware/auth.middleware";

const router = Router();

// Public Routes
router.post("/register", authController.register);
router.post("/login", authController.login);
router.post("/lti-login", authController.ltiLogin);
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password", authController.resetPassword);
router.get("/verify-email", authController.verifyEmail);

// Protected Routes: Butuh login (semua role boleh akses)
router.post("/logout", authMiddleware(), authController.logout);

export default router;