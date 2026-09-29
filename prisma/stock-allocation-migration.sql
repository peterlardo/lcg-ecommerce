-- Migration stock allocation physique : Production -> Point de vente -> Vendeur
-- Generee avec : prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script
-- Toutes les colonnes ajoutees sont nullable ou portent une valeur par defaut :
-- la migration ne casse aucune donnee existante.

-- AlterTable
ALTER TABLE "CashSession" ADD COLUMN     "reportGeneratedAt" TIMESTAMP(3),
ADD COLUMN     "reportReference" TEXT;

-- AlterTable
ALTER TABLE "SellerDailyStock" ADD COLUMN     "lotId" TEXT,
ADD COLUMN     "pointOfSaleId" TEXT,
ADD COLUMN     "returnedAt" TIMESTAMP(3),
ADD COLUMN     "returnedQty" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "soldQty" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'OPEN',
ALTER COLUMN "source" SET DEFAULT 'MANUAL';

-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN     "sellerDailyStockId" TEXT;

-- CreateIndex
CREATE INDEX "SellerDailyStock_pointOfSaleId_status_idx" ON "SellerDailyStock"("pointOfSaleId", "status");

-- CreateIndex
CREATE INDEX "SellerDailyStock_lotId_idx" ON "SellerDailyStock"("lotId");

-- CreateIndex
CREATE INDEX "StockMovement_sellerDailyStockId_idx" ON "StockMovement"("sellerDailyStockId");

-- CreateIndex
CREATE INDEX "StockMovement_type_idx" ON "StockMovement"("type");

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_sellerDailyStockId_fkey" FOREIGN KEY ("sellerDailyStockId") REFERENCES "SellerDailyStock"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerDailyStock" ADD CONSTRAINT "SellerDailyStock_pointOfSaleId_fkey" FOREIGN KEY ("pointOfSaleId") REFERENCES "PointOfSale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerDailyStock" ADD CONSTRAINT "SellerDailyStock_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "ProductionLot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
