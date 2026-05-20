/*
  Warnings:

  - You are about to drop the column `educationLevel` on the `users` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "games" ADD COLUMN     "chapter" TEXT,
ADD COLUMN     "classGrade" TEXT,
ADD COLUMN     "subject" TEXT,
ADD COLUMN     "topic" TEXT;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "educationLevel",
ADD COLUMN     "educationLevels" "EducationLevel"[];
