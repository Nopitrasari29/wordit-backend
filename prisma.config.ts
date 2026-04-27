// wordit-backend/prisma.config.ts
import { defineConfig } from "prisma/config"
import "dotenv/config"

export default defineConfig({
  datasource: {
    // 🎯 Mengambil URL dari .env (port 5434)
    url: process.env.DATABASE_URL!, 
  },
  migrations: {
    // Menjalankan seeder kuis otomatis saat migrasi
    seed: "bun ./prisma/seed/index.ts",
  },
})