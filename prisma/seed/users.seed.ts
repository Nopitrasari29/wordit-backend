import { prisma } from "../../src/config/database";
import { hashPassword } from "../../src/utils/hash";
import { Role, ApprovalStatus, EducationLevel } from "@prisma/client";

export const seedUsers = async () => {
  console.log("Seeding users...");

  const users = [
    {
      name: "Admin WordIT",
      email: "admin@wordit.com",
      password: await hashPassword("admin123"),
      role: Role.ADMIN,
      approvalStatus: ApprovalStatus.APPROVED,
      educationLevel: undefined,
    },
    {
      name: "Bu Sari (Guru SD)",
      email: "sari@wordit.com",
      password: await hashPassword("password123"),
      role: Role.TEACHER,
      approvalStatus: ApprovalStatus.APPROVED,
      educationLevel: EducationLevel.SD,
    },
    {
      name: "Pak Budi (Dosen Univ)",
      email: "budi@wordit.com",
      password: await hashPassword("password123"),
      role: Role.TEACHER,
      approvalStatus: ApprovalStatus.APPROVED,
      educationLevel: EducationLevel.UNIVERSITY,
    },
    {
      name: "Andi Mahasiswa",
      email: "andi@wordit.com",
      password: await hashPassword("password123"),
      role: Role.STUDENT,
      approvalStatus: ApprovalStatus.APPROVED,
      educationLevel: undefined,
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
        educationLevel: user.educationLevel,
      },
      create: {
        name: user.name,
        email: user.email,
        password: user.password,
        role: user.role,
        approvalStatus: user.approvalStatus,
        educationLevel: user.educationLevel,
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
    console.log(`  OK ${created.role} [${created.approvalStatus}]: ${created.name}`);
  }

  return createdUsers;
};