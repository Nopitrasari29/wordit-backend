import "dotenv/config"

export const env = {
  port: process.env.PORT || "3000",
  nodeEnv: process.env.NODE_ENV || "development",
  jwtSecret: process.env.JWT_SECRET!,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "24h",
  groqApiKey: process.env.GROQ_API_KEY || "",
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  
  // 🚀 TAMBAHKAN INI (Satu Pintu)
  databaseUrl: process.env.DATABASE_URL!,
  redisHost: process.env.REDIS_HOST || "localhost",
  smtpHost: process.env.SMTP_HOST || "",
  smtpPort: parseInt(process.env.SMTP_PORT || "587", 10),
  smtpUser: process.env.SMTP_USER || "",
  smtpPass: process.env.SMTP_PASS || "",
  smtpSecure: process.env.SMTP_SECURE === "true",
  smtpFrom: process.env.SMTP_FROM || '"WordIT" <noreply@wordit.local>',
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
}

// Validasi env wajib
const required = ["JWT_SECRET", "DATABASE_URL"]
for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`🔥 Missing required environment variable: ${key}`)
  }
}