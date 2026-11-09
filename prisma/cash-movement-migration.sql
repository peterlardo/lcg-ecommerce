-- Mouvements de caisse (encaissements/decaissements manuels) rattaches a une session.
-- Migration additive : appliquer a la main sur Neon (ne PAS utiliser `prisma migrate diff`).
CREATE TABLE IF NOT EXISTS "CashMovement" (
  "id"            TEXT NOT NULL,
  "cashSessionId" TEXT NOT NULL,
  "type"          TEXT NOT NULL,
  "amount"        DOUBLE PRECISION NOT NULL,
  "reason"        TEXT NOT NULL,
  "reference"     TEXT,
  "createdById"   TEXT NOT NULL,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CashMovement_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "CashMovement_cashSessionId_createdAt_idx" ON "CashMovement"("cashSessionId", "createdAt");
CREATE INDEX IF NOT EXISTS "CashMovement_createdById_idx" ON "CashMovement"("createdById");
DO $$ BEGIN
  ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_cashSessionId_fkey"
    FOREIGN KEY ("cashSessionId") REFERENCES "CashSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
