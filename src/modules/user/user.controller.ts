import type { Request, Response } from "express";
import { updateUserSchema } from "./user.schema";
import * as userService from "./user.service";
import { successResponse, errorResponse } from "../../utils/response";
import { Role } from "@prisma/client";
import { generateToken } from "../../utils/jwt";

export const getProfile = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) { res.status(401).json(errorResponse("Unauthorized")); return; }
    
    // Tarik data profil segar dari service
    const userProfileData = await userService.getProfile(userId);
    
    // 🛠️ FIX GENERATE TOKEN PAYLOAD: Gunakan generateToken dengan payload utuh
    const token = generateToken({ 
      userId: userProfileData.id, 
      role: userProfileData.role, 
      approvalStatus: userProfileData.approvalStatus,
      educationLevels: userProfileData.educationLevels 
    } as any);

    // 🛠️ FLAT STRUCTURE FIX: Satukan 'token' dan data user utama agar sejajar (flat object)
    // Ini memastikan frontend useAuth() langsung bisa membaca data tanpa nested property .profile
    res.status(200).json(successResponse({
      ...userProfileData,
      token
    }, "Profile fetched successfully"));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to get profile";
    res.status(400).json(errorResponse(message));
  }
};

export const updateProfile = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) { res.status(401).json(errorResponse("Unauthorized")); return; }

    if (typeof req.body.educationLevels === "string") {
      try {
        req.body.educationLevels = JSON.parse(req.body.educationLevels);
      } catch (e) {
        console.warn("⚠️ Gagal mem-parsing string FormData educationLevels");
      }
    }

    const parsed = updateUserSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json(errorResponse("Validation error", parsed.error.flatten().fieldErrors));
      return;
    }

    // Buat objek payload gabungan agar properti approvalStatus ikut terbaca di service
    const requesterRole = req.user?.role; 
    let updateData: any = { ...parsed.data };

    // 🛡️ SECURITY & APPROVAL WORKFLOW CONTROL
    if (requesterRole !== Role.ADMIN) {
      delete updateData.role;
      
      // 📝 WORKFLOW CONTROL: Jika akun TEACHER mengajukan perubahan jenjang baru
      if (requesterRole === Role.TEACHER && req.body.educationLevels !== undefined) {
        // Suntikkan status PENDING dan amankan array barunya di properti khusus
        updateData.approvalStatus = "PENDING";
        updateData.educationLevels = req.body.educationLevels; 
        console.log(`⚠️ Akun Teacher ${userId} meminta perubahan jenjang ke:`, updateData.educationLevels);
      } else {
        delete updateData.approvalStatus;
      }
    }

    // Kirim updateData ke database service
    const updated = await userService.updateProfile(userId, updateData, req.file);
    res.status(200).json(successResponse(updated, "Profile updated"));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update profile";
    res.status(400).json(errorResponse(message));
  }
};

export const getMyGames = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) { res.status(401).json(errorResponse("Unauthorized")); return; }
    const games = await userService.getUserGames(userId);
    res.status(200).json(successResponse(games, "Games fetched"));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to get games";
    res.status(400).json(errorResponse(message));
  }
};

// ============================================================
// ADMIN ONLY
// ============================================================

export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const result = await userService.getAllUsers(req.query);
    res.status(200).json(successResponse(result, "Users fetched successfully"));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to get users";
    res.status(400).json(errorResponse(message));
  }
};

export const approveTeacher = async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const { action } = req.body as { action: string };

    if (!["APPROVE", "REJECT"].includes(action)) {
      res.status(400).json(errorResponse("Action harus APPROVE atau REJECT"));
      return;
    }

    const adminUserId = req.user?.userId;
    
    // 1. Eksekusi penyimpanan data perubahan jenjang ke database PostgreSQL
    const result = await userService.approveTeacher(id, action as "APPROVE" | "REJECT", adminUserId);
    
    // 2. 🛠️ BENTUK TOKEN BARU SECARA REAL-TIME JIKA DI-APPROVE:
    let newToken = null;
    if (action === "APPROVE") {
      newToken = generateToken({
        userId: result.id,
        role: result.role,
        approvalStatus: result.approvalStatus,
        educationLevels: result.educationLevels
      } as any);
    }

    // 3. 🛠️ EMISI BROADCAST DENGAN PAYLOAD UTUH:
    // Kirim objek terstruktur agar didengar dan dicerna oleh TeacherDashboard.tsx
    if (req.app.get("io")) {
      req.app.get("io").emit("admin_refresh", {
        targetUserId: id,
        profile: result,
        token: newToken
      }); 
      console.log(`📡 Broadcast admin_refresh sukses terkirim beserta Payload Token Baru untuk user: ${id}`);
    }

    const msg = action === "APPROVE"
      ? "Teacher berhasil di-approve"
      : "Teacher berhasil di-reject";
      
    res.status(200).json(successResponse(result, msg));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Gagal memproses approval";
    res.status(400).json(errorResponse(message));
  }
};

export const changeUserRole = async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const { role } = req.body as { role: string };

    if (!role) {
      res.status(400).json(errorResponse("Role wajib diisi"));
      return;
    }

    const adminUserId = req.user?.userId;
    const result = await userService.changeUserRole(id, role as Role, adminUserId);
    res.status(200).json(successResponse(result, "Role berhasil diubah"));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Gagal mengubah role";
    res.status(400).json(errorResponse(message));
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const adminUserId = req.user?.userId;
    const result = await userService.deleteUser(id, adminUserId);
    res.status(200).json(successResponse(result, "User deleted"));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to delete user";
    res.status(400).json(errorResponse(message));
  }
};

// ============================================================
// GET STUDENT LEADERBOARD (Top Students by XP/totalPoints)
// ============================================================
export const getStudentLeaderboard = async (req: Request, res: Response) => {
  try {
    const leaderboard = await userService.getStudentLeaderboard();
    res.status(200).json(successResponse(leaderboard, "Student leaderboard fetched"));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to get student leaderboard";
    res.status(400).json(errorResponse(message));
  }
};

// ============================================================
// ADMIN ONLY: BULK DELETE USERS
// ============================================================
export const bulkDeleteUsers = async (req: Request, res: Response) => {
  try {
    const adminUserId = req.user?.userId;
    const { userIds } = req.body as { userIds: string[] };

    if (!Array.isArray(userIds) || userIds.length === 0) {
      res.status(400).json(errorResponse("Parameter 'userIds' harus berupa array tidak kosong."));
      return;
    }

    // Cegah admin menghapus dirinya sendiri dalam bulk delete
    const safeIds = userIds.filter((id) => id !== adminUserId);
    if (safeIds.length === 0) {
      res.status(400).json(errorResponse("Tidak dapat menghapus akun admin yang sedang aktif."));
      return;
    }

    const result = await userService.bulkDeleteUsers(safeIds, adminUserId);
    res.status(200).json(successResponse(result, `Hapus massal selesai: ${result.success} berhasil, ${result.failed} gagal`));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Gagal memproses hapus massal";
    res.status(400).json(errorResponse(message));
  }
};

// ============================================================
// ADMIN ONLY: BULK IMPORT USERS
// ============================================================
export const bulkImportUsers = async (req: Request, res: Response) => {
  try {
    const adminUserId = req.user?.userId;
    const { users } = req.body as { users: any[] };

    if (!Array.isArray(users)) {
      res.status(400).json(errorResponse("Format request salah. Parameter 'users' harus berupa array."));
      return;
    }

    const result = await userService.bulkImportUsers(users, adminUserId);
    res.status(200).json(successResponse(result, "Proses impor massal selesai"));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Gagal memproses impor massal";
    res.status(400).json(errorResponse(message));
  }
};