import { Server } from "socket.io";
import { type Server as HttpServer } from "http";

let io: Server;

export const initSocket = (httpServer: HttpServer) => {
  io = new Server(httpServer, {
    cors: { 
      origin: "http://localhost:5173", // Sesuaikan dengan port Vite kamu
      methods: ["GET", "POST"] 
    }
  });

  io.on("connection", (socket) => {
    console.log("🎮 User connected to WordIT:", socket.id);

    // 1. Join Lobby: Siswa masuk ke ruang tunggu kuis
    socket.on("joinLobby", ({ code, playerName }) => {
      const roomCode = code?.toUpperCase(); // Standarisasi Case
      
      socket.join(roomCode);
      console.log(`👤 Player [${playerName}] joined Room: ${roomCode}`);

      // Broadcast ke semua orang di room tersebut (termasuk yang baru join)
      // agar daftar pemain di FE terupdate secara real-time
      // Catatan: Di sini kamu bisa kirim playerName atau list lengkap jika sudah ada state di BE
      io.to(roomCode).emit("playerJoined", { playerName, socketId: socket.id });

      // Event tambahan untuk sinkronisasi daftar pemain
      // Tip: Kamu bisa menambahkan logic Redis di sini nanti untuk menyimpan list nama pemain permanen
    });

    // 2. Start Game: Guru menekan tombol mulai di Dashboard
    socket.on("startGame", (code) => {
      const roomCode = code?.toUpperCase();
      console.log(`🚀 Game Started in Room: ${roomCode}`);
      
      // Instruksikan semua Student di room ini untuk pindah ke halaman Play
      io.to(roomCode).emit("gameStarted");
    });

    // 3. Leave Room: Jika siswa menutup tab atau logout
    socket.on("leaveLobby", ({ code, playerName }) => {
        const roomCode = code?.toUpperCase();
        socket.leave(roomCode);
        console.log(`🏃 Player [${playerName}] left Room: ${roomCode}`);
        io.to(roomCode).emit("playerLeft", playerName);
    });

    socket.on("disconnect", () => {
      console.log("🔌 User disconnected from WordIT");
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) throw new Error("🔥 Socket.io not initialized! Call initSocket first.");
  return io;
};