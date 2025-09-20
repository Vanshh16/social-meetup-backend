/*
  Warnings:

  - You are about to drop the column `location` on the `Meetup` table. All the data in the column will be lost.
  - Added the required column `latitude` to the `Meetup` table without a default value. This is not possible if the table is not empty.
  - Added the required column `longitude` to the `Meetup` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."Meetup" DROP COLUMN "location",
ADD COLUMN     "latitude" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "locationName" TEXT,
ADD COLUMN     "longitude" DOUBLE PRECISION NOT NULL;
