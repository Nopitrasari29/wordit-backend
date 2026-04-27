import Redis from "ioredis";
import { env } from "./env"; // 👈 Ambil dari env.ts

export const redis = new Redis({
  host: env.redisHost, // 👈 Pakai env.redisHost
  port: 6379,
});

redis.on("connect", () => console.log("✅ Redis connected successfully"));
redis.on("error", (err) => console.error("❌ Redis error:", err));