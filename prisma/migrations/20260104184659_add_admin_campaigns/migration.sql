/*
  Warnings:

  - The values [CANCELLED] on the enum `CampaignStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `failureCount` on the `AdminNotification` table. All the data in the column will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "CampaignStatus_new" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');
ALTER TABLE "public"."AdminNotification" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "AdminNotification" ALTER COLUMN "status" TYPE "CampaignStatus_new" USING ("status"::text::"CampaignStatus_new");
ALTER TYPE "CampaignStatus" RENAME TO "CampaignStatus_old";
ALTER TYPE "CampaignStatus_new" RENAME TO "CampaignStatus";
DROP TYPE "public"."CampaignStatus_old";
ALTER TABLE "AdminNotification" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- AlterTable
ALTER TABLE "AdminNotification" DROP COLUMN "failureCount";
