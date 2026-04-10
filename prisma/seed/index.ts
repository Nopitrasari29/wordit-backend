import { prisma } from "../../src/config/database"
import { seedUsers } from "./users.seed"
import { seedGames } from "./games.seed"

const main = async () => {
  console.log("🚀 Starting seed...")
  console.log("─────────────────────────────────")

  // Seed users
  const users = await seedUsers()

  // Ambil creator IDs (index 1 = Bu Sari, index 2 = Pak Budi)
  const creators = users.filter(u => u.role === "CREATOR")
  const creatorIds = creators.map(u => u.id)

  console.log("─────────────────────────────────")

  // Seed games
  await seedGames(creatorIds)

  console.log("─────────────────────────────────")
  console.log("✅ Seed completed!")
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })