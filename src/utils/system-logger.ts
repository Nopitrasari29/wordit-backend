import { prisma } from "../config/database";

export const createSystemLog = async ({
  action,
  details,
  userId,
  userName,
}: {
  action: string;
  details?: string;
  userId?: string;
  userName?: string;
}) => {
  try {
    console.log("🔥 CREATE SYSTEM LOG:", action);

    await prisma.systemLog.create({
      data: {
        action,
        details,
        userId,
        userName,
      },
    });

    console.log("✅ SYSTEM LOG CREATED");
  } catch (error) {
    console.error("❌ Failed create system log:", error);
  }
};