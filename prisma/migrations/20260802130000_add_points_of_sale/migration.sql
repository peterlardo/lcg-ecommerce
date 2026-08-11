CREATE TABLE IF NOT EXISTS "PointOfSale" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "address" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "phone" TEXT,
  "managerName" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PointOfSale_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PointOfSale_code_key" ON "PointOfSale"("code");
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "pointOfSaleId" TEXT;
ALTER TABLE "Order" DROP CONSTRAINT IF EXISTS "Order_pointOfSaleId_fkey";
ALTER TABLE "Order" ADD CONSTRAINT "Order_pointOfSaleId_fkey" FOREIGN KEY ("pointOfSaleId") REFERENCES "PointOfSale"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "Order_pointOfSaleId_idx" ON "Order"("pointOfSaleId");
