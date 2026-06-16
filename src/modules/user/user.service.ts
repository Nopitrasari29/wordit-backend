import { prisma } from "../../config/database";
import { hashPassword, comparePassword } from "../../utils/hash";
import { FileManager } from "../../utils/FileManager";
import { Prisma, Role, ApprovalStatus, EducationLevel } from "@prisma/client";
import type { UpdateUserInput } from "./user.schema";
import { createSystemLog } from "../../utils/system-logger";

// ============================================================
// 1. GET ALL USERS (Admin Dashboard)
// ============================================================
export const getAllUsers = async (query: any) => {
  const page = parseInt(query.page || "1");
  const limit = parseInt(query.limit || "10");
  const skip = (page - 1) * limit;

  const where: Prisma.UserWhereInput = {
    ...(query.role && { role: query.role as Role }),
    ...(query.approvalStatus && {
      approvalStatus: query.approvalStatus as ApprovalStatus,
    }),
    ...(query.search && {
      OR: [
        { name: { contains: query.search, mode: "insensitive" } },
        { email: { contains: query.search, mode: "insensitive" } },
      ],
    }),
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        approvalStatus: true,
        educationLevels: true,
        photoUrl: true,
        createdAt: true,
        _count: { select: { gamesCreated: true } },
        profile: { select: { bio: true, totalPoints: true } }
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  return {
    data: users,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

// ============================================================
// 2. APPROVE / REJECT TEACHER (Admin Only) - TYPE SAFE FIXED
// ============================================================
export const approveTeacher = async (
  targetUserId: string,
  action: "APPROVE" | "REJECT",
  adminUserId?: string
) => {
  const user = await prisma.user.findUnique({ 
    where: { id: targetUserId },
    include: { profile: true }
  });

  if (!user) throw new Error("User tidak ditemukan");
  if (user.role !== Role.TEACHER)
    throw new Error("Hanya akun Teacher yang bisa di-approve/reject");

  const newStatus = action === "APPROVE" ? ApprovalStatus.APPROVED : ApprovalStatus.REJECTED;

  let finalEducationLevels = user.educationLevels;
  let cleanBio = user.profile?.bio || "";

  // 🛠️ FIX TYPE SAFE: Tambahkan pengecekan eksistensi user.profile yang ketat
  if (action === "APPROVE" && user.profile && user.profile.bio && user.profile.bio.includes("||PENDING_REQ_LEVELS||")) {
    try {
      const parts = user.profile.bio.split("||PENDING_REQ_LEVELS||");
      cleanBio = parts[0] ? parts[0].trim() : ""; 
      if (parts[1]) {
        finalEducationLevels = JSON.parse(parts[1]);
      }
    } catch (e) {
      console.error("⚠️ Gagal mengekstrak JSON data jenjang tertunda:", e);
    }
  } else if (action === "REJECT" && user.profile && user.profile.bio && user.profile.bio.includes("||PENDING_REQ_LEVELS||")) {
    cleanBio = user.profile.bio.split("||PENDING_REQ_LEVELS||")[0]?.trim() || "";
  }

  const updated = await prisma.user.update({
    where: { id: targetUserId },
    data: { 
      approvalStatus: newStatus,
      educationLevels: finalEducationLevels,
      profile: {
        update: {
          bio: cleanBio
        }
      }
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      approvalStatus: true,
      educationLevels: true,
    },
  });

  const admin = adminUserId ? await prisma.user.findUnique({ where: { id: adminUserId } }) : null;
  await createSystemLog({
    action: action === "APPROVE" ? "APPROVE_TEACHER" : "REJECT_TEACHER",
    details: `Teacher "${updated.name}" is ${action === "APPROVE" ? "approved" : "rejected"} by Admin ${admin?.name || "Admin"}`,
    userId: adminUserId,
    userName: admin?.name || "Admin",
  });

  try {
    const { updateTelegramMessageStatus } = await import("../../utils/telegram.service");
    await updateTelegramMessageStatus(targetUserId, action, updated.name);
  } catch (teleErr) {
    console.error("⚠️ Gagal memperbarui status ke Telegram:", teleErr);
  }

  return updated;
};

// ============================================================
// 3. CHANGE ROLE (Admin Only)
// ============================================================
export const changeUserRole = async (targetUserId: string, newRole: Role, adminUserId?: string) => {
  const user = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!user) throw new Error("User tidak ditemukan");

  // Admin tidak bisa di-assign via endpoint
  if (newRole === Role.ADMIN)
    throw new Error("Tidak bisa assign role Admin via endpoint ini");

  // Mencegah admin mengubah role sendiri (lockout lockout prevention)
  if (adminUserId === targetUserId)
    throw new Error("Admin tidak diizinkan mengubah role milik sendiri");

  const dataToUpdate: Prisma.UserUpdateInput = { role: newRole };

  if (newRole === Role.TEACHER && user.educationLevels.length === 0) {
    dataToUpdate.educationLevels = [EducationLevel.SD];
  } else if (newRole === Role.STUDENT) {
    dataToUpdate.educationLevels = [];
  }

  const updated = await prisma.user.update({
    where: { id: targetUserId },
    data: dataToUpdate,
    select: { id: true, name: true, email: true, role: true },
  });

  const admin = adminUserId ? await prisma.user.findUnique({ where: { id: adminUserId } }) : null;
  await createSystemLog({
    action: "CHANGE_ROLE",
    details: `User "${updated.name}" role changed to ${newRole} by Admin ${admin?.name || "Admin"}`,
    userId: adminUserId,
    userName: admin?.name || "Admin",
  });

  return updated;
};

// ============================================================
// 4. GET PROFILE
// ============================================================
export const getProfile = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      approvalStatus: true,
      educationLevels: true,
      photoUrl: true,
      createdAt: true,
      profile: { select: { bio: true, totalPoints: true, badges: true } },
      _count: { select: { gamesCreated: true, sessions: true } },
    },
  });

  if (!user) throw new Error("User not found");
  return user;
};

// ============================================================
// 5. UPDATE PROFILE (Self User) - CLEAN & FIXED TYPE SAFE
// ============================================================
export const updateProfile = async (
  userId: string,
  data: any, 
  photoFile?: Express.Multer.File
) => {
  // Ambil data user lengkap beserta profilnya
  const user = await prisma.user.findUnique({ 
    where: { id: userId },
    include: { profile: true } 
  });
  
  if (!user) throw new Error("User not found");

  if (data.email && data.email !== user.email) {
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new Error("Email already used by another account");
  }

  let hashedPassword: string | undefined;
  if (data.newPassword && data.currentPassword) {
    const isMatch = await comparePassword(data.currentPassword, user.password);
    if (!isMatch) throw new Error("Current password is incorrect");
    hashedPassword = await hashPassword(data.newPassword);
  }

  let updatedPicturePath: string | null = user.photoUrl;
  if (photoFile) {
    const newPath = await FileManager.upload(`user/profile/${userId}`, photoFile);
    if (user.photoUrl) await FileManager.remove(user.photoUrl);
    updatedPicturePath = newPath;
  }

  // Membaca request langsung dari parameter data terowongan controller
  let textBioToSave = data.bio !== undefined ? data.bio : user.profile?.bio || "";
  
  // Jika ada titipan data dari pemisah string sebelumnya, bersihkan dulu agar tidak bertumpuk berulang-ulang
  if (textBioToSave.includes("||PENDING_REQ_LEVELS||")) {
    textBioToSave = textBioToSave.split("||PENDING_REQ_LEVELS||")[0].trim();
  }

  if (user.role === "TEACHER" && data.educationLevels !== undefined && data.approvalStatus === "PENDING") {
    // Rekatkan array baru di belakang deskripsi bio murni
    textBioToSave = `${textBioToSave} ||PENDING_REQ_LEVELS||${JSON.stringify(data.educationLevels)}`;
    console.log("💾 Menyimpan Metadata Ajuan Baru ke Kolom Bio DB:", textBioToSave);
  }

  // Simpan/perbarui tabel profile
  await prisma.userProfile.upsert({
    where: { userId },
    update: { bio: textBioToSave },
    create: { userId, bio: textBioToSave },
  });

  // 🛠️ CODES REALIGNMENT: Kembalikan query update user milik profile murni (menggunakan userId)
  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      name: data.name ?? user.name,
      email: data.email ?? user.email,
      ...(hashedPassword && { password: hashedPassword }),
      photoUrl: updatedPicturePath,
      approvalStatus: data.approvalStatus ?? user.approvalStatus, // Ubah akun ke status PENDING secara resmi jika dipicu
      
      // KUNCI UTAMA WORKFLOW: Jangan pernah ubah kolom utama jika status pengajuannya adalah PENDING!
      ...(data.approvalStatus !== "PENDING" && data.educationLevels !== undefined && {
        educationLevels: data.educationLevels,
      }),
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      approvalStatus: true,
      educationLevels: true,
      photoUrl: true,
      updatedAt: true,
      profile: { select: { bio: true, totalPoints: true, badges: true } },
    },
  });

  await createSystemLog({
    action: "UPDATE_PROFILE",
    details: `User "${updated.name}" updated their profile (Approval Status: ${updated.approvalStatus})`,
    userId: userId,
    userName: updated.name,
  });

  return updated;
};

// ============================================================
// 6. GET USER GAMES
// ============================================================
export const getUserGames = async (userId: string) => {
  return await prisma.game.findMany({
    where: { creatorId: userId },
    select: {
      id: true,
      title: true,
      templateType: true,
      educationLevel: true,
      isPublished: true,
      playCount: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
};

// ============================================================
// 7. DELETE USER (Admin Only)
// ============================================================
export const deleteUser = async (userId: string, adminUserId?: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");

  // 1. Dapatkan semua game yang dibuat oleh user ini
  const gamesCreated = await prisma.game.findMany({
    where: { creatorId: userId },
    select: { id: true },
  });
  const gameIds = gamesCreated.map((g) => g.id);

  // 2. Dapatkan semua GameSession dari game-game tersebut ATAU yang dimainkan oleh user ini
  const sessions = await prisma.gameSession.findMany({
    where: {
      OR: [
        { gameId: { in: gameIds } },
        { userId: userId },
      ],
    },
    select: { id: true },
  });
  const sessionIds = sessions.map((s) => s.id);

  // Jalankan transaksi penghapusan berantai
  await prisma.$transaction(async (tx) => {
    // A. Hapus Result yang berelasi dengan GameSession
    if (sessionIds.length > 0) {
      await tx.result.deleteMany({
        where: { sessionId: { in: sessionIds } },
      });
    }

    // B. Hapus LtiContext yang berelasi dengan Game
    if (gameIds.length > 0) {
      await tx.ltiContext.deleteMany({
        where: { gameId: { in: gameIds } },
      });
    }

    // C. Hapus GameSession
    if (sessionIds.length > 0) {
      await tx.gameSession.deleteMany({
        where: { id: { in: sessionIds } },
      });
    }

    // D. Hapus Game
    if (gameIds.length > 0) {
      await tx.game.deleteMany({
        where: { id: { in: gameIds } },
      });
    }

    // E. Hapus UserProfile (jika ada)
    await tx.userProfile.deleteMany({
      where: { userId: userId },
    });

    // F. Hapus User utama
    await tx.user.delete({
      where: { id: userId },
    });
  });

  // Hapus file foto profil jika ada
  if (user.photoUrl) {
    try {
      await FileManager.remove(user.photoUrl);
    } catch (err) {
      console.error(`⚠️ Gagal menghapus foto profil user:`, err);
    }
  }

  // Hapus data leaderboard real-time di Redis untuk game yang terhapus
  if (gameIds.length > 0) {
    try {
      const { redis } = await import("../../config/redis");
      await Promise.all(
        gameIds.map((gameId) => redis.del(`leaderboard:${gameId}`))
      );
      console.log(`🗑️ Redis leaderboards cleared for user games:`, gameIds);
    } catch (redisErr) {
      console.error(`⚠️ Gagal menghapus key Redis leaderboards:`, redisErr);
    }
  }

  const admin = adminUserId ? await prisma.user.findUnique({ where: { id: adminUserId } }) : null;
  await createSystemLog({
    action: "DELETE_USER",
    details: `User "${user.name}" (${user.role}) deleted by Admin ${admin?.name || "Admin"}`,
    userId: adminUserId,
    userName: admin?.name || "Admin",
  });

  return { message: "User deleted successfully" };
};

// ============================================================
// 8. GET STUDENT LEADERBOARD (Top 10 Students by XP/totalPoints)
// ============================================================
export const getStudentLeaderboard = async () => {
  return await prisma.user.findMany({
    where: {
      role: Role.STUDENT,
    },
    select: {
      id: true,
      name: true,
      photoUrl: true,
      profile: {
        select: {
          totalPoints: true,
        },
      },
    },
    orderBy: {
      profile: {
        totalPoints: "desc",
      },
    },
    take: 10,
  });
};

// ============================================================
// 9. ADMIN ONLY: BULK IMPORT USERS
// ============================================================
export const bulkImportUsers = async (
  usersData: Array<{
    name: string;
    email: string;
    passwordRaw: string;
    role: Role;
    educationLevels?: EducationLevel[];
  }>,
  adminUserId?: string
) => {
  const admin = adminUserId ? await prisma.user.findUnique({ where: { id: adminUserId } }) : null;

  const results = {
    total: usersData.length,
    success: 0,
    failed: 0,
    errors: [] as string[],
  };

  for (const item of usersData) {
    try {
      const email = item.email?.trim().toLowerCase();
      if (!email) {
        results.failed++;
        results.errors.push(`Nama "${item.name || 'Tanpa Nama'}": Email tidak boleh kosong`);
        continue;
      }
      if (!item.name?.trim()) {
        results.failed++;
        results.errors.push(`Email "${item.email}": Nama tidak boleh kosong`);
        continue;
      }
      if (!item.passwordRaw || String(item.passwordRaw).trim().length < 6) {
        results.failed++;
        results.errors.push(`Email "${item.email}": Password harus minimal 6 karakter`);
        continue;
      }

      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email },
      });
      if (existingUser) {
        results.failed++;
        results.errors.push(`Email "${item.email}" sudah digunakan`);
        continue;
      }

      const hashedPassword = await hashPassword(String(item.passwordRaw));
      
      const role = item.role === Role.ADMIN ? Role.STUDENT : (item.role || Role.STUDENT); // prevent creating admins via bulk upload
      const educationLevels = Array.isArray(item.educationLevels) ? item.educationLevels : [];

      await prisma.user.create({
        data: {
          name: item.name.trim(),
          email,
          password: hashedPassword,
          role,
          approvalStatus: ApprovalStatus.APPROVED,
          isVerified: true,
          educationLevels,
          profile: {
            create: {
              bio: "Halo, saya pengguna WordIT!",
              totalPoints: 0,
              badges: [],
            },
          },
        },
      });

      results.success++;
    } catch (err: any) {
      results.failed++;
      results.errors.push(`Email "${item.email}": ${err.message || "Gagal menyimpan ke database"}`);
    }
  }

  await createSystemLog({
    action: "BULK_IMPORT_USERS",
    details: `Imported users mass: ${results.success} success, ${results.failed} failed. Initiated by Admin ${admin?.name || "Admin"}`,
    userId: adminUserId,
    userName: admin?.name || "Admin",
  });

  return results;
};
