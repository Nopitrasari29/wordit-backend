import { prisma } from "../../config/database";
import { hashPassword, comparePassword } from "../../utils/hash";
import { generateToken } from "../../utils/jwt";
import type { RegisterInput, LoginInput } from "./auth.schema";
import { Role } from "@prisma/client"; // ✅ Import Role dari client

export const register = async (data: RegisterInput) => {
  // 1. Cek email sudah ada atau belum
  const existing = await prisma.user.findUnique({
    where: { email: data.email },
  });

  if (existing) {
    throw new Error("Email already registered");
  }

  // 2. Hash password
  const hashedPassword = await hashPassword(data.password);

  // 3. Buat user + profile sekaligus (Wajib ada profile untuk skema baru)
  // ✅ REVISI: Menggunakan Role (enum) dan membuat UserProfile dalam satu transaction
  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      password: hashedPassword,
      role: data.role as Role, // ✅ Casting ke Enum Role
      profile: {
        create: {
          bio: "Halo, saya pengguna baru WordIT!",
          totalPoints: 0,
          badges: [],
        },
      },
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
    },
  });

  // 4. Generate token
  const token = generateToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  return { user, token };
};

export const login = async (data: LoginInput) => {
  // 1. Cari user by email
  const user = await prisma.user.findUnique({
    where: { email: data.email },
  });

  if (!user) {
    throw new Error("Invalid email or password");
  }

  // 2. Cek password
  const isMatch = await comparePassword(data.password, user.password);
  if (!isMatch) {
    throw new Error("Invalid email or password");
  }

  // 3. Generate token
  const token = generateToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
    token,
  };
};

export const logout = async (userId: string) => {
  // 1. Cek user exist
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error("User not found");
  }

  // 2. JWT stateless — client yang hapus token
  return { message: "Logged out successfully" };
};