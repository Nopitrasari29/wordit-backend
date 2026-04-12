import { prisma } from "../../src/config/database";
import { hashPassword } from "../../src/utils/hash";
import { Role } from "@prisma/client"; // ✅ Import Enum Role agar sinkron 100%

export const seedUsers = async () => {
  console.log("🌱 Seeding users...");

  const users = [
    {
      name: "Admin WordIT",
      email: "admin@wordit.com",
      password: await hashPassword("admin123"),
      role: Role.ADMIN,
    },
    {
      name: "Bu Sari (Guru SD)",
      email: "sari@wordit.com",
      password: await hashPassword("password123"),
      role: Role.TEACHER, // ✅ Menggunakan Role.TEACHER
    },
    {
      name: "Pak Budi (Dosen Univ)",
      email: "budi@wordit.com",
      password: await hashPassword("password123"),
      role: Role.TEACHER, // ✅ Menggunakan Role.TEACHER
    },
    {
      name: "Andi Mahasiswa",
      email: "andi@wordit.com",
      password: await hashPassword("password123"),
      role: Role.STUDENT,
    },
  ];

  const createdUsers = [];

  for (const user of users) {
    // Gunakan upsert agar jika email sudah ada, data hanya di-update (mencegah error duplikasi)
    const created = await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        password: user.password,
        role: user.role,
      },
      create: {
        name: user.name,
        email: user.email,
        password: user.password,
        role: user.role,
        // Pastikan UserProfile juga dibuat saat registrasi user baru
        profile: {
          create: {
            bio: "Halo, saya pengguna WordIT!",
            totalPoints: 0,
            badges: [],
          },
        },
      },
    });
    createdUsers.push(created);
    console.log(`  ✅ ${created.role}: ${created.name}`);
  }

  return createdUsers;
};