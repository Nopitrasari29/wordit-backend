import nodemailer from "nodemailer";
import { env } from "../config/env";

let transporter: nodemailer.Transporter | null = null;

if (env.smtpHost && env.smtpUser && env.smtpPass) {
  transporter = nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpSecure,
    auth: {
      user: env.smtpUser,
      pass: env.smtpPass,
    },
  });
} else {
  console.warn("⚠️ SMTP credentials not fully configured in env. Mailer will fallback to console log.");
}

export const sendResetPasswordEmail = async (toEmail: string, resetLink: string) => {
  const mailOptions = {
    from: env.smtpFrom,
    to: toEmail,
    subject: "Reset Password WordIT",
    html: `
      <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px;">
        <h2 style="color: #4f46e5; text-align: center;">Reset Password WordIT</h2>
        <p>Halo,</p>
        <p>Kami menerima permintaan untuk mereset password akun Anda di WordIT. Silakan klik tombol di bawah ini untuk mereset password Anda:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 9999px; font-weight: bold; display: inline-block;">Reset Password</a>
        </div>
        <p>Jika tombol di atas tidak berfungsi, salin dan tempel link berikut ke browser Anda:</p>
        <p style="word-break: break-all; color: #4f46e5;"><a href="${resetLink}">${resetLink}</a></p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="font-size: 12px; color: #64748b;">Link reset password ini hanya berlaku selama 1 jam. Jika Anda tidak meminta reset password ini, abaikan email ini.</p>
      </div>
    `,
  };

  if (transporter) {
    await transporter.sendMail(mailOptions);
    console.log(`✉️ Email reset password sent successfully to ${toEmail}`);
  } else {
    console.log("\n==================================================");
    console.log(`✉️ [FALLBACK] EMAIL NOT SENT (SMTP NOT CONFIGURED)`);
    console.log(`To      : ${toEmail}`);
    console.log(`Subject : ${mailOptions.subject}`);
    console.log(`Link    : ${resetLink}`);
    console.log("==================================================\n");
  }
};

export const sendVerificationEmail = async (toEmail: string, verificationLink: string) => {
  const mailOptions = {
    from: env.smtpFrom,
    to: toEmail,
    subject: "Verifikasi Email Akun WordIT",
    html: `
      <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px;">
        <h2 style="color: #4f46e5; text-align: center;">Verifikasi Email WordIT</h2>
        <p>Halo,</p>
        <p>Terima kasih telah mendaftar di WordIT. Untuk mengaktifkan akun Anda, silakan verifikasi alamat email dengan menekan tombol di bawah ini.</p>
        <div style="text-align:center; margin:30px 0;">
          <a href="${verificationLink}" style="background-color:#4f46e5; color:white; padding:12px 24px; text-decoration:none; border-radius:9999px; font-weight:bold; display:inline-block;">Verifikasi Email</a>
        </div>
        <p>Jika tombol tidak berfungsi, salin link berikut ke browser:</p>
        <p style="word-break: break-all;"><a href="${verificationLink}">${verificationLink}</a></p>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0;" />
        <p style="font-size:12px;color:#64748b;">Link verifikasi berlaku selama 24 jam. Jika Anda tidak membuat akun WordIT, abaikan email ini.</p>
      </div>
    `,
  };

  if (transporter) {
    await transporter.sendMail(mailOptions);
    console.log(`✉️ Verification email sent successfully to ${toEmail}`);
  } else {
    console.log("\n==================================================");
    console.log(`✉️ [FALLBACK] VERIFICATION EMAIL NOT SENT (SMTP NOT CONFIGURED)`);
    console.log(`To      : ${toEmail}`);
    console.log(`Subject : ${mailOptions.subject}`);
    console.log(`Link    : ${verificationLink}`);
    console.log("==================================================\n");
  }
};

export const sendWelcomeEmail = async (toEmail: string, name: string, passwordRaw: string) => {
  const loginLink = `${env.frontendUrl}/login`;
  const mailOptions = {
    from: env.smtpFrom,
    to: toEmail,
    subject: "Selamat Datang di WordIT! 🎉",
    html: `
      <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px;">
        <h2 style="color: #4f46e5; text-align: center;">Selamat Datang di WordIT! 👋</h2>
        <p>Halo <strong>${name}</strong>,</p>
        <p>Akun Anda telah berhasil didaftarkan oleh Admin. Sekarang Anda dapat langsung masuk ke platform menggunakan kredensial di bawah ini tanpa perlu verifikasi tambahan:</p>
        
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0 0 8px 0;"><strong>Informasi Login Anda:</strong></p>
          <p style="margin: 0 0 5px 0;">📧 <strong>Email:</strong> ${toEmail}</p>
          <p style="margin: 0;">🔑 <strong>Password:</strong> <code style="background: #e2e8f0; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 14px;">${passwordRaw}</code></p>
        </div>

        <p>Silakan klik tombol di bawah ini untuk langsung ke halaman login:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${loginLink}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 9999px; font-weight: bold; display: inline-block;">Login ke WordIT</a>
        </div>
        <p>Jika tombol tidak berfungsi, salin dan tempel link berikut ke browser Anda:</p>
        <p style="word-break: break-all;"><a href="${loginLink}" style="color: #4f46e5;">${loginLink}</a></p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="font-size: 12px; color: #64748b; text-align: center;">Demi keamanan akun, silakan ubah password Anda setelah berhasil login pertama kali di halaman Profil Anda.</p>
      </div>
    `,
  };

  if (transporter) {
    await transporter.sendMail(mailOptions);
    console.log(`✉️ Welcome email sent successfully to ${toEmail}`);
  } else {
    console.log("\n==================================================");
    console.log(`✉️ [FALLBACK] WELCOME EMAIL NOT SENT (SMTP NOT CONFIGURED)`);
    console.log(`To      : ${toEmail}`);
    console.log(`Subject : ${mailOptions.subject}`);
    console.log(`Password: ${passwordRaw}`);
    console.log(`Link    : ${loginLink}`);
    console.log("==================================================\n");
  }
};