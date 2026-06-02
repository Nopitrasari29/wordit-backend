-- DropForeignKey
ALTER TABLE "game_sessions" DROP CONSTRAINT "game_sessions_userId_fkey";

-- AlterTable
ALTER TABLE "game_sessions" ADD COLUMN     "playerName" TEXT NOT NULL DEFAULT 'Guest',
ALTER COLUMN "userId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "isVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "verificationToken" TEXT,
ADD COLUMN     "verificationTokenExpires" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
