/*
  Warnings:

  - You are about to drop the column `price` on the `Category` table. All the data in the column will be lost.
  - Made the column `subcategory` on table `Meetup` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Category" DROP COLUMN "price";

-- AlterTable
ALTER TABLE "Meetup" ALTER COLUMN "subcategory" SET NOT NULL;

-- AlterTable
ALTER TABLE "SubCategory" ADD COLUMN     "price" DOUBLE PRECISION NOT NULL DEFAULT 0.0;
