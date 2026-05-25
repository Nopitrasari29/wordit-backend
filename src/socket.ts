import { Server } from "socket.io";
import { type Server as HttpServer } from "http";

let io: Server;

/**
 * 🎯 PENAMPUNG DATA REAL-TIME (In-Memory)
 * Struktur: { "OZE0RU": { status: "waiting", players: [{ id: "socketId", name: "Aswalia", score: 0 }] } }
 */
const rooms: Record<
  string,
  { status: "waiting" | "playing"; players: any[]; hostSocketId?: string }
> = {};

const reconnectTimers: Record<string, NodeJS.Timeout> = {};

export const getRooms = () => rooms;

export const initSocket = (httpServer: HttpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: "http://localhost:5173",
      methods: ["GET", "POST"],
      credentials: true,
    },
    pingTimeout: 60000,
  });

  io.on("connection", (socket) => {
    console.log(`🔌 New Connection: ${socket.id}`);

    // 0. 🛡️ ADMIN ROOM: Admin join room khusus untuk menerima notifikasi real-time
    socket.on("join_admin_room", () => {
      socket.join("admin");
      console.log(`🛡️ Admin socket [${socket.id}] joined room [admin]`);
    });

    // 1. 👨‍🏫 HOST JOIN: Guru membuka ruangan proyektor
    socket.on("hostJoin", (code: string) => {
      const roomCode = code?.toUpperCase().trim();
      if (!roomCode) return console.error("❌ HostJoin failed: Code empty");

      socket.join(roomCode);
      console.log(`✅ SUCCESS: Host joined Room [${roomCode}]`);

      if (!rooms[roomCode]) {
        rooms[roomCode] = { status: "waiting", players: [] };
      }
      rooms[roomCode].hostSocketId = socket.id;

      io.to(roomCode).emit("updatePlayerList", rooms[roomCode].players);
    });

    // 1b. 👢 KICK PLAYER: Host mengeluarkan siswa dari lobby
    socket.on(
      "kickPlayer",
      ({ code, playerId }: { code: string; playerId: string }) => {
        const roomCode = code?.toUpperCase().trim();
        const room = rooms[roomCode];
        if (room && room.hostSocketId === socket.id) {
          const playerIdx = room.players.findIndex((p) => p.id === playerId);
          if (playerIdx !== -1) {
            const kickedPlayer = room.players[playerIdx];
            console.log(`👢 Kicking player [${kickedPlayer.name}] from room [${roomCode}]`);
            
            // Hapus dari daftar pemain
            room.players.splice(playerIdx, 1);
            
            // Beritahu client target bahwa dia dikick
            io.to(playerId).emit("kickedFromLobby");
            
            // Update daftar pemain ke semua orang (termasuk Host)
            io.to(roomCode).emit("updatePlayerList", room.players);
          }
        }
      }
    );

    // 2. 👤 JOIN LOBBY: Siswa masuk ke ruangan kuis
    socket.on(
      "joinLobby",
      ({ code, playerName }: { code: string; playerName: string }) => {
        const roomCode = code?.toUpperCase().trim();
        if (!roomCode || !playerName) return;

        const room = rooms[roomCode];
        if (!room || !room.hostSocketId) {
          console.log(`❌ JoinLobby rejected: Room [${roomCode}] does not exist or has no active host.`);
          socket.emit("roomError", "Kode kuis tidak aktif atau tidak ditemukan.");
          return;
        }

        socket.join(roomCode);
        const isExist = room.players.find(
          (p) => p.id === socket.id || p.name === playerName
        );

        if (!isExist) {
          room.players.push({
            id: socket.id,
            name: playerName,
            score: 0,
            isOnline: true,
          });
        } else {
          isExist.id = socket.id;
          isExist.isOnline = true;
          // Clear reconnection timer if it exists
          const timerKey = `${roomCode}_${playerName}`;
          if (reconnectTimers[timerKey]) {
            clearTimeout(reconnectTimers[timerKey]);
            delete reconnectTimers[timerKey];
            console.log(
              `🔄 Reconnection timer cleared for ${playerName} in room ${roomCode} during joinLobby`
            );
          }
        }

        console.log(
          `👤 Player [${playerName}] joined Room: ${roomCode} [${room.status}]`
        );

        // Kirim info status terbaru ke siswa yang baru join
        socket.emit("lobbyInfo", {
          status: room.status,
          players: room.players,
          gameId: roomCode,
        });

        // Update daftar pemain ke semua orang (termasuk Host)
        io.to(roomCode).emit("updatePlayerList", room.players);

        // ✅ FIX (Late Join): Jika status room sudah "playing", beritahu siswa ini agar langsung mulai
        if (room.status === "playing") {
          socket.emit("gameStarted", roomCode);
        }
      }
    );

    // 2b. 👤 JOIN GAME (Play Area): Siswa masuk langsung ke play area (misal setelah refresh / late join)
    socket.on("joinGame", (data: any) => {
      let roomCode = "";
      let playerName = "";

      if (typeof data === "string") {
        roomCode = data.toUpperCase().trim();
      } else if (data && typeof data === "object") {
        roomCode = data.code?.toUpperCase().trim();
        playerName = data.playerName;
      }

      if (!roomCode) return;

      socket.join(roomCode);
      console.log(
        `👤 Player socket [${socket.id}] joined play room [${roomCode}]`
      );

      if (playerName) {
        if (!rooms[roomCode]) {
          rooms[roomCode] = { status: "playing", players: [] };
        }
        const room = rooms[roomCode];
        if (room) {
          const existingPlayer = room.players.find(
            (p) => p.name === playerName
          );

          if (existingPlayer) {
            existingPlayer.id = socket.id;
            existingPlayer.isOnline = true;
            console.log(
              `🔄 Re-associated Player [${playerName}] to new socket [${socket.id}] in room [${roomCode}]`
            );
            // Clear reconnection timer if it exists
            const timerKey = `${roomCode}_${playerName}`;
            if (reconnectTimers[timerKey]) {
              clearTimeout(reconnectTimers[timerKey]);
              delete reconnectTimers[timerKey];
              console.log(
                `🔄 Reconnection timer cleared for ${playerName} in room ${roomCode} during joinGame`
              );
            }
          } else {
            room.players.push({
              id: socket.id,
              name: playerName,
              score: 0,
              isOnline: true,
            });
            console.log(
              `👤 Player [${playerName}] added to room [${roomCode}] during joinGame`
            );
          }

          // Broadcast updated list to the host and other players
          io.to(roomCode).emit("updatePlayerList", room.players);
        }
      }
    });

    // 3. 📈 UPDATE SCORE: Live update saat siswa menjawab benar
    socket.on(
      "updateScore",
      ({ code, score }: { code: string; score: number }) => {
        const roomCode = code?.toUpperCase().trim();
        const room = rooms[roomCode];

        if (room) {
          const playerIndex = room.players.findIndex((p) => p.id === socket.id);
          if (playerIndex !== -1) {
            room.players[playerIndex].score = score;
            console.log(
              `📈 [${roomCode}] ${room.players[playerIndex].name}: ${score} pts`
            );

            // Kirim balik ke Guru agar ranking berubah real-time
            io.to(roomCode).emit("updatePlayerList", room.players);
          }
        }
      }
    );

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
          // Check if Host disconnected
          if (room.hostSocketId === socket.id) {
            console.log(
              `👨‍🏫 Host disconnected from room [${roomCode}]. Cleaning up room...`
            );
            io.to(roomCode).emit("hostDisconnected");
            // Clear any pending player reconnection timers for this room
            room.players.forEach((p) => {
              const timerKey = `${roomCode}_${p.name}`;
              if (reconnectTimers[timerKey]) {
                clearTimeout(reconnectTimers[timerKey]);
                delete reconnectTimers[timerKey];
              }
            });
            delete rooms[roomCode];
            return;
          }

          const playerIndex = room.players.findIndex((p) => p.id === socket.id);
          if (playerIndex !== -1) {
            const player = room.players[playerIndex];
            const playerName = player.name;

            // Only mark offline if socket.id matches (not re-associated yet)
            if (player.id === socket.id) {
              player.isOnline = false;
              io.to(roomCode).emit("updatePlayerList", room.players);
              console.log(
                `👋 ${playerName} disconnected from ${roomCode}, waiting 30s for reconnection...`
              );

              const timerKey = `${roomCode}_${playerName}`;
              if (reconnectTimers[timerKey]) {
                clearTimeout(reconnectTimers[timerKey]);
              }

              reconnectTimers[timerKey] = setTimeout(() => {
                delete reconnectTimers[timerKey];
                const currentRoom = rooms[roomCode];
                if (currentRoom) {
                  const idx = currentRoom.players.findIndex(
                    (p) => p.name === playerName
                  );
                  if (idx !== -1 && currentRoom.players[idx].isOnline === false) {
                    currentRoom.players.splice(idx, 1);
                    io.to(roomCode).emit("updatePlayerList", currentRoom.players);
                    console.log(
                      `💀 ${playerName} removed permanently from ${roomCode} after timeout.`
                    );

                    if (currentRoom.players.length === 0) {
                      delete rooms[roomCode];
                      console.log(`🗑️ Room ${roomCode} deleted as it is empty.`);
                    }
                  }
                }
              }, 30000);
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
