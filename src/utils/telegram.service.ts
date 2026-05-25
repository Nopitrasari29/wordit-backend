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
        io.to("admin").emit("admin_refresh", {
            type: "USER_APPROVAL_UPDATED",
            userId: user.id,
            approvalStatus: user.approvalStatus,
        });

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

// ─── Singleton guard: mencegah double-launch saat hot-reload ────────
let _botStarted = false;

/**
 * Jalankan fungsi ini di `server.ts` atau `index.ts` utama
 * agar bot selalu standby mendengarkan klik tombol.
 */
export const startTelegramBot = () => {
    if (!botToken) return;
    if (_botStarted) {
        console.log("🤖 Telegram Bot sudah berjalan, skip re-launch.");
        return;
    }
    _botStarted = true;

    const launch = () => {
        bot.launch().then(() => {
            console.log("🤖 Telegram Bot is running...");
        }).catch((err: any) => {
            // Error 409 = instance lain masih polling → tunggu lalu coba lagi
            if (err?.message?.includes("409")) {
                console.warn("⚠️ Telegram 409 Conflict: instance lain masih aktif. Retry dalam 5 detik...");
                _botStarted = false;
                setTimeout(launch, 5000);
            } else {
                console.error("⚠️ Gagal koneksi ke Telegram API:", err.message);
                _botStarted = false;
            }
        });
    };

    launch();
};

/**
 * Fungsi ini dipanggil dari `auth.service.ts` setiap kali ada guru selesai register.
 */
export const sendApprovalRequestToTele = async (user: { id: string; name: string; email: string; educationLevels: string[] }) => {
    if (!botToken || !adminId) {
        console.log("⚠️ Lewati notifikasi Telegram (Token/Admin ID kosong)");
        return;
    }

    const message = `🚨 *GURU BARU DAFTAR!*\n\n*Nama:* ${user.name}\n*Email:* ${user.email}\n*Jenjang:* ${user.educationLevels?.join(", ") || "-"}\n\nSilakan review dan tentukan statusnya:`;

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