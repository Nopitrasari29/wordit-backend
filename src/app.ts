import express from "express"
import cors from "cors"
import path from "path"
import { errorResponse } from "./utils/response"
import authRoute from "./modules/auth/auth.route"
import userRoute from "./modules/user/user.route"
import gameRoute from "./modules/game/game.route"
import aiRoute from "./modules/ai/ai.route" // ✅ Tambahkan import ini

const app = express()

app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Serve static files (Agar foto profil/thumbnail bisa diakses via URL)
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")))

// Routes Mapping
app.use("/api/auth", authRoute)
app.use("/api/users", userRoute)
app.use("/api/games", gameRoute)
app.use("/api/ai", aiRoute) // ✅ Daftarkan rute AI di sini

// Health check endpoint
app.get("/", (req, res) => {
  res.json({ status: "ok", message: "WordIT API is running!" })
})

// 404 handler (Jika user akses route yang tidak terdaftar)
app.use((req, res) => {
  res.status(404).json(errorResponse("Route not found"))
})

// Error handler global (Opsional, tapi bagus untuk menangkap error server)
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("🔥 Server Error:", err.message)
  res.status(500).json(errorResponse("Internal Server Error"))
})

export default app