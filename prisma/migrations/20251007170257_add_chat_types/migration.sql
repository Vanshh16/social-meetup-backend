/*
  Warnings:

  - A unique constraint covering the columns `[meetupId]` on the table `Chat` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `type` to the `Chat` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."ChatType" AS ENUM ('ONE_ON_ONE', 'GROUP');

-- AlterTable
ALTER TABLE "public"."Chat" ADD COLUMN     "name" TEXT,
ADD COLUMN     "type" "public"."ChatType" NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Chat_meetupId_key" ON "public"."Chat"("meetupId");
