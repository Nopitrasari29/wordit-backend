import { Router } from "express";
import * as userController from "./user.controller";
import { authMiddleware } from "../../middleware/auth.middleware";
import { uploadMiddleware } from "../../middleware/upload.middleware";

const router = Router();

// ============================================================
// PROFILE (semua role yang sudah login)
// ============================================================
router.get("/profile", authMiddleware(), userController.getProfile);
router.patch(
  "/profile",
  authMiddleware(),
  uploadMiddleware("profile_picture"),
  userController.updateProfile
);
router.get("/my-games", authMiddleware(), userController.getMyGames);
router.get("/leaderboard", authMiddleware(), userController.getStudentLeaderboard);

// ============================================================
// ADMIN ONLY
// ============================================================

// GET semua user (dengan filter role, approvalStatus, search, pagination)
router.get("/", authMiddleware(["ADMIN"]), userController.getAllUsers);

// Bulk import users
router.post("/bulk-import", authMiddleware(["ADMIN"]), userController.bulkImportUsers);

// Hapus massal user (bulk delete)
// DELETE /api/users/bulk-delete  body: { userIds: ["id1", "id2", ...] }
router.delete("/bulk-delete", authMiddleware(["ADMIN"]), userController.bulkDeleteUsers);

// Approve / Reject Teacher
// PATCH /api/users/:id/approve  body: { action: "APPROVE" | "REJECT" }
router.patch("/:id/approve", authMiddleware(["ADMIN"]), userController.approveTeacher);

// Ganti role user
// PATCH /api/users/:id/role  body: { role: "STUDENT" | "TEACHER" }
router.patch("/:id/role", authMiddleware(["ADMIN"]), userController.changeUserRole);

// Hapus user
// DELETE /api/users/:id
router.delete("/:id", authMiddleware(["ADMIN"]), userController.deleteUser);

export default router;