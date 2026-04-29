import { Server } from "socket.io";
import { type Server as HttpServer } from "http";

let io: Server;

/**
 * 🎯 PENAMPUNG DATA REAL-TIME (In-Memory)
 * Struktur: { "OZE0RU": { status: "waiting", players: [{ id: "socketId", name: "Aswalia", score: 0 }] } }
 */
const rooms: Record<string, { status: "waiting" | "playing"; players: any[] }> = {};

export const getRooms = () => rooms;

export const initSocket = (httpServer: HttpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: "http://localhost:5173",
      methods: ["GET", "POST"],
      credentials: true
    },
    pingTimeout: 60000,
  });

  io.on("connection", (socket) => {
    console.log(`🔌 New Connection: ${socket.id}`);

    // 1. 👨‍🏫 HOST JOIN: Guru membuka ruangan proyektor
    socket.on("hostJoin", (code: string) => {
      const roomCode = code?.toUpperCase().trim();
      if (!roomCode) return console.error("❌ HostJoin failed: Code empty");

      socket.join(roomCode);
      console.log(`✅ SUCCESS: Host joined Room [${roomCode}]`);

      if (!rooms[roomCode]) {
        rooms[roomCode] = { status: "waiting", players: [] };
      }
      
      io.to(roomCode).emit("updatePlayerList", rooms[roomCode].players);
    });

    // 2. 👤 JOIN LOBBY: Siswa masuk ke ruangan kuis
    socket.on("joinLobby", ({ code, playerName }: { code: string; playerName: string }) => {
      const roomCode = code?.toUpperCase().trim();
      if (!roomCode || !playerName) return;

      socket.join(roomCode);
      if (!rooms[roomCode]) {
        rooms[roomCode] = { status: "waiting", players: [] };
      }

      const room = rooms[roomCode];
      const isExist = room.players.find(p => p.id === socket.id);
      
      if (!isExist) {
        room.players.push({ id: socket.id, name: playerName, score: 0 });
      }

      console.log(`👤 Player [${playerName}] joined Room: ${roomCode} [${room.status}]`);
      
      // Kirim info status terbaru ke siswa yang baru join
      socket.emit("lobbyInfo", { 
        status: room.status,
        players: room.players 
      });

      // Update daftar pemain ke semua orang (termasuk Host)
      io.to(roomCode).emit("updatePlayerList", room.players);
    });


    // 3. 📈 UPDATE SCORE: Live update saat siswa menjawab benar
    socket.on("updateScore", ({ code, score }: { code: string; score: number }) => {
      const roomCode = code?.toUpperCase().trim();
      const room = rooms[roomCode];

      if (room) {
        const playerIndex = room.players.findIndex(p => p.id === socket.id);
        if (playerIndex !== -1) {
          room.players[playerIndex].score = score;
          console.log(`📈 [${roomCode}] ${room.players[playerIndex].name}: ${score} pts`);

          // Kirim balik ke Guru agar ranking berubah real-time
          io.to(roomCode).emit("updatePlayerList", room.players);
        }
      }
    });

    // 4. 🚀 START GAME: Guru menekan tombol Start
    socket.on("startGame", (code: string) => {
      const roomCode = code?.toUpperCase().trim();
      if (!rooms[roomCode]) return;

      rooms[roomCode].status = "playing";
      console.log(`🚀 START SIGNAL: Room ${roomCode} is now playing.`);
      io.to(roomCode).emit("gameStarted", roomCode);
    });

    // 5. 🏁 FINISH GAME: Guru mengakhiri sesi kuis
    socket.on("finishGame", async (code: string) => {
      const roomCode = code?.toUpperCase().trim();
      const room = rooms[roomCode];

      if (room) {
        const finalPlayers = room.players;
        console.log(`🏁 FINISH SIGNAL: Saving results for ${roomCode}`);

        /**
         * 💡 TEMPAT INTEGRASI DATABASE (PRISMA):
         * Di sini kamu bisa memanggil service untuk simpan skor ke PostgreSQL:
         */
        try {
          const { saveLeaderboard } = require("./modules/game/game.service");
          await saveLeaderboard(roomCode, finalPlayers);
        } catch (error) {
          console.error("❌ Gagal memanggil saveLeaderboard:", error);
        }

        // Beritahu semua siswa bahwa game selesai + kirim data peringkat akhir
        io.to(roomCode).emit("gameFinished", finalPlayers);

        // Hapus dari memori RAM agar server tidak berat
        delete rooms[roomCode];
        console.log(`🗑️ Room ${roomCode} cleared from memory.`);
      }
    });

    // 6. 🔌 DISCONNECT: User keluar atau tutup tab
    socket.on("disconnect", () => {
      Object.keys(rooms).forEach((roomCode) => {
        const room = rooms[roomCode];
        if (room) {
          const playerIndex = room.players.findIndex((p) => p.id === socket.id);
          if (playerIndex !== -1) {
            const playerName = room.players[playerIndex].name;
            room.players.splice(playerIndex, 1);

            io.to(roomCode).emit("updatePlayerList", room.players);
            console.log(`👋 ${playerName} left ${roomCode}`);

            if (room.players.length === 0) {
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