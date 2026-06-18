import { prisma } from "../../src/config/database";
import { hashPassword } from "../../src/utils/hash";
import { Role, ApprovalStatus, EducationLevel } from "@prisma/client";

export const seedUsers = async () => {
  console.log("Seeding users...");

  const users = [
    {
      name: "Super Admin WordIT",
      email: "wordit.official@gmail.com",
      password: await hashPassword("admin123"),
      role: Role.SUPER_ADMIN,
      approvalStatus: ApprovalStatus.APPROVED,
      educationLevels: [] as EducationLevel[],
    },
    {
      name: "Bu Sari (Guru SD)",
      email: "sari@wordit.com",
      password: await hashPassword("password123"),
      role: Role.TEACHER,
      approvalStatus: ApprovalStatus.APPROVED,
      educationLevels: [EducationLevel.SD] as EducationLevel[],
    },
    {
      name: "Pak Budi (Dosen Univ)",
      email: "budi@wordit.com",
      password: await hashPassword("password123"),
      role: Role.TEACHER,
      approvalStatus: ApprovalStatus.APPROVED,
      educationLevels: [EducationLevel.UNIVERSITY] as EducationLevel[],
    },
    {
      name: "Andi Mahasiswa",
      email: "andi@wordit.com",
      password: await hashPassword("password123"),
      role: Role.STUDENT,
      approvalStatus: ApprovalStatus.APPROVED,
      educationLevels: [] as EducationLevel[],
    },
  ];

  const createdUsers = [];

  for (const user of users) {
    const created = await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        password: user.password,
        role: user.role,
        approvalStatus: user.approvalStatus,
        educationLevels: user.educationLevels,
        // 🛠️ FIX: Gunakan field 'isVerified' sesuai dengan database schema kamu
        isVerified: true, 
      },
      create: {
        name: user.name,
        email: user.email,
        password: user.password,
        role: user.role,
        approvalStatus: user.approvalStatus,
        educationLevels: user.educationLevels,
        // 🛠️ FIX: Gunakan field 'isVerified' sesuai dengan database schema kamu
        isVerified: true,
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
    console.log(`   OK ${created.role} [${created.approvalStatus}]: ${created.name}`);
  }

  return createdUsers;
};