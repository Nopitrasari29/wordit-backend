import { Server } from "socket.io";
import { type Server as HttpServer } from "http";

let io: Server;

/**
 * 🎯 PENAMPUNG DATA REAL-TIME (In-Memory)
 */
interface PendingStudent {
  id: string;
  name: string;
  userId?: string | null;
}

interface RoomState {
  status: "waiting" | "playing";
  players: any[];
  hostSocketId?: string;
  allowLateJoin: boolean;
  pendingStudents: PendingStudent[];
  kickedStudents: string[]; // Tetap dipertahankan di interface agar tidak merusak type-checking
  startedAt?: number;
}

const rooms: Record<string, RoomState> = {};
const reconnectTimers: Record<string, NodeJS.Timeout> = {};

export const getRooms = () => rooms;

export const initSocket = (httpServer: HttpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || "http://localhost:5173",
      methods: ["GET", "POST"],
      credentials: true,
    },
    pingTimeout: 60000,
  });

  io.on("connection", (socket) => {
    console.log(`🔌 New Connection: ${socket.id}`);

    // 0. 🛡️ ADMIN ROOM
    socket.on("join_admin_room", () => {
      socket.join("admin");
      console.log(`🛡️ Admin socket [${socket.id}] joined room [admin]`);
    });

    socket.on("join_user_room", (userId: string) => {
      if (!userId) return;
      socket.join(`user_${userId}`);
      console.log(`👤 User socket [${socket.id}] joined room [user_${userId}]`);
    });

    // 1. 👨‍🏫 HOST JOIN: Guru membuka ruangan proyektor
    socket.on("hostJoin", (code: string) => {
      const roomCode = code?.toUpperCase().trim();
      if (!roomCode) return console.error("❌ HostJoin failed: Code empty");

      socket.join(roomCode);
      console.log(`✅ SUCCESS: Host joined Room [${roomCode}]`);

      // Reset lobby to a fresh clean state with 0 players if the room does not exist or is in waiting status.
      // If the room is already "playing" (active gameplay), keep the state to allow host reconnection.
      if (!rooms[roomCode] || rooms[roomCode].status === "waiting") {
        rooms[roomCode] = {
          status: "waiting",
          players: [],
          allowLateJoin: true,
          pendingStudents: [],
          kickedStudents: [],
        };
        // 🛠️ Reset Redis leaderboard key on hostJoin / lobby reset
        try {
          const { prisma } = require("./config/database");
          const { redis } = require("./config/redis");
          prisma.game.findFirst({
            where: { shareCode: roomCode },
            select: { id: true }
          }).then((game: any) => {
            if (game) {
              redis.del(`leaderboard:${game.id}`);
              console.log(`🗑️ Resetting Redis leaderboard for game ${game.id} on hostJoin`);
            }
          }).catch((err: any) => console.error("Error resetting leaderboard on hostJoin:", err));
        } catch (redisErr) {
          console.error("Error loading config/modules for hostJoin reset:", redisErr);
        }
      }
      rooms[roomCode].hostSocketId = socket.id;

      io.to(roomCode).emit("updatePlayerList", rooms[roomCode].players);

      io.to("admin").emit("hostJoined", {
        roomCode,
        hostSocketId: socket.id,
      });

      socket.emit("pendingStudents", rooms[roomCode].pendingStudents || []);
    });

    socket.on("setLateJoin", ({ roomCode, allowLateJoin }) => {
      const room = rooms[roomCode];
      if (!room) return;
      room.allowLateJoin = allowLateJoin;
      console.log(`Late Join ${allowLateJoin}`);
    });

    // 1b. 👢 KICK PLAYER: Host mengeluarkan siswa dari lobby
    socket.on("kickPlayer", ({ code, playerId }: { code: string; playerId: string }) => {
      console.log("Base 👢 KICK REQUEST:", { code, playerId });

      const roomCode = code?.toUpperCase().trim();
      const room = rooms[roomCode];

      if (!room || room.hostSocketId !== socket.id) {
        console.warn(`⚠️ Unauthorized kick attempt from ${socket.id}`);
        return;
      }

      const playerIdx = room.players.findIndex((p) => p.id === playerId);
      if (playerIdx === -1) {
        console.warn(`⚠️ Player ${playerId} not found in room ${roomCode}`);
        return;
      }

      const kickedPlayer = room.players[playerIdx];
      console.log(`零件 👢 Kicking player [${kickedPlayer.name}] from room [${roomCode}]`);

      // 🛠️ REVISI BACKEND: JANGAN masukkan nama siswa ke room.kickedStudents agar tidak di-blacklist permanen
      /* if (!room.kickedStudents.includes(kickedPlayer.name)) {
        room.kickedStudents.push(kickedPlayer.name);
      }
      */

      // Hapus dari real-time RAM lobi peserta
      room.players.splice(playerIdx, 1);

      // Paksa socket siswa keluar dari room channel Socket.io
      const kickedSocket = io.sockets.sockets.get(playerId);
      if (kickedSocket) {
        kickedSocket.leave(roomCode);
        console.log(`🚪 Socket ${playerId} left room ${roomCode}`);
      }

      // Beritahu siswa via event channel bahwa dia dikick
      io.to(playerId).emit("playerKicked", "Anda telah dikeluarkan dari sesi oleh guru.");

      // Broadcast update player list terbaru ke guru dan siswa lain yang tersisa
      io.to(roomCode).emit("updatePlayerList", room.players);
      console.log("📡 UPDATE SENT:", room.players.map((p) => p.name));
    });

    // 2. 👤 JOIN LOBBY: Siswa masuk ke ruangan kuis
    socket.on("joinLobby", ({ code, playerName, userId }: { code: string; playerName: string; userId?: string | null }) => {
      const roomCode = code?.toUpperCase().trim();

      console.log("=================================");
      console.log("JOIN LOBBY RECEIVED");
      console.log("ROOM:", roomCode);
      console.log("PLAYER:", playerName);
      console.log("SOCKET:", socket.id);
      console.log("USERID:", userId);
      console.log("=================================");

      if (!roomCode || !playerName) return;

      const room = rooms[roomCode];

      // 🛠️ REVISI BACKEND: MATIKAN PROTECTION CHECK KICKED STUDENTS AGAR BISA RE-JOIN KEMBALI
      /*
      if (room?.kickedStudents.includes(playerName)) {
        socket.emit("roomError", "Anda telah dikeluarkan dari sesi.");
        return;
      }
      */

      if (!room || !room.hostSocketId) {
        console.log(`❌ JoinLobby rejected: Room [${roomCode}] does not exist.`);
        socket.emit("roomError", "Kode kuis tidak aktif atau tidak ditemukan.");
        return;
      }

      socket.join(roomCode);
      const isExist = room.players.find((p) => p.id === socket.id || p.name === playerName);

      if (!isExist) {
        if (room.status === "playing" && room.allowLateJoin) {
          socket.emit("gameStarted", roomCode);
        } else if (room.status === "playing" && !room.allowLateJoin) {
          io.to(room.hostSocketId!).emit("pendingStudents", room.pendingStudents);
          console.log(`⏳ ${playerName} waiting approval`);
          return;
        }

        room.players.push({
          id: socket.id,
          name: playerName,
          score: 0,
          isOnline: true,
          userId: userId || null,
        });
      } else {
        isExist.id = socket.id;
        isExist.isOnline = true;
        if (userId) isExist.userId = userId;

        // Reset score and progress to 0 if the lobby is in "waiting" state (starting a new game session)
        if (room.status === "waiting") {
          isExist.score = 0;
          isExist.accuracy = 100;
          isExist.progress = "";
        }

        const timerKey = `${roomCode}_${playerName}`;
        if (reconnectTimers[timerKey]) {
          clearTimeout(reconnectTimers[timerKey]);
          delete reconnectTimers[timerKey];
          console.log(`🔄 Reconnection timer cleared for ${playerName} during joinLobby`);
        }
      }

      console.log(`👤 Player [${playerName}] joined Room: ${roomCode} [${room.status}]`);

      socket.emit("lobbyInfo", {
        status: room.status,
        players: room.players,
        gameId: roomCode,
      });

      io.to(roomCode).emit("updatePlayerList", room.players);

      if (room.status === "playing") {
        if (room.allowLateJoin) {
          socket.emit("gameStarted", roomCode);
        } else {
          room.pendingStudents.push({ id: socket.id, name: playerName, userId: userId || null });
          io.to(room.hostSocketId!).emit("pendingStudent", { id: socket.id, name: playerName, userId: userId || null });
          socket.emit("waitingApproval");
        }
      }
    });

    socket.on("approveStudent", (data: { roomCode: string; studentId: string }) => {
      const { roomCode, studentId } = data;
      const room = rooms[roomCode];
      if (!room) return;

      const student = room.pendingStudents?.find((s) => s.id === studentId);
      if (!student) return;

      room.players.push({ id: student.id, name: student.name, score: 0, isOnline: true, userId: student.userId || null });
      room.pendingStudents = room.pendingStudents.filter((s) => s.id !== studentId);

      io.to(room.hostSocketId!).emit("pendingStudents", room.pendingStudents);
      io.to(roomCode).emit("updatePlayerList", room.players);
      io.to(studentId).emit("joinApproved", roomCode);
    });

    socket.on("rejectStudent", (data: { roomCode: string; studentId: string }) => {
      const { roomCode, studentId } = data;
      const room = rooms[roomCode];
      if (!room) return;

      room.pendingStudents = room.pendingStudents.filter((s) => s.id !== studentId);
      io.to(room.hostSocketId!).emit("pendingStudents", room.pendingStudents);
      io.to(studentId).emit("joinRejected");
    });

    // 2b. 👤 JOIN GAME (Play Area)
    socket.on("joinGame", (data: any) => {
      let roomCode = "";
      let playerName = "";
      let userId = "";

      if (typeof data === "string") {
        roomCode = data.toUpperCase().trim();
      } else if (data && typeof data === "object") {
        roomCode = data.code?.toUpperCase().trim();
        playerName = data.playerName;
        userId = data.userId;
      }

      if (!roomCode) return;
      socket.join(roomCode);
      console.log(`👤 Player socket [${socket.id}] joined play room [${roomCode}]`);

      if (playerName) {
        if (!rooms[roomCode]) {
          rooms[roomCode] = {
            status: "playing",
            players: [],
            allowLateJoin: true,
            pendingStudents: [],
            kickedStudents: [],
          };
        }
        const room = rooms[roomCode];
        if (room) {
          const existingPlayer = room.players.find((p) => p.name === playerName);

          if (existingPlayer) {
            existingPlayer.id = socket.id;
            existingPlayer.isOnline = true;
            if (userId) existingPlayer.userId = userId;
            console.log(`🔄 Re-associated Player [${playerName}] to new socket [${socket.id}]`);
            const timerKey = `${roomCode}_${playerName}`;
            if (reconnectTimers[timerKey]) {
              clearTimeout(reconnectTimers[timerKey]);
              delete reconnectTimers[timerKey];
            }
          } else {
            room.players.push({ id: socket.id, name: playerName, score: 0, isOnline: true, userId: userId || null });
            console.log(`👤 Player [${playerName}] added during joinGame`);
          }
          io.to(roomCode).emit("updatePlayerList", room.players);
        }
      }
    });

    // 3. 📈 UPDATE SCORE
    socket.on("updateScore", ({ code, score, accuracy, progress }) => {
      const roomCode = code?.toUpperCase().trim();
      const room = rooms[roomCode];

      if (room) {
        const playerIndex = room.players.findIndex((p) => p.id === socket.id);
        if (playerIndex !== -1) {
          room.players[playerIndex].score = score;
          if (accuracy !== undefined) room.players[playerIndex].accuracy = accuracy;
          if (progress !== undefined) room.players[playerIndex].progress = progress;
          
          console.log(`📈 [${roomCode}] ${room.players[playerIndex].name}: ${score} pts`);
          io.to(roomCode).emit("updatePlayerList", room.players);
        }
      }
    });

    // 4. 🚀 START GAME
    socket.on("startGame", async (code: string) => {
      const roomCode = code?.toUpperCase().trim();
      const room = rooms[roomCode];
      if (!room) return;

      if (room.hostSocketId !== socket.id) return;

      room.status = "playing";
      room.startedAt = Date.now();
      console.log(`🚀 START SIGNAL: Room ${roomCode} is now playing.`);

      // Clear the Redis leaderboard for this game session on game start to ensure clean leaderboard
      try {
        const { prisma } = require("./config/database");
        const { redis } = require("./config/redis");
        const game = await prisma.game.findFirst({
          where: { shareCode: roomCode },
          select: { id: true }
        });
        if (game) {
          await redis.del(`leaderboard:${game.id}`);
          console.log(`🗑️ Resetting Redis leaderboard for game ${game.id} on startGame`);
        }
      } catch (err) {
        console.error("❌ Failed to clear Redis leaderboard on startGame:", err);
      }

      io.to(roomCode).emit("gameStarted", roomCode);
    });

    // 5. 🏁 FINISH GAME
    socket.on("finishGame", async (code: string) => {
      const roomCode = code?.toUpperCase().trim();
      const room = rooms[roomCode];

      if (room) {
        if (room.hostSocketId !== socket.id) return;

        const elapsed = room.startedAt ? Math.round((Date.now() - room.startedAt) / 1000) : 60;
        const finalPlayers = room.players.map((p) => ({
          ...p,
          timeSpent: p.timeSpent || elapsed || 60,
        }));
        console.log(`🏁 FINISH SIGNAL: Saving results for ${roomCode}`);

        try {
          const { saveLeaderboard } = require("./modules/game/game.service");
          await saveLeaderboard(roomCode, finalPlayers);
        } catch (error) {
          console.error("❌ Gagal memanggil saveLeaderboard:", error);
        }

        io.to(roomCode).emit("gameFinished", finalPlayers);
        delete rooms[roomCode];
        console.log(`🗑️ Room ${roomCode} cleared from memory.`);
      }
    });

    // 5b. 🚪 HOST LEAVE: Guru keluar dari ruangan / kembali ke dashboard
    socket.on("hostLeave", (code: string) => {
      const roomCode = code?.toUpperCase().trim();
      const room = rooms[roomCode];
      if (room && room.hostSocketId === socket.id) {
        io.to(roomCode).emit("hostDisconnected");
        delete rooms[roomCode];
        console.log(`🗑️ Room ${roomCode} deleted because host left lobby.`);
      }
    });

    // 6. 🔌 DISCONNECT
    socket.on("disconnect", () => {
      Object.keys(rooms).forEach((roomCode) => {
        const room = rooms[roomCode];
        if (room) {
          if (room.hostSocketId === socket.id) {
            console.log(`👨‍🏫 Host disconnected from room [${roomCode}].`);
            io.to(roomCode).emit("hostDisconnected");
            
            try {
              const { saveLeaderboard } = require("./modules/game/game.service");
              const elapsed = room.startedAt ? Math.round((Date.now() - room.startedAt) / 1000) : 60;
              const finalPlayers = room.players.map((p: any) => ({
                ...p,
                timeSpent: p.timeSpent || elapsed || 60,
              }));
              saveLeaderboard(roomCode, finalPlayers).catch((err: any) => {
                console.error(`❌ Gagal menutup sesi DB otomatis pada host disconnect:`, err);
              });
            } catch (importErr) {
              console.error(`❌ Gagal memanggil saveLeaderboard pada host disconnect:`, importErr);
            }

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

            if (player.id === socket.id) {
              player.isOnline = false;
              io.to(roomCode).emit("updatePlayerList", room.players);
              // 🛠️ REVISI: Tetap simpan data pemain di memori agar nilai/nama yang lama join tidak hilang
              console.log(`👋 ${playerName} disconnected, marked offline.`);
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