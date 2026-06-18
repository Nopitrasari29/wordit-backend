import { prisma } from "../config/database";

export const createSystemLog = async ({
  action,
  details,
  userId,
  userName,
  userEmail,
}: {
  action: string;
  details?: string;
  userId?: string;
  userName?: string;
  userEmail?: string;
}) => {
  try {
    console.log("🔥 CREATE SYSTEM LOG:", action);

    let resolvedEmail = userEmail;
    if (!resolvedEmail && userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
      });
      if (user) {
        resolvedEmail = user.email;
      }
    }

    await prisma.systemLog.create({
      data: {
        action,
        details,
        userId,
        userName,
        userEmail: resolvedEmail,
      },
    });

    console.log("✅ SYSTEM LOG CREATED");
  } catch (error) {
    console.error("❌ Failed create system log:", error);
  }
};