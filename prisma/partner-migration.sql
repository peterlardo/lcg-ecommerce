-- Module Partenaire (prix négociés par format) — appliqué à la main sur Neon (2026-10-17)
-- NE PAS utiliser `prisma migrate diff` complet (il DROP SellerDailyStock et les tables _backup_*).

CREATE TABLE "Partner" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "companyName" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "address" TEXT,
  "notes" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Partner_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PartnerPrice" (
  "id" TEXT NOT NULL,
  "partnerId" TEXT NOT NULL,
  "variantId" TEXT NOT NULL,
  "price" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PartnerPrice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PartnerPrice_partnerId_variantId_key" ON "PartnerPrice"("partnerId","variantId");
CREATE INDEX "PartnerPrice_partnerId_idx" ON "PartnerPrice"("partnerId");
CREATE INDEX "PartnerPrice_variantId_idx" ON "PartnerPrice"("variantId");
CREATE INDEX "Partner_isActive_idx" ON "Partner"("isActive");
CREATE INDEX "Partner_name_idx" ON "Partner"("name");

ALTER TABLE "PartnerPrice" ADD CONSTRAINT "PartnerPrice_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PartnerPrice" ADD CONSTRAINT "PartnerPrice_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Order" ADD COLUMN "partnerId" TEXT;
CREATE INDEX "Order_partnerId_idx" ON "Order"("partnerId");
ALTER TABLE "Order" ADD CONSTRAINT "Order_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;
