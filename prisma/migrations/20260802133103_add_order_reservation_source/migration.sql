/*
  Warnings:

  - You are about to drop the column `managedPointOfSales` on the `User` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Order_pointOfSaleId_idx";

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'WEB';

-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "itemsJson" TEXT NOT NULL DEFAULT '[]',
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'WEB';

-- AlterTable
ALTER TABLE "User" DROP COLUMN "managedPointOfSales";
