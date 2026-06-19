import "dotenv/config";
import { prisma } from "../src/config/database.ts";

async function main() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      approvalStatus: true,
    }
  });
  console.log("TOTAL USERS IN DB:", users.length);
  console.log(JSON.stringify(users, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
