import { prisma } from "../../config/database"
import { hashPassword, comparePassword } from "../../utils/hash"
import type { UpdateUserInput } from "./user.schema"

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
        }
      },
      _count: {
        select: {
          gamesCreated: true,
          sessions: true,
        }
      }
    }
  })

  if (!user) throw new Error("User not found")
  return user
}

export const updateProfile = async (
  userId: string,
  data: UpdateUserInput,
  photoUrl?: string
) => {
  const user = await prisma.user.findUnique({
    where: { id: userId }
  })

  if (!user) throw new Error("User not found")

  // Cek email sudah dipakai user lain
  if (data.email && data.email !== user.email) {
    const existing = await prisma.user.findUnique({
      where: { email: data.email }
    })
    if (existing) throw new Error("Email already used by another account")
  }

  // Handle ganti password
  let hashedPassword: string | undefined
  if (data.newPassword && data.currentPassword) {
    const isMatch = await comparePassword(data.currentPassword, user.password)
    if (!isMatch) throw new Error("Current password is incorrect")
    hashedPassword = await hashPassword(data.newPassword)
  }

  // Update user
  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(data.name && { name: data.name }),
      ...(data.email && { email: data.email }),
      ...(hashedPassword && { password: hashedPassword }),
      ...(photoUrl && { photoUrl }),
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      photoUrl: true,
      updatedAt: true,
    }
  })

  return updated
}

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
    orderBy: { createdAt: "desc" }
  })

  return games
}