/*
  Warnings:

  - Changed the type of `type` on the `WalletTransaction` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "public"."TransactionType" AS ENUM ('CREDIT', 'DEBIT', 'REWARD');

-- AlterTable
ALTER TABLE "public"."WalletTransaction" DROP COLUMN "type",
ADD COLUMN     "type" "public"."TransactionType" NOT NULL;
