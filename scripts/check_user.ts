import { prisma } from "../src/config/database";

async function main() {
  const email = "anovitriasari05@gmail.com";
  console.log("Checking email:", email);
  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
  });
  console.log("User found:", user);

  const allUsers = await prisma.user.findMany({
    select: { email: true, name: true, role: true },
    take: 10,
  });
  console.log("First 10 users in DB:", allUsers);
}

main()
  .catch((err) => console.error("Error:", err))
  .finally(() => prisma.$disconnect());
