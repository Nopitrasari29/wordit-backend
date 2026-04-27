import { prisma } from "../../config/database";
import { hashPassword, comparePassword } from "../../utils/hash";
import { FileManager } from "../../utils/FileManager";
import { Prisma, Role, ApprovalStatus } from "@prisma/client";
import type { UpdateUserInput } from "./user.schema";

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
        educationLevel: true,
        photoUrl: true,
        createdAt: true,
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
// 2. APPROVE / REJECT TEACHER (Admin Only)
// ============================================================
export const approveTeacher = async (
  targetUserId: string,
  action: "APPROVE" | "REJECT"
) => {
  const user = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!user) throw new Error("User tidak ditemukan");
  if (user.role !== Role.TEACHER)
    throw new Error("Hanya akun Teacher yang bisa di-approve/reject");

  const newStatus =
    action === "APPROVE" ? ApprovalStatus.APPROVED : ApprovalStatus.REJECTED;

  const updated = await prisma.user.update({
    where: { id: targetUserId },
    data: { approvalStatus: newStatus },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      approvalStatus: true,
      educationLevel: true,
    },
  });

  return updated;
};

// ============================================================
// 3. CHANGE ROLE (Admin Only)
// ============================================================
export const changeUserRole = async (targetUserId: string, newRole: Role) => {
  const user = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!user) throw new Error("User tidak ditemukan");

  // Admin tidak bisa di-assign via endpoint
  if (newRole === Role.ADMIN)
    throw new Error("Tidak bisa assign role Admin via endpoint ini");

  const updated = await prisma.user.update({
    where: { id: targetUserId },
    data: { role: newRole },
    select: { id: true, name: true, email: true, role: true },
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
      educationLevel: true,
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
// 5. UPDATE PROFILE
// ============================================================
export const updateProfile = async (
  userId: string,
  data: UpdateUserInput,
  photoFile?: Express.Multer.File
) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
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

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      name: data.name ?? user.name,
      email: data.email ?? user.email,
      ...(hashedPassword && { password: hashedPassword }),
      photoUrl: updatedPicturePath,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      approvalStatus: true,
      educationLevel: true,
      photoUrl: true,
      updatedAt: true,
    },
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
export const deleteUser = async (userId: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");

  await prisma.user.delete({ where: { id: userId } });
  if (user.photoUrl) await FileManager.remove(user.photoUrl);

  return { message: "User deleted successfully" };
};