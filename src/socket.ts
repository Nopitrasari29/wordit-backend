import { Server } from "socket.io";
import { type Server as HttpServer } from "http";

let io: Server;
const rooms: Record<string, any[]> = {};

export const initSocket = (httpServer: HttpServer) => {
  io = new Server(httpServer, {
    cors: { 
      origin: "http://localhost:5173", 
      methods: ["GET", "POST"],
      credentials: true
    },
    // Tambahkan ping timeout agar koneksi lebih stabil di laptop/ITS wifi
    pingTimeout: 60000,
  });

  io.on("connection", (socket) => {
    // Log setiap ada koneksi masuk untuk mastiin socket aktif
    console.log(`🔌 New Connection: ${socket.id}`);

    // 1. 👨‍🏫 HOST JOIN (Guru/Proyektor)
    socket.on("hostJoin", (code: string) => {
      console.log(`🔍 Received hostJoin request for code: ${code}`);
      
      const roomCode = code?.toUpperCase().trim();
      if (!roomCode) {
        return console.error("❌ HostJoin failed: Code is empty");
      }

      socket.join(roomCode);
      
      // 🎯 LOG INI WAJIB MUNCUL: Kalau nggak muncul, berarti FE belum kirim data
      console.log(`✅ SUCCESS: Host joined Room [${roomCode}]`);
      
      // Kirim balik data pemain yang mungkin sudah nunggu duluan
      if (rooms[roomCode]) {
        console.log(`📦 Sending existing player list to Host: ${rooms[roomCode].length} players`);
        io.to(roomCode).emit("updatePlayerList", rooms[roomCode]);
      }
    });

    // 2. 👤 JOIN LOBBY (Siswa)
    socket.on("joinLobby", ({ code, playerName }: { code: string; playerName: string }) => {
      const roomCode = code?.toUpperCase().trim();
      if (!roomCode || !playerName) return;

      socket.join(roomCode);
      
      if (!rooms[roomCode]) {
        rooms[roomCode] = [];
      }

      const currentRoom = rooms[roomCode];
      if (currentRoom) {
        // Cek ID ganda
        const isExist = currentRoom.find(p => p.id === socket.id);
        if (!isExist) {
          currentRoom.push({ id: socket.id, name: playerName, score: 0 });
        }

        console.log(`👤 Player [${playerName}] joined Room: ${roomCode}`);
        
        // Kirim ke SEMUA (termasuk Host)
        io.to(roomCode).emit("updatePlayerList", currentRoom);
      }
    });

    // 3. 🚀 START GAME
    socket.on("startGame", (code: string) => {
      const roomCode = code?.toUpperCase().trim();
      if (!roomCode) return;

      console.log(`🚀 START SIGNAL sent to Room: ${roomCode}`);
      io.to(roomCode).emit("gameStarted", roomCode);
    });

    // 4. 🔌 DISCONNECT
    socket.on("disconnect", () => {
      Object.keys(rooms).forEach((roomCode) => {
        const currentRoom = rooms[roomCode];
        if (currentRoom) {
          const playerIndex = currentRoom.findIndex((p) => p.id === socket.id);
          if (playerIndex !== -1) {
            const playerName = currentRoom[playerIndex].name;
            currentRoom.splice(playerIndex, 1);
            io.to(roomCode).emit("updatePlayerList", currentRoom);
            console.log(`👋 ${playerName} left ${roomCode}`);

            if (currentRoom.length === 0) {
              delete rooms[roomCode];
            }
          }
        }
      });
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) throw new Error("🔥 Socket.io not initialized!");
  return io;
};