import app from "./src/app";
import { env } from "./src/config/env";
import { createServer } from "http";
import { initSocket } from "./src/socket";
import "./src/config/redis"; // ✅ Pastikan Redis siap untuk caching leaderboard

// 🎯 Ambil port dari env dengan fallback ke 5000 (standar Node.js)
const port = env?.port ? parseInt(env.port) : 5000;

// 1. Buat HTTP Server dari Express App
// Kita butuh ini karena Socket.io tidak bisa berjalan langsung di atas Express app instance.
const server = createServer(app);

// 2. Tempelkan Socket.io ke HTTP Server
// Fungsi initSocket yang kita buat tadi akan membungkus server ini.
initSocket(server);

// 3. Nyalakan Server
server.listen(port, () => {
  console.log(`
  ==================================================
  🚀 WordIT API + WebSocket is Live!
  📡 URL         : http://localhost:${port}
  🛠️  Environment : ${process.env.NODE_ENV || 'development'}
  🎮 Real-time   : Socket.io Initialized
  ==================================================
  `);
});

// ─── PENANGANAN ERROR GLOBAL ─────────────────────────────────────────

// Mencegah server mati total jika ada error asinkron yang tidak tertangkap
process.on("unhandledRejection", (reason, promise) => {
  console.error("🔥 Unhandled Rejection at:", promise, "reason:", reason);
  // Opsional: server.close(() => process.exit(1)); 
  // Untuk development, lebih baik jangan langsung exit agar bisa didebug
});

// Menangani crash tak terduga
process.on("uncaughtException", (err) => {
  console.error("💥 Uncaught Exception:", err.message);
  console.error(err.stack);
  process.exit(1);
});

// Penutupan server yang rapi (Graceful Shutdown)
process.on("SIGTERM", () => {
  console.info("SIGTERM signal received. Closing HTTP server...");
  server.close(() => {
    console.log("HTTP server closed.");
    process.exit(0);
  });
});