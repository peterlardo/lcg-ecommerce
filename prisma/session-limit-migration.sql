-- Nombre de connexions simultanées autorisées par compte (défaut : 1 seule session).
-- Migration additive : à appliquer à la main sur Neon (ne PAS utiliser `prisma migrate diff`).
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "sessionLimit" INTEGER NOT NULL DEFAULT 1;
