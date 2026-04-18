import app from "./src/app";
import { env } from "./src/config/env";
import { createServer } from "http";
import { initSocket } from "./src/socket";
import "./src/config/redis"; // ✅ Memastikan Redis konek saat server nyala

const port = env?.port ? parseInt(env.port) : 3000;

// 1. Buat HTTP Server dari Express App
const server = createServer(app);

// 2. Tempelkan Socket.io ke HTTP Server
initSocket(server);

// 3. Nyalakan Server
server.listen(port, () => {
  console.log("--------------------------------------------------");
  console.log(`🚀 WordIT API + WebSocket is Live!`);
  console.log(`📡 URL: http://localhost:${port}`);
  console.log(`🛠️  Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log("--------------------------------------------------");
});

// Penanganan Error Global agar server tidak langsung mati tanpa info
process.on("unhandledRejection", (err) => {
  console.error("🔥 Unhandled Rejection:", err);
  server.close(() => process.exit(1));
});