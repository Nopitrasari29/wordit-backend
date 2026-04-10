import { prisma } from "../../config/database"
import { hashPassword, comparePassword } from "../../utils/hash"
import { generateToken } from "../../utils/jwt"
import type { RegisterInput, LoginInput } from "./auth.schema"

export const register = async (data: RegisterInput) => {
  // Cek email sudah ada atau belum
  const existing = await prisma.user.findUnique({
    where: { email: data.email },
  })

  if (existing) {
    throw new Error("Email already registered")
  }

  // Hash password
  const hashedPassword = await hashPassword(data.password)

  // Buat user + profile sekaligus
  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      password: hashedPassword,
      role: data.role,
      profile: {
        create: {},
      },
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
    },
  })

  // Generate token
  const token = generateToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  })

  return { user, token }
}

export const login = async (data: LoginInput) => {
  // Cari user by email
  const user = await prisma.user.findUnique({
    where: { email: data.email },
  })

  if (!user) {
    throw new Error("Invalid email or password")
  }

  // Cek password
  const isMatch = await comparePassword(data.password, user.password)
  if (!isMatch) {
    throw new Error("Invalid email or password")
  }

  // Generate token
  const token = generateToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  })

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
    token,
  }
}

export const logout = async (userId: string) => {
  // Cek user exist
  const user = await prisma.user.findUnique({
    where: { id: userId },
  })

  if (!user) {
    throw new Error("User not found")
  }

  // JWT stateless — client yang hapus token
  // Di sini bisa tambah blacklist token kalau perlu nanti
  return { message: "Logged out successfully" }
}