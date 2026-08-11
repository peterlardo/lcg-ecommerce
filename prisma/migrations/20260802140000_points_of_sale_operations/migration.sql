ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "managedPointOfSales" TEXT;
ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "pointOfSaleId" TEXT;
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "pointOfSaleId" TEXT;
ALTER TABLE "PointOfSale" ADD COLUMN IF NOT EXISTS "managerUserId" TEXT;
CREATE TABLE IF NOT EXISTS "PointOfSaleStock" (
  "id" TEXT NOT NULL, "pointOfSaleId" TEXT NOT NULL, "variantId" TEXT NOT NULL, "quantity" INTEGER NOT NULL DEFAULT 0, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PointOfSaleStock_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PointOfSaleStock_pointOfSaleId_variantId_key" ON "PointOfSaleStock"("pointOfSaleId", "variantId");
CREATE TABLE IF NOT EXISTS "CashSession" (
  "id" TEXT NOT NULL, "pointOfSaleId" TEXT NOT NULL, "openedById" TEXT, "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "closedAt" TIMESTAMP(3), "openingBalance" DOUBLE PRECISION NOT NULL DEFAULT 0, "closingBalance" DOUBLE PRECISION, "status" TEXT NOT NULL DEFAULT 'OPEN',
  CONSTRAINT "CashSession_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "PointOfSaleStock" DROP CONSTRAINT IF EXISTS "PointOfSaleStock_pointOfSaleId_fkey";
ALTER TABLE "PointOfSaleStock" ADD CONSTRAINT "PointOfSaleStock_pointOfSaleId_fkey" FOREIGN KEY ("pointOfSaleId") REFERENCES "PointOfSale"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PointOfSaleStock" DROP CONSTRAINT IF EXISTS "PointOfSaleStock_variantId_fkey";
ALTER TABLE "PointOfSaleStock" ADD CONSTRAINT "PointOfSaleStock_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CashSession" DROP CONSTRAINT IF EXISTS "CashSession_pointOfSaleId_fkey";
ALTER TABLE "CashSession" ADD CONSTRAINT "CashSession_pointOfSaleId_fkey" FOREIGN KEY ("pointOfSaleId") REFERENCES "PointOfSale"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PointOfSale" DROP CONSTRAINT IF EXISTS "PointOfSale_managerUserId_fkey";
ALTER TABLE "PointOfSale" ADD CONSTRAINT "PointOfSale_managerUserId_fkey" FOREIGN KEY ("managerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StockMovement" DROP CONSTRAINT IF EXISTS "StockMovement_pointOfSaleId_fkey";
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_pointOfSaleId_fkey" FOREIGN KEY ("pointOfSaleId") REFERENCES "PointOfSale"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Reservation" DROP CONSTRAINT IF EXISTS "Reservation_pointOfSaleId_fkey";
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_pointOfSaleId_fkey" FOREIGN KEY ("pointOfSaleId") REFERENCES "PointOfSale"("id") ON DELETE SET NULL ON UPDATE CASCADE;
