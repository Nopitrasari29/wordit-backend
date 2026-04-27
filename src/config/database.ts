import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import { env } from "./env" // 👈 Ambil dari env.ts

const pool = new Pool({
  connectionString: env.databaseUrl, // 👈 Pakai env.databaseUrl
})

const adapter = new PrismaPg(pool)

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: ["error", "warn"],
  })

if (env.nodeEnv !== "production") {
  globalForPrisma.prisma = prisma
}