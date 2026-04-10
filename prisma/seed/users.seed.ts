import { prisma } from "../../src/config/database"
import { hashPassword } from "../../src/utils/hash"

export const seedUsers = async () => {
  console.log("🌱 Seeding users...")

  const users = [
    // Admin
    {
      name: "Admin WordIT",
      email: "admin@wordit.com",
      password: await hashPassword("admin123"),
      role: "ADMIN" as const,
    },
    // Creator SD
    {
      name: "Bu Sari",
      email: "sari@wordit.com",
      password: await hashPassword("creator123"),
      role: "CREATOR" as const,
    },
    // Creator University
    {
      name: "Pak Budi",
      email: "budi@wordit.com",
      password: await hashPassword("creator123"),
      role: "CREATOR" as const,
    },
    // Student SD
    {
      name: "Andi Kecil",
      email: "andi@wordit.com",
      password: await hashPassword("student123"),
      role: "STUDENT" as const,
    },
    // Student SMP
    {
      name: "Beni Siswa",
      email: "beni@wordit.com",
      password: await hashPassword("student123"),
      role: "STUDENT" as const,
    },
    // Student University
    {
      name: "Citra Mahasiswa",
      email: "citra@wordit.com",
      password: await hashPassword("student123"),
      role: "STUDENT" as const,
    },
  ]

  const createdUsers = []

  for (const user of users) {
    const created = await prisma.user.upsert({
      where: { email: user.email },
      update: {},
      create: {
        ...user,
        profile: {
          create: {}
        }
      },
    })
    createdUsers.push(created)
    console.log(`  ✅ ${created.role}: ${created.name} (${created.email})`)
  }

  return createdUsers
}