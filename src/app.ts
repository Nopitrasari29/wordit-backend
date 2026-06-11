import express from "express";
import cors from "cors";
import path from "path";
import { errorResponse } from "./utils/response";

import authRoute from "./modules/auth/auth.route";
import userRoute from "./modules/user/user.route";
import gameRoute from "./modules/game/game.route";
import aiRoute from "./modules/ai/ai.route";
import analyticsRoute from "./modules/analytics/analytics.route"; // ✅ 1. IMPORT ROUTE ANALYTICS

const app = express();

// ─── MIDDLEWARE UTAMA ───────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true,
  methods: ["GET", "POST", "PATCH", "DELETE", "PUT"]
}));

// Skip JSON and URL-encoded body parsing for LTI routes to prevent stream conflicts in ltijs
app.use((req, res, next) => {
  if (req.path.startsWith("/lti")) {
    return next();
  }
  express.json()(req, res, next);
});

app.use((req, res, next) => {
  if (req.path.startsWith("/lti")) {
    return next();
  }
  express.urlencoded({ extended: true })(req, res, next);
});


// ─── GLOBAL REQUEST LOGGER ──────────────────────────────────────────
app.use((req, res, next) => {
  const time = new Date().toLocaleTimeString();
  console.log(`📡 [${time}] ${req.method} ${req.originalUrl}`);

  if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
    console.log("📦 Body:", JSON.stringify(req.body, null, 2));
  }
  next();
});

// ─── STATIC FILES ───────────────────────────────────────────────────
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

import { ltiProvider } from "./config/lti"; // ✅ IMPORT LTI PROVIDER

import { rateLimit } from "express-rate-limit";

// Rate limiter untuk mencegah brute-force serangan pada auth
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 100, // Limit 100 requests per IP
  message: {
    status: "error",
    message: "Terlalu banyak percobaan masuk dari IP ini. Silakan coba lagi beberapa saat lagi."
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter untuk mencegah eksploitasi kuota token AI
const aiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 menit
  max: 10, // Limit 10 requests per IP per menit
  message: {
    status: "error",
    message: "Aktivitas AI Anda terlalu padat. Silakan tunggu satu menit."
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── REGISTER ROUTES ────────────────────────────────────────────────
app.use("/api/auth", authLimiter, authRoute);
app.use("/api/users", userRoute);
app.use("/api/games", gameRoute);
app.use("/api/ai", aiLimiter, aiRoute);
app.use("/api/analytics", analyticsRoute); // ✅ 2. DAFTARKAN ROUTE ANALYTICS DI SINI

// ─── LTI ROUTER ─────────────────────────────────────────────────────
// Menyambungkan rute bawaan ltijs (/lti/launch, /lti/login, dll)
app.use("/lti", ltiProvider.app);

// Health Check Route
app.get("/", (req, res) => {
  res.json({ status: "ok", message: "WordIT API is running! 🚀" });
});

// ─── ERROR HANDLING ─────────────────────────────────────────────────

// 404 Handler
app.use((req, res) => {
  console.warn(`⚠️  404 - Not Found: ${req.method} ${req.originalUrl}`);
  res.status(404).json(errorResponse("Route not found"));
});

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("🔥 Server Error Detail:");
  console.error(err.stack || err.message);
  res.status(500).json(errorResponse(err.message || "Internal Server Error"));
});

export default app;