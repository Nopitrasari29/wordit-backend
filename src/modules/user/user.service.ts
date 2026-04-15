import { prisma } from "../../config/database";
import { hashPassword, comparePassword } from "../../utils/hash";
import { FileManager } from "../../utils/FileManager"; // Pastikan path ini sesuai
import { Prisma, Role } from "@prisma/client";
import type { UpdateUserInput } from "./user.schema";

// 1. MENGAMBIL SEMUA USER (UNTUK HALAMAN ADMIN)
export const getAllUsers = async (query: any) => {
  const page = parseInt(query.page || "1");
  const limit = parseInt(query.limit || "10");
  const skip = (page - 1) * limit;

  const where: Prisma.UserWhereInput = {
    ...(query.role && { role: query.role as Role }),
    ...(query.search && {
      OR:[
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
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

// 2. MENGAMBIL DETAIL PROFIL USER
export const getProfile = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      photoUrl: true,
      createdAt: true,
      profile: {
        select: {
          bio: true,
          totalPoints: true,
          badges: true,
        },
      },
      _count: {
        select: {
          gamesCreated: true,
          sessions: true,
        },
      },
    },
  });

  if (!user) throw new Error("User not found");
  return user;
};

// 3. MENGUPDATE PROFIL (DENGAN FILE MANAGER)
export const updateProfile = async (
  userId: string,
  data: UpdateUserInput,
  photoFile?: Express.Multer.File
) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) throw new Error("User not found");

  // Cek email sudah dipakai user lain
  if (data.email && data.email !== user.email) {
    const existing = await prisma.user.findUnique({
      where: { email: data.email },
    });
    if (existing) throw new Error("Email already used by another account");
  }

  // Handle ganti password
  let hashedPassword: string | undefined;
  if (data.newPassword && data.currentPassword) {
    const isMatch = await comparePassword(data.currentPassword, user.password);
    if (!isMatch) throw new Error("Current password is incorrect");
    hashedPassword = await hashPassword(data.newPassword);
  }

  // Handle Upload Foto
  let updatedPicturePath: string | null = user.photoUrl;
  if (photoFile) {
    const newPath = await FileManager.upload(`user/profile/${userId}`, photoFile);
    if (user.photoUrl) {
      await FileManager.remove(user.photoUrl);
    }
    updatedPicturePath = newPath;
  }

  // Update user
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
      photoUrl: true,
      updatedAt: true,
    },
  });

  return updated;
};

// 4. MENGAMBIL DAFTAR GAME MILIK USER
export const getUserGames = async (userId: string) => {
  const games = await prisma.game.findMany({
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

  return games;
};

// 5. MENGHAPUS USER & FOTONYA (UNTUK ADMIN)
export const deleteUser = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) throw new Error("User not found");

  // Hapus dari database
  await prisma.user.delete({
    where: { id: userId },
  });

  // Hapus foto dari folder
  if (user.photoUrl) {
    await FileManager.remove(user.photoUrl);
  }

  return { message: "User deleted successfully" };
};