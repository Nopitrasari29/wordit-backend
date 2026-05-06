import { prisma } from "../../config/database";
import { hashPassword, comparePassword } from "../../utils/hash";
import { generateToken } from "../../utils/jwt";
import type { RegisterInput, LoginInput } from "./auth.schema";
import { Role, ApprovalStatus, EducationLevel } from "@prisma/client";
import { sendApprovalRequestToTele } from "../../utils/telegram.service"; // ✅ IMPORT BOT TELEGRAM
import { getIO } from "../../socket"; // ✅ IMPORT SOCKET.IO UNTUK NOTIF ADMIN WEB
import { createSystemLog } from "../../utils/system-logger";

export const register = async (data: RegisterInput) => {
  // BE-NEW-03: Admin TIDAK BISA register via endpoint
  if ((data.role as string) === "ADMIN") {
    throw new Error("Registrasi sebagai Admin tidak diizinkan.");
  }

  // Cek email sudah ada atau belum
  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) throw new Error("Email already registered");

  const hashedPassword = await hashPassword(data.password);

  // BE-NEW-01: Teacher -> PENDING, Student -> APPROVED
  const approvalStatus: ApprovalStatus =
    data.role === "TEACHER" ? ApprovalStatus.PENDING : ApprovalStatus.APPROVED;

  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      password: hashedPassword,
      role: data.role as Role,
      approvalStatus,
      educationLevel: data.educationLevel
        ? (data.educationLevel as EducationLevel)
        : undefined,
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
      approvalStatus: true,
      educationLevel: true,
      createdAt: true,
    },
  });

  // =========================================================
  // 📝 SYSTEM LOG REGISTER
  // =========================================================
  await createSystemLog({
    action: "REGISTER",
    details: `${user.name} melakukan registrasi sebagai ${user.role}`,
    userId: user.id,
    userName: user.name,
  });

  // =========================================================
  // 🚀 TRIGGER TELEGRAM BOT & WEB NOTIF (JIKA ROLE TEACHER)
  // =========================================================
  if (user.role === Role.TEACHER) {

    // 📝 SYSTEM LOG TEACHER REGISTER
    await createSystemLog({
      action: "TEACHER_REGISTER",
      details: `Teacher ${user.name} mendaftar dan menunggu approval`,
      userId: user.id,
      userName: user.name,
    });

    // 1. Kirim notif ke Telegram
    sendApprovalRequestToTele({
      id: user.id,
      name: user.name,
      email: user.email,
      educationLevel: user.educationLevel,
    }).catch(err => console.error("Gagal trigger bot Telegram:", err));

    // 2. Kirim notif Real-time ke Dashboard Admin via Socket (BE-20)
    try {
      const io = getIO();

      // Mengirim event "new_registration" ke room "admin"
      io.to("admin").emit("new_registration", {
        message: `👨‍🏫 Guru baru mendaftar: ${user.name}`,
        user: {
          id: user.id,
          name: user.name,
          email: user.email
        }
      });

      console.log(`📡 Socket emit: Notifikasi pendaftaran ${user.name} terkirim ke web Admin.`);
    } catch (err) {
      console.error("❌ Gagal emit socket notif admin:", err);
    }
  }

  // Teacher PENDING tidak boleh langsung dapat token
  if (user.approvalStatus === ApprovalStatus.PENDING) {
    return {
      user,
      token: null,
      message:
        "Registrasi berhasil! Akun Teacher kamu menunggu persetujuan Admin sebelum bisa login.",
    };
  }

  const token = generateToken({
    userId: user.id,
    email: data.email,
    role: user.role
  });

  return { user, token };
};

export const login = async (data: LoginInput) => {
  const user = await prisma.user.findUnique({
    where: { email: data.email }
  });

  if (!user) throw new Error("Invalid email or password");

  const isMatch = await comparePassword(data.password, user.password);

  if (!isMatch) throw new Error("Invalid email or password");

  // BE-NEW-01: Blokir login jika Teacher belum di-approve
  if (
    user.role === Role.TEACHER &&
    user.approvalStatus === ApprovalStatus.PENDING
  ) {
    throw new Error(
      "Akun kamu masih menunggu persetujuan Admin. Mohon tunggu konfirmasi melalui email."
    );
  }

  if (
    user.role === Role.TEACHER &&
    user.approvalStatus === ApprovalStatus.REJECTED
  ) {
    throw new Error(
      "Akun kamu ditolak oleh Admin. Hubungi administrator untuk informasi lebih lanjut."
    );
  }

  // =========================================================
  // 📝 SYSTEM LOG LOGIN
  // =========================================================
  await createSystemLog({
    action: "LOGIN",
    details: `${user.name} berhasil login`,
    userId: user.id,
    userName: user.name,
  });

  const token = generateToken({
    userId: user.id,
    email: user.email,
    role: user.role
  });

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      approvalStatus: user.approvalStatus,
      educationLevel: user.educationLevel,
    },
    token,
  };
};

export const logout = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId }
  });

  if (!user) throw new Error("User not found");

  // =========================================================
  // 📝 SYSTEM LOG LOGOUT
  // =========================================================
  await createSystemLog({
    action: "LOGOUT",
    details: `${user.name} logout dari sistem`,
    userId: user.id,
    userName: user.name,
  });

  return { message: "Logged out successfully" };
};