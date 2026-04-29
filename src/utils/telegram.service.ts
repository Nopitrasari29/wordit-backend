import { Telegraf, Markup } from "telegraf";
import { prisma } from "../config/database";
import { getIO } from "../socket";

// Inisialisasi Bot dengan Token dari .env
const botToken = process.env.TELE_BOT_TOKEN;
const adminId = process.env.TELE_ADMIN_ID;

if (!botToken) {
    console.warn("⚠️ TELE_BOT_TOKEN belum diset di .env");
}

export const bot = new Telegraf(botToken || "");

// =====================================================================
// 🎯 LISTENER: MENANGKAP KLIK TOMBOL DARI TELEGRAM
// =====================================================================

// Menangkap klik tombol "Approve"
bot.action(/approve_(.+)/, async (ctx) => {
    try {
        const userId = ctx.match[1];

        // Update status di DB via Prisma
        const user = await prisma.user.update({
            where: { id: userId },
            data: { approvalStatus: "APPROVED" }
        });

        // Ubah pesan di Telegram agar tombolnya hilang
        await ctx.editMessageText(`✅ *Selesai!* Guru *${user.name}* telah disetujui.`, {
            parse_mode: "Markdown"
        });

        // Emit socket ke FE agar halaman Admin otomatis refresh
        const io = getIO();
        io.to("admin").emit("admin_refresh", { message: "Data user terupdate" });

    } catch (error) {
        console.error("❌ Gagal approve via Telegram:", error);
        await ctx.reply("Terjadi kesalahan saat meng-approve user di database.");
    }
});

// Menangkap klik tombol "Reject"
bot.action(/reject_(.+)/, async (ctx) => {
    try {
        const userId = ctx.match[1];

        const user = await prisma.user.update({
            where: { id: userId },
            data: { approvalStatus: "REJECTED" }
        });

        await ctx.editMessageText(`❌ *Ditolak!* Pendaftaran *${user.name}* telah ditolak.`, {
            parse_mode: "Markdown"
        });

        const io = getIO();
        io.to("admin").emit("admin_refresh", { message: "Data user terupdate" });

    } catch (error) {
        console.error("❌ Gagal reject via Telegram:", error);
        await ctx.reply("Terjadi kesalahan saat me-reject user di database.");
    }
});

// =====================================================================
// 🚀 EXPORT FUNCTIONS
// =====================================================================

/**
 * Jalankan fungsi ini di `server.ts` atau `index.ts` utama
 * agar bot selalu standby mendengarkan klik tombol.
 */
export const startTelegramBot = () => {
    if (botToken) {
        bot.launch();
        console.log("🤖 Telegram Bot Approval System is running...");
    }
};

/**
 * Fungsi ini dipanggil dari `auth.service.ts` setiap kali ada guru selesai register.
 */
export const sendApprovalRequestToTele = async (user: { id: string; name: string; email: string; educationLevel: string | null }) => {
    if (!botToken || !adminId) {
        console.log("⚠️ Lewati notifikasi Telegram (Token/Admin ID kosong)");
        return;
    }

    const message = `🚨 *GURU BARU DAFTAR!*\n\n*Nama:* ${user.name}\n*Email:* ${user.email}\n*Jenjang:* ${user.educationLevel || "-"}\n\nSilakan review dan tentukan statusnya:`;

    try {
        await bot.telegram.sendMessage(adminId, message, {
            parse_mode: "Markdown",
            ...Markup.inlineKeyboard([
                Markup.button.callback("Approve ✅", `approve_${user.id}`),
                Markup.button.callback("Reject ❌", `reject_${user.id}`)
            ])
        });
        console.log(`✅ Notifikasi pendaftaran ${user.name} terkirim ke Telegram.`);
    } catch (error) {
        console.error("❌ Gagal mengirim notif ke Telegram:", error);
    }
};

// Enable graceful stop
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));