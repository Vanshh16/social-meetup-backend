/*
  Warnings:

  - A unique constraint covering the columns `[googleId]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `authMethod` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "AuthMethod" AS ENUM ('MOBILE_OTP', 'GOOGLE');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "authMethod" "AuthMethod" NOT NULL,
ADD COLUMN     "googleId" TEXT,
ALTER COLUMN "password" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");
