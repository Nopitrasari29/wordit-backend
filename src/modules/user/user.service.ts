import { prisma } from "../../config/database";
import { hashPassword, comparePassword } from "../../utils/hash";
import { FileManager } from "../../utils/FileManager";
import { Prisma, Role, ApprovalStatus, EducationLevel } from "@prisma/client";
import type { UpdateUserInput } from "./user.schema";
import { createSystemLog } from "../../utils/system-logger";
import { sendWelcomeEmail } from "../../utils/mailer";

const SCHOOL_ADMIN_ROLE = "SCHOOL_ADMIN" as Role;

// ============================================================
// 1. GET ALL USERS (Admin Dashboard)
// ============================================================
export const getAllUsers = async (query: any, requester?: any) => {
  const page = parseInt(query.page || "1");
  const limit = parseInt(query.limit || "10");
  const skip = (page - 1) * limit;

  const where: Prisma.UserWhereInput = {
    ...(query.role && { role: query.role as Role }),
    ...(query.approvalStatus && {
      approvalStatus: query.approvalStatus as ApprovalStatus,
    }),
    ...(query.adminRequestStatus && {
      adminRequestStatus: query.adminRequestStatus as ApprovalStatus,
    }),
    ...(query.hasAdminAccess !== undefined && {
      hasAdminAccess: query.hasAdminAccess === "true" || query.hasAdminAccess === true,
    }),
    ...(query.search && {
      OR: [
        { name: { contains: query.search, mode: "insensitive" } },
        { email: { contains: query.search, mode: "insensitive" } },
      ],
    }),
    // SCHOOL_ADMIN hanya bisa lihat user dari sekolahnya sendiri
    ...(requester?.role === "SCHOOL_ADMIN" && requester?.schoolOrigin && {
      schoolOrigin: requester.schoolOrigin,
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
        schoolOrigin: true,
        phoneNumber: true,
        hasAdminAccess: true,
        adminRequestStatus: true,
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
    await updateTelegramMessageStatus(targetUserId, action, updated.name, admin?.name || "Admin");
  } catch (teleErr) {
    console.error("⚠️ Gagal memperbarui status ke Telegram:", teleErr);
  }

  // Real-time socket notify
  try {
    const { getIO } = await import("../../socket");
    const io = getIO();
    io.to("admin").emit("admin_refresh");
  } catch (ioErr) {
    console.warn("⚠️ Gagal emit socket admin_refresh:", ioErr);
  }

  return updated;
};

// ============================================================
// 3. CHANGE ROLE (Admin Only)
// ============================================================
export const changeUserRole = async (
  targetUserId: string,
  newRole?: Role,
  hasAdminAccess?: boolean,
  adminUserId?: string
) => {
  const user = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!user) throw new Error("User tidak ditemukan");

  const dataToUpdate: Prisma.UserUpdateInput = {};

  if (newRole) {
    // Hanya Super Admin yang bisa assign SUPER_ADMIN, dan hanya untuk email resmi
    if ((newRole as string) === "SUPER_ADMIN") {
      throw new Error("Role SUPER_ADMIN hanya dapat diassign melalui seed database secara langsung.");
    }
    if ((newRole as string) === "ADMIN") {
      throw new Error("Role ADMIN sudah tidak digunakan. Gunakan SUPER_ADMIN atau SCHOOL_ADMIN.");
    }

    // Mencegah admin mengubah role sendiri
    if (adminUserId === targetUserId)
      throw new Error("Admin tidak diizinkan mengubah role milik sendiri");

    dataToUpdate.role = newRole;

    if (newRole === Role.TEACHER && user.educationLevels.length === 0) {
      dataToUpdate.educationLevels = [EducationLevel.SD];
    } else if (newRole === Role.STUDENT) {
      dataToUpdate.educationLevels = [];
    }
  }

  if (hasAdminAccess !== undefined) {
    // Prisma's generated UserUpdateInput may not include custom computed fields
    // so cast to any to allow updating the property if it exists in the schema.
    (dataToUpdate as any).hasAdminAccess = hasAdminAccess;
    // Auto sync role based on hasAdminAccess toggling
    if (hasAdminAccess && user.role === Role.TEACHER) {
      dataToUpdate.role = SCHOOL_ADMIN_ROLE;
    } else if (!hasAdminAccess && user.role === SCHOOL_ADMIN_ROLE) {
      dataToUpdate.role = Role.TEACHER;
    }
  }

  const updated = await prisma.user.update({
    where: { id: targetUserId },
    data: dataToUpdate,
    select: { id: true, name: true, email: true, role: true, hasAdminAccess: true },
  });

  const admin = adminUserId ? await prisma.user.findUnique({ where: { id: adminUserId } }) : null;
  await createSystemLog({
    action: "CHANGE_ROLE",
    details: `User "${updated.name}" updated (role: ${updated.role}, hasAdminAccess: ${updated.hasAdminAccess}) by Admin ${admin?.name || "Admin"}`,
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

  console.log("==================================");
  console.log("Photo File:", photoFile);

  if (photoFile) {
    console.log("Nama file:", photoFile.originalname);
    console.log("Mime:", photoFile.mimetype);
    console.log("Size:", photoFile.size);

    const newPath = await FileManager.upload(
      `user/profile/${userId}`,
      photoFile
    );

    console.log("Hasil upload:", newPath);

    if (user.photoUrl) {
      console.log("Menghapus foto lama:", user.photoUrl);
      await FileManager.remove(user.photoUrl);
    }

    updatedPicturePath = newPath;
  }

  console.log("Photo URL yang akan disimpan:", updatedPicturePath);
  console.log("==================================");

  // Membaca request langsung dari parameter data
  let textBioToSave = data.bio !== undefined ? data.bio : user.profile?.bio || "";

  // Jika ada titipan data dari pemisah string sebelumnya, bersihkan dulu agar tidak bertumpuk berulang-ulang
  if (textBioToSave.includes("||PENDING_REQ_LEVELS||")) {
    textBioToSave = textBioToSave.split("||PENDING_REQ_LEVELS||")[0].trim();
  }

  if (user.role === "TEACHER" && data.educationLevels !== undefined && data.approvalStatus === "PENDING") {
    // Rekatkan array baru di belakang deskripsi bio murni
    textBioToSave = `${textBioToSave} ||PENDING_REQ_LEVELS||${JSON.stringify(data.educationLevels)}`;
  }

  // Simpan/perbarui tabel profile
  if (
    user.role === "TEACHER" &&
    data.educationLevels !== undefined &&
    data.approvalStatus === "PENDING"
  ) {
    textBioToSave =
      `${textBioToSave} ||PENDING_REQ_LEVELS||${JSON.stringify(data.educationLevels)}`;
  }

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
      approvalStatus: data.approvalStatus ?? user.approvalStatus,
      // 🛠️ CRITICAL FIX: Simpan phoneNumber & schoolOrigin jika dikirim dari frontend
      ...(data.phoneNumber !== undefined && { phoneNumber: data.phoneNumber }),
      ...(data.schoolOrigin !== undefined && { schoolOrigin: data.schoolOrigin }),

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
      phoneNumber: true,
      schoolOrigin: true,
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
// 8. BULK DELETE USERS (Admin Only)
// ============================================================
export const bulkDeleteUsers = async (userIds: string[], adminUserId?: string) => {
  if (!Array.isArray(userIds) || userIds.length === 0) {
    throw new Error("Daftar ID user tidak boleh kosong");
  }

  const results = {
    total: userIds.length,
    success: 0,
    failed: 0,
    errors: [] as string[],
  };

  for (const userId of userIds) {
    try {
      await deleteUser(userId, adminUserId);
      results.success++;
    } catch (err: any) {
      results.failed++;
      results.errors.push(`User ID "${userId}": ${err.message || "Gagal dihapus"}`);
    }
  }

  const admin = adminUserId ? await prisma.user.findUnique({ where: { id: adminUserId } }) : null;
  await createSystemLog({
    action: "BULK_DELETE_USERS",
    details: `Bulk delete: ${results.success} berhasil, ${results.failed} gagal. Oleh Admin ${admin?.name || "Admin"}`,
    userId: adminUserId,
    userName: admin?.name || "Admin",
  });

  return results;
};

// ============================================================
// 8. GET STUDENT LEADERBOARD (Top 10 Students by XP/totalPoints)
// ============================================================
export const getStudentLeaderboard = async (schoolOrigin?: string) => {
  return await prisma.user.findMany({
    where: {
      role: Role.STUDENT,
      ...(schoolOrigin && {
        schoolOrigin: { equals: schoolOrigin, mode: "insensitive" },
      }),
    },
    select: {
      id: true,
      name: true,
      photoUrl: true,
      schoolOrigin: true,
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
    schoolOrigin?: string;
    phoneNumber?: string;
  }>,
  adminUserId?: string,
  requester?: any
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

      // SCHOOL_ADMIN hanya bisa membuat STUDENT dan TEACHER, bukan admin
      let role: Role;
      if (requester?.role === "SCHOOL_ADMIN") {
        role = (item.role === Role.TEACHER) ? Role.TEACHER : Role.STUDENT;
      } else {
        // Role.SUPER_ADMIN does not exist in the generated Role enum; compare by string instead
        const itemRoleStr = (item.role as string) || "";
        role = (itemRoleStr === "SUPER_ADMIN" || itemRoleStr === "ADMIN") ? Role.STUDENT : (item.role || Role.STUDENT);
      }
      const educationLevels = Array.isArray(item.educationLevels) ? item.educationLevels : [];

      // SCHOOL_ADMIN: otomatis set schoolOrigin ke sekolah admin, jika bukan gunakan dari data CSV
      const targetSchool = (requester?.role === "SCHOOL_ADMIN" && requester?.schoolOrigin)
        ? requester.schoolOrigin
        : (item.schoolOrigin || null);

      const targetPhone = item.phoneNumber || null;

      await prisma.user.create({
        data: {
          name: item.name.trim(),
          email,
          password: hashedPassword,
          role,
          approvalStatus: ApprovalStatus.APPROVED,
          isVerified: true,
          educationLevels,
          schoolOrigin: targetSchool,
          phoneNumber: targetPhone,
          profile: {
            create: {
              bio: "Halo, saya pengguna WordIT!",
              totalPoints: 0,
              badges: [],
            },
          },
        },
      });
      
      // Kirim welcome email secara asynchronous (background task) agar tidak menghambat response API
      sendWelcomeEmail(email, item.name.trim(), String(item.passwordRaw)).catch((emailErr) => {
        console.error(`❌ Gagal mengirim welcome email ke ${email}:`, emailErr);
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

// ============================================================
// RBAC: REQUEST SCHOOL ADMIN (oleh Teacher)
// ============================================================
export const requestSchoolAdmin = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      adminRequestStatus: true,
      schoolOrigin: true,
    },
  });
  if (!user) throw new Error("User tidak ditemukan");
  if (user.role !== Role.TEACHER && user.role !== SCHOOL_ADMIN_ROLE)
    throw new Error("Hanya Teacher yang bisa mengajukan Admin Sekolah");
  if (user.adminRequestStatus === ApprovalStatus.PENDING)
    throw new Error("Pengajuan Admin Sekolah kamu masih dalam proses review");

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { adminRequestStatus: ApprovalStatus.PENDING, hasAdminAccess: false },
    select: { id: true, name: true, email: true, role: true, adminRequestStatus: true },
  });

  await createSystemLog({
    action: "REQUEST_SCHOOL_ADMIN",
    details: `Teacher "${user.name}" mengajukan diri sebagai Admin Sekolah (Sekolah: ${user.schoolOrigin || 'N/A'})`,
    userId,
    userName: user.name,
  });

  // 🚀 Kirim notifikasi pengajuan ke Telegram Bot
  try {
    const { sendSchoolAdminRequestToTele } = await import("../../utils/telegram.service");
    await sendSchoolAdminRequestToTele({
      id: updated.id,
      name: user.name,
      email: user.email,
      schoolOrigin: user.schoolOrigin,
    });
  } catch (teleErr) {
    console.error("⚠️ Gagal mengirim notifikasi request school admin ke Telegram:", teleErr);
  }

  // 🚀 Kirim notifikasi email ke Admin Official (non-blocking)
  try {
    const { sendAdminRequestEmailToAdmin } = await import("../../utils/mailer");
    sendAdminRequestEmailToAdmin({
      name: user.name,
      email: user.email,
      schoolOrigin: user.schoolOrigin,
    }).catch((emailErr) => {
      console.error("⚠️ Gagal mengirim email notifikasi pengajuan ke Super Admin:", emailErr);
    });
  } catch (err) {
    console.error("⚠️ Gagal memuat/mengirim email notifikasi:", err);
  }

  // Real-time socket notify
  try {
    const { getIO } = await import("../../socket");
    const io = getIO();
    io.to("admin").emit("admin_refresh");
  } catch (ioErr) {
    console.warn("⚠️ Gagal emit socket admin_refresh:", ioErr);
  }

  return updated;
};

// ============================================================
// RBAC: APPROVE/REJECT SCHOOL ADMIN (oleh Super Admin)
// ============================================================
export const approveSchoolAdmin = async (
  targetUserId: string,
  action: "APPROVE" | "REJECT",
  superAdminId?: string
) => {
  const user = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      adminRequestStatus: true,
    },
  });
  if (!user) throw new Error("User tidak ditemukan");
  if (user.adminRequestStatus !== ApprovalStatus.PENDING)
    throw new Error("Tidak ada pengajuan Admin Sekolah yang sedang pending untuk user ini");

  const isApproved = action === "APPROVE";
  const newRole = isApproved ? SCHOOL_ADMIN_ROLE : user.role;
  const newAdminRequestStatus = isApproved ? ApprovalStatus.APPROVED : ApprovalStatus.REJECTED;

  const updated = await prisma.user.update({
    where: { id: targetUserId },
    data: {
      role: newRole,
      adminRequestStatus: newAdminRequestStatus,
      hasAdminAccess: isApproved,
    },
    select: { id: true, name: true, email: true, role: true, adminRequestStatus: true, hasAdminAccess: true },
  });

  const superAdmin = superAdminId ? await prisma.user.findUnique({ where: { id: superAdminId } }) : null;
  await createSystemLog({
    action: isApproved ? "APPROVE_SCHOOL_ADMIN" : "REJECT_SCHOOL_ADMIN",
    details: `${isApproved ? 'Disetujui' : 'Ditolak'}: Teacher "${user.name}" sebagai Admin Sekolah oleh Super Admin ${superAdmin?.name || 'Super Admin'}`,
    userId: superAdminId,
    userName: superAdmin?.name || "Super Admin",
  });

  // 🚀 Update status pesan di Telegram Bot secara otomatis
  try {
    const { updateTelegramSchoolAdminMessageStatus } = await import("../../utils/telegram.service");
    await updateTelegramSchoolAdminMessageStatus(targetUserId, action, updated.name, superAdmin?.name || "Super Admin");
  } catch (teleErr) {
    console.error("⚠️ Gagal memperbarui status request school admin ke Telegram:", teleErr);
  }

  // Real-time socket notify
  try {
    const { getIO } = await import("../../socket");
    const io = getIO();
    // Refresh admin list
    io.to("admin").emit("admin_refresh");
    // Send direct notify to the teacher!
    io.to(`user_${targetUserId}`).emit("user_notification", {
      type: "ADMIN_REQUEST_DECISION",
      status: newAdminRequestStatus,
      message: isApproved 
        ? "Permohonan Admin Sekolah Anda telah disetujui! Silakan masuk kembali atau segarkan halaman." 
        : "Permohonan Admin Sekolah Anda ditolak.",
    });
  } catch (ioErr) {
    console.warn("⚠️ Gagal emit socket keputusan admin:", ioErr);
  }

  return updated;
};

// ============================================================
// RBAC: CANCEL SCHOOL ADMIN (Self Demotion ke Teacher biasa)
// ============================================================
export const cancelSchoolAdmin = async (userId: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User tidak ditemukan");
  if (user.role !== SCHOOL_ADMIN_ROLE)
    throw new Error("Hanya Admin Sekolah yang bisa mengajukan pembatalan status admin");

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      role: Role.TEACHER,
      adminRequestStatus: null, // reset status request
      hasAdminAccess: false,
    },
    select: { id: true, name: true, email: true, role: true, adminRequestStatus: true },
  });

  await createSystemLog({
    action: "CANCEL_SCHOOL_ADMIN",
    details: `Guru "${user.name}" membatalkan status Admin Sekolah dan kembali menjadi Teacher biasa`,
    userId,
    userName: user.name,
  });

  // Emit socket ke admin agar otomatis update list user
  try {
    const { getIO } = await import("../../socket");
    const io = getIO();
    io.to("admin").emit("admin_refresh");
  } catch (ioErr) {
    console.warn("⚠️ Gagal emit socket refresh admin room:", ioErr);
  }

  return updated;
};
