-- === MIGRATION : ACCEPTATION DES LIVRAISONS PAR LE LIVREUR ===
-- Ajout d'une colonne nullable : aucune donnée existante n'est modifiée.
-- À appliquer AVANT de déployer le code qui lit cette colonne.
ALTER TABLE "Delivery" ADD COLUMN IF NOT EXISTS "acceptedAt" TIMESTAMP(3);
