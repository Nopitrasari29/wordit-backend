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
// TEACHER: Ajukan diri sebagai Admin Sekolah
// ============================================================
// PATCH /api/users/request-school-admin
router.patch("/request-school-admin", authMiddleware(["TEACHER", "SCHOOL_ADMIN"]), userController.requestSchoolAdmin);

// ============================================================
// SUPER_ADMIN ONLY: Setujui/Tolak pengajuan Admin Sekolah
// ============================================================
router.patch("/:id/approve-school-admin", authMiddleware(["SUPER_ADMIN"]), userController.approveSchoolAdmin);

// ============================================================
// ADMIN (SUPER_ADMIN atau SCHOOL_ADMIN)
// ============================================================

// GET semua user (SCHOOL_ADMIN hanya melihat sekolahnya sendiri)
router.get("/", authMiddleware(["SUPER_ADMIN", "SCHOOL_ADMIN"]), userController.getAllUsers);

// Bulk import users
router.post("/bulk-import", authMiddleware(["SUPER_ADMIN", "SCHOOL_ADMIN"]), userController.bulkImportUsers);

// Hapus massal user (bulk delete)
router.delete("/bulk-delete", authMiddleware(["SUPER_ADMIN", "SCHOOL_ADMIN"]), userController.bulkDeleteUsers);

// ============================================================
// SUPER_ADMIN ONLY: Approve/Reject Teacher, Ganti Role, Hapus User
// ============================================================
// PATCH /api/users/:id/approve  body: { action: "APPROVE" | "REJECT" }
router.patch("/:id/approve", authMiddleware(["SUPER_ADMIN", "SCHOOL_ADMIN"]), userController.approveTeacher);

// PATCH /api/users/:id/role  body: { role: "STUDENT" | "TEACHER" }
router.patch("/:id/role", authMiddleware(["SUPER_ADMIN"]), userController.changeUserRole);

// DELETE /api/users/:id
router.delete("/:id", authMiddleware(["SUPER_ADMIN"]), userController.deleteUser);

export default router;