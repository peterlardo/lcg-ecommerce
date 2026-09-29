-- ============================================================================
-- Stock journalier par vendeur + tracabilite des mouvements par utilisateur
-- Sessions de caisse propres a chaque vendeur (le stock reste un pool commun
-- par point de vente : PointOfSaleStock n'est pas modifie)
-- ============================================================================

-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN     "userId" TEXT;

-- CreateTable
CREATE TABLE "SellerDailyStock" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "variantId" TEXT NOT NULL,
    "openingQty" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'AUTO',
    "allocatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SellerDailyStock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SellerDailyStock_userId_date_idx" ON "SellerDailyStock"("userId", "date");

-- CreateIndex
CREATE INDEX "SellerDailyStock_date_idx" ON "SellerDailyStock"("date");

-- CreateIndex
CREATE UNIQUE INDEX "SellerDailyStock_userId_date_variantId_key" ON "SellerDailyStock"("userId", "date", "variantId");

-- CreateIndex
CREATE INDEX "CashSession_openedById_status_idx" ON "CashSession"("openedById", "status");

-- CreateIndex
CREATE INDEX "StockMovement_userId_createdAt_idx" ON "StockMovement"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerDailyStock" ADD CONSTRAINT "SellerDailyStock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerDailyStock" ADD CONSTRAINT "SellerDailyStock_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SellerDailyStock" ADD CONSTRAINT "SellerDailyStock_allocatedById_fkey" FOREIGN KEY ("allocatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashSession" ADD CONSTRAINT "CashSession_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Retroactif : rattacher les mouvements de vente a leur vendeur.
-- reference = numero de commande pour les mouvements SALE / CANCEL_RESTOCK.
UPDATE "StockMovement" m
SET "userId" = o."userId"
FROM "Order" o
WHERE m."reference" = o."orderNumber"
  AND m."userId" IS NULL
  AND m."type" IN ('SALE', 'CANCEL_RESTOCK')
  AND o."userId" IS NOT NULL;
