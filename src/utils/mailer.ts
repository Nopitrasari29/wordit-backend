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
