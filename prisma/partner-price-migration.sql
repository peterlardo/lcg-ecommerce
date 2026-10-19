-- Tarif préférentiel par produit (réintroduction de la grille de prix partenaire)
-- Migration additive et idempotente. À appliquer sur Neon.

CREATE TABLE IF NOT EXISTS "PartnerPrice" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerPrice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PartnerPrice_partnerId_variantId_key"
    ON "PartnerPrice"("partnerId", "variantId");

CREATE INDEX IF NOT EXISTS "PartnerPrice_partnerId_idx"
    ON "PartnerPrice"("partnerId");

CREATE INDEX IF NOT EXISTS "PartnerPrice_variantId_idx"
    ON "PartnerPrice"("variantId");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'PartnerPrice_partnerId_fkey'
    ) THEN
        ALTER TABLE "PartnerPrice"
            ADD CONSTRAINT "PartnerPrice_partnerId_fkey"
            FOREIGN KEY ("partnerId") REFERENCES "Partner"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'PartnerPrice_variantId_fkey'
    ) THEN
        ALTER TABLE "PartnerPrice"
            ADD CONSTRAINT "PartnerPrice_variantId_fkey"
            FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
