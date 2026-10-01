-- === MIGRATION : PRÉ-COMMANDES COMME UN SERVICE DE LIVRAISON (mode, zone, frais, créneau) ===
-- Ajout de colonnes uniquement : aucune donnée existante n'est modifiée ni supprimée.
-- Les pré-commandes existantes passent en mode DELIVERY, sans zone, frais 0, créneau vide.
-- À appliquer AVANT de déployer le code qui lit ces colonnes.

ALTER TABLE "Reservation"
  ADD COLUMN IF NOT EXISTS "deliveryMode" TEXT NOT NULL DEFAULT 'DELIVERY',
  ADD COLUMN IF NOT EXISTS "zoneId" TEXT,
  ADD COLUMN IF NOT EXISTS "deliveryFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "slot" TEXT NOT NULL DEFAULT '';

DO $$ BEGIN
  ALTER TABLE "Reservation"
    ADD CONSTRAINT "Reservation_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "DeliveryZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
