import { prisma } from "../../src/config/database";
import { seedUsers } from "./users.seed";
import { seedGames } from "./games.seed";

const main = async () => {
  console.log("🚀 Starting seed...");
  console.log("─────────────────────────────────");

  // 1. Seed Users
  await seedUsers();

  console.log("─────────────────────────────────");

  // 2. Seed Games (Nggak perlu overing parameter array lagi!)
  await seedGames();

  console.log("─────────────────────────────────");
  console.log("✅ Seed completed successfully!");
};

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });