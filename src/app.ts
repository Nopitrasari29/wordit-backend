import express from "express";
import cors from "cors";
import path from "path";
import { errorResponse } from "./utils/response";

import authRoute from "./modules/auth/auth.route";
import userRoute from "./modules/user/user.route";
import gameRoute from "./modules/game/game.route";
import aiRoute from "./modules/ai/ai.route";

const app = express();

// ─── MIDDLEWARE UTAMA ───────────────────────────────────────────────
app.use(cors({ 
  origin: "http://localhost:5173", 
  credentials: true,
  methods: ["GET", "POST", "PATCH", "DELETE", "PUT"] 
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── GLOBAL REQUEST LOGGER (DIREVISI UNTUK DEBUGGING) ────────────────
app.use((req, res, next) => {
  const time = new Date().toLocaleTimeString();
  console.log(`📡 [${time}] ${req.method} ${req.originalUrl}`);
  
  // Jika ada data yang dikirim (POST/PATCH), tampilkan isinya
  if (Object.keys(req.body).length > 0) {
    console.log("📦 Body:", JSON.stringify(req.body, null, 2));
  }
  next();
});

// ─── STATIC FILES ───────────────────────────────────────────────────
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// ─── REGISTER ROUTES ────────────────────────────────────────────────
app.use("/api/auth", authRoute);
app.use("/api/users", userRoute);
app.use("/api/games", gameRoute);
app.use("/api/ai", aiRoute);

// Health Check Route
app.get("/", (req, res) => {
  res.json({ status: "ok", message: "WordIT API is running!" });
});

// ─── ERROR HANDLING ─────────────────────────────────────────────────

// 404 Handler: Jika rute tidak ditemukan
app.use((req, res) => {
  console.warn(`⚠️  404 - Not Found: ${req.method} ${req.originalUrl}`);
  res.status(404).json(errorResponse("Route not found - Periksa prefix /api/games kamu!"));
});

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("🔥 Server Error Detail:");
  console.error(err.stack || err.message); 
  res.status(500).json(errorResponse(err.message || "Internal Server Error"));
});

export default app;