import { defineConfig } from "prisma/config"
import "dotenv/config"

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL!,
  },
  migrations: {
    seed: "bun ./prisma/seed/index.ts",
  },
})