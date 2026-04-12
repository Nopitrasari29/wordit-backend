import express from "express"
import cors from "cors"
import path from "path"
import { errorResponse } from "./utils/response"
import authRoute from "./modules/auth/auth.route"
import userRoute from "./modules/user/user.route"
import gameRoute from "./modules/game/game.route"

const app = express()

app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Serve static files
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")))

// Routes
app.use("/api/auth", authRoute)
app.use("/api/users", userRoute)
app.use("/api/games", gameRoute)

// Health check
app.get("/", (req, res) => {
  res.json({ status: "ok", message: "WordIT API is running!" })
})

// 404 handler
app.use((req, res) => {
  res.status(404).json(errorResponse("Route not found"))
})

export default app