-- Module Partenaire : remise en pourcentage (remplace la grille PartnerPrice).
ALTER TABLE "Partner" ADD COLUMN IF NOT EXISTS "discountPercent" INTEGER NOT NULL DEFAULT 0;
DROP TABLE IF EXISTS "PartnerPrice";