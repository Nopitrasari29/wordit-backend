import { Telegraf, Markup } from "telegraf";
import { prisma } from "../config/database";
import { getIO } from "../socket";
import { redis } from "../config/redis";

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
        // Validasi pengirim action callback agar hanya TELE_ADMIN_ID (grup atau user personal) yang bisa menyetujui
        const chatId = ctx.chat?.id;
        const fromId = ctx.from?.id;
        const isAuthorized = adminId && (String(chatId) === String(adminId) || String(fromId) === String(adminId));

        if (!isAuthorized) {
            await ctx.answerCbQuery("Akses ditolak: Anda bukan administrator resmi.", { show_alert: true });
            return;
        }

        const userId = ctx.match[1];

        // Update status di DB via Prisma
        const user = await prisma.user.update({
            where: { id: userId },
            data: { approvalStatus: "APPROVED" }
        });

        // Hapus dari Redis jika ada
        await redis.del(`tele-msg:${userId}`);

        // Buat log sistem
        const { createSystemLog } = await import("./system-logger");
        await createSystemLog({
            action: "APPROVE_TEACHER",
            details: `Teacher "${user.name}" approved via Telegram Bot (clicked by ${ctx.from?.first_name || "Admin"})`,
            userId: undefined,
            userName: `Telegram: ${ctx.from?.first_name || "Admin"}`,
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
        // Validasi pengirim action callback agar hanya TELE_ADMIN_ID (grup atau user personal) yang bisa menolak
        const chatId = ctx.chat?.id;
        const fromId = ctx.from?.id;
        const isAuthorized = adminId && (String(chatId) === String(adminId) || String(fromId) === String(adminId));

        if (!isAuthorized) {
            await ctx.answerCbQuery("Akses ditolak: Anda bukan administrator resmi.", { show_alert: true });
            return;
        }

        const userId = ctx.match[1];

        const user = await prisma.user.update({
            where: { id: userId },
            data: { approvalStatus: "REJECTED" }
        });

        // Hapus dari Redis jika ada
        await redis.del(`tele-msg:${userId}`);

        // Buat log sistem
        const { createSystemLog } = await import("./system-logger");
        await createSystemLog({
            action: "REJECT_TEACHER",
            details: `Teacher "${user.name}" rejected via Telegram Bot (clicked by ${ctx.from?.first_name || "Admin"})`,
            userId: undefined,
            userName: `Telegram: ${ctx.from?.first_name || "Admin"}`,
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
        const sentMessage = await bot.telegram.sendMessage(adminId, message, {
            parse_mode: "Markdown",
            ...Markup.inlineKeyboard([
                Markup.button.callback("Approve ✅", `approve_${user.id}`),
                Markup.button.callback("Reject ❌", `reject_${user.id}`)
            ])
        });

        // Simpan message_id ke Redis dengan expiry 7 hari
        await redis.set(`tele-msg:${user.id}`, sentMessage.message_id, "EX", 604800);
        console.log(`✅ Notifikasi pendaftaran ${user.name} terkirim ke Telegram (Msg ID: ${sentMessage.message_id}).`);
    } catch (error) {
        console.error("❌ Gagal mengirim notif ke Telegram:", error);
    }
};

/**
 * Update pesan Telegram ketika guru di-approve atau di-reject melalui website.
 */
export const updateTelegramMessageStatus = async (userId: string, action: "APPROVE" | "REJECT", userName: string) => {
    if (!botToken || !adminId) return;

    try {
        const messageId = await redis.get(`tele-msg:${userId}`);
        if (!messageId) {
            console.log(`ℹ️ Tidak ada message_id Telegram di Redis untuk user ${userId} (mungkin sudah kedaluwarsa atau di-approve via Tele)`);
            return;
        }

        const statusText = action === "APPROVE"
            ? `✅ *Selesai!* Guru *${userName}* telah disetujui via Website.`
            : `❌ *Ditolak!* Pendaftaran *${userName}* telah ditolak via Website.`;

        await bot.telegram.editMessageText(adminId, parseInt(messageId, 10), undefined, statusText, {
            parse_mode: "Markdown"
        });

        // Hapus dari Redis setelah berhasil
        await redis.del(`tele-msg:${userId}`);
        console.log(`✅ Pesan Telegram untuk ${userName} berhasil di-update dari Website.`);
    } catch (error) {
        console.error(`⚠️ Gagal memperbarui pesan Telegram dari website untuk user ${userId}:`, error);
    }
};

// Enable graceful stop
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));