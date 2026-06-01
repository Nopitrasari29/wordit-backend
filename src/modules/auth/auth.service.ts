import { prisma } from "../../config/database";
import { hashPassword, comparePassword } from "../../utils/hash";
import { generateToken } from "../../utils/jwt";
import type { RegisterInput, LoginInput, LtiLoginInput } from "./auth.schema";
import { Role, ApprovalStatus, EducationLevel } from "@prisma/client";
import { sendApprovalRequestToTele } from "../../utils/telegram.service"; // ✅ IMPORT BOT TELEGRAM
import { getIO } from "../../socket"; // ✅ IMPORT SOCKET.IO UNTUK NOTIF ADMIN WEB
import { createSystemLog } from "../../utils/system-logger";
import { sendVerificationEmail } from "../../utils/mailer";

import crypto from "crypto";

export const register = async (data: RegisterInput) => {
  // BE-NEW-03: Admin TIDAK BISA register via endpoint
  if ((data.role as string) === "ADMIN") {
    throw new Error("Registrasi sebagai Admin tidak diizinkan.");
  }

  // Cek email sudah ada atau belum
  const existing = await prisma.user.findUnique({
    where: { email: data.email },
  });
  if (existing) throw new Error("Email already registered");

  const hashedPassword = await hashPassword(data.password);

  // BE-NEW-01: Teacher -> PENDING, Student -> APPROVED
  const approvalStatus: ApprovalStatus =
    data.role === "TEACHER" ? ApprovalStatus.PENDING : ApprovalStatus.APPROVED;

  const verificationToken =
  crypto.randomBytes(32).toString("hex");

  const verificationTokenExpires =
  new Date(Date.now() + 24 * 60 * 60 * 1000);

  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      password: hashedPassword,
      isVerified: false,
      verificationToken,
      verificationTokenExpires,
      role: data.role as Role,
      approvalStatus,
      educationLevels: data.educationLevels
        ? data.educationLevels
        : [],
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
      educationLevels: true,
      createdAt: true,
    },
  });

  // =========================================================
  // 📝 SYSTEM LOG REGISTER
  // =========================================================
  // Kirim email verifikasi
  const verificationLink = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
  await sendVerificationEmail(user.email, verificationLink);

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
      educationLevels: user.educationLevels,
    }).catch((err) => console.error("Gagal trigger bot Telegram:", err));

    // 2. Kirim notif Real-time ke Dashboard Admin via Socket (BE-20)
    try {
      const io = getIO();

      // Mengirim event "new_registration" ke room "admin"
      io.to("admin").emit("new_registration", {
        message: `👨‍🏫 Guru baru mendaftar: ${user.name}`,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
      });

      console.log(
        `📡 Socket emit: Notifikasi pendaftaran ${user.name} terkirim ke web Admin.`,
      );
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
    role: user.role,
  });

  return { user, token };
};

export const login = async (data: LoginInput) => {
  const user = await prisma.user.findUnique({
    where: { email: data.email },
    select: {
      id: true,
      email: true,
      password: true,
      name: true,
      role: true,
      approvalStatus: true,
      educationLevels: true,
      photoUrl: true,
      isVerified: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) throw new Error("Invalid email or password");

  const isMatch = await comparePassword(data.password, user.password);

  if (!isMatch) throw new Error("Invalid email or password");

  if (!user.isVerified) {
    throw new Error(
      "Email belum diverifikasi. Silakan cek inbox email Anda."
    );
  }

  // BE-NEW-01: Blokir login jika Teacher belum di-approve
  if (
    user.role === Role.TEACHER &&
    user.approvalStatus === ApprovalStatus.PENDING
  ) {
    throw new Error(
      "Akun kamu masih menunggu persetujuan Admin. Mohon tunggu konfirmasi melalui email.",
    );
  }

  if (
    user.role === Role.TEACHER &&
    user.approvalStatus === ApprovalStatus.REJECTED
  ) {
    throw new Error(
      "Akun kamu ditolak oleh Admin. Hubungi administrator untuk informasi lebih lanjut.",
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
    role: user.role,
  });

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      approvalStatus: user.approvalStatus,
      educationLevels: user.educationLevels,
      photoUrl: user.photoUrl ?? null,
    },
    token,
  };
};

export const logout = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
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

export const ltiLogin = async (data: LtiLoginInput) => {
  let user = await prisma.user.findUnique({
    where: { email: data.email },
  });

  if (!user) {
    // Registrasi otomatis sebagai STUDENT
    console.log(`[LTI SSO] User ${data.email} tidak ditemukan. Mendaftarkan akun baru...`);
    const randomPassword = require("crypto").randomUUID();
    const hashedPassword = await hashPassword(randomPassword);

    user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: hashedPassword,
        role: Role.STUDENT,
        approvalStatus: ApprovalStatus.APPROVED,
        educationLevels: [],
        profile: {
          create: {
            bio: "Halo, saya siswa Moodle LTI WordIT!",
            totalPoints: 0,
            badges: [],
          },
        },
      },
    });

    await createSystemLog({
      action: "REGISTER",
      details: `${user.name} terdaftar otomatis via Moodle LTI SSO`,
      userId: user.id,
      userName: user.name,
    });
  }

  if (user.approvalStatus === ApprovalStatus.PENDING) {
    throw new Error("Akun kamu masih menunggu persetujuan Admin.");
  }

  await createSystemLog({
    action: "LOGIN",
    details: `${user.name} login via Moodle LTI SSO`,
    userId: user.id,
    userName: user.name,
  });

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
      approvalStatus: user.approvalStatus,
      educationLevels: user.educationLevels,
      photoUrl: user.photoUrl ?? null,
    },
    token,
  };
};

export const requestPasswordReset = async (email: string) => {
  const user = await prisma.user.findUnique({ where: { email } });
  
  // Security best practice: Don't reveal if the user exists
  if (!user) {
    console.log(`[RESET PASSWORD] Request for non-existent email: ${email}`);
    return;
  }

  // Generate a random secure token
  const crypto = require("crypto");
  const token = crypto.randomBytes(32).toString("hex");

  // Save token to Redis (key: forgot-token:..., val: email, EX: 3600 sec)
  const { redis } = await import("../../config/redis");
  await redis.set(`forgot-token:${token}`, email, "EX", 3600);

  // Send reset email
  const { env } = await import("../../config/env");
  const { sendResetPasswordEmail } = await import("../../utils/mailer");
  const resetLink = `${env.frontendUrl}/reset-password?token=${token}`;
  
  await sendResetPasswordEmail(email, resetLink);
  
  await createSystemLog({
    action: "REQUEST_RESET_PASSWORD",
    details: `User ${user.name} requested password reset`,
    userId: user.id,
    userName: user.name,
  });
};

export const resetPassword = async (token: string, newPassword: string) => {
  const { redis } = await import("../../config/redis");
  
  // Fetch email from Redis
  const email = await redis.get(`forgot-token:${token}`);
  if (!email) {
    throw new Error("Token reset password tidak valid atau sudah kedaluwarsa.");
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new Error("User tidak ditemukan.");
  }

  // Hash new password
  const hashedPassword = await hashPassword(newPassword);

  // Update user in Postgres
  const updatedUser = await prisma.user.update({
    where: { email },
    data: { password: hashedPassword },
  });

  // Delete token from Redis
  await redis.del(`forgot-token:${token}`);

  await createSystemLog({
    action: "RESET_PASSWORD",
    details: `User ${updatedUser.name} successfully reset their password`,
    userId: updatedUser.id,
    userName: updatedUser.name,
  });
};

export const verifyEmail = async (
  token: string,
) => {
  const user = await prisma.user.findFirst({
    // Prisma generated types may sometimes not include custom fields in the
    // WhereInput type depending on schema generation; cast to any to avoid
    // TS error while still performing the lookup at runtime.
    where: ({ verificationToken: token } as any),
    select: {
      id: true,
      name: true,
      verificationToken: true,
      verificationTokenExpires: true,
    },
  });

  if (!user) {
    throw new Error(
      "Token verifikasi tidak valid."
    );
  }

  if (
    !user.verificationTokenExpires ||
    (user.verificationTokenExpires as Date) <
      new Date()
  ) {
    throw new Error(
      "Token verifikasi sudah kadaluarsa."
    );
  }

  await prisma.user.update({
    where: {
      id: user.id,
    },
    data: {
      isVerified: true,
      verificationToken: null,
      verificationTokenExpires:
        null,
    },
  });

  return {
    message:
      "Email berhasil diverifikasi.",
  };
};