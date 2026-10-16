-- Règlements des factures : chèque, banque émettrice, justificatifs (preuve de virement, scan du chèque).
-- Uniquement des AJOUTS : aucune ligne existante n'est modifiée ni supprimée.
-- Rejouable sans erreur (IF NOT EXISTS partout). À appliquer AVANT de mettre en ligne le code qui s'en sert.
-- Chaque instruction s'exécute seule (pas de bloc BEGIN/COMMIT).

-- Chèque parmi les moyens de règlement
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'CHEQUE';

-- Banque émettrice d'un chèque
ALTER TABLE "CustomerPayment" ADD COLUMN IF NOT EXISTS "bank" TEXT;

-- Justificatifs d'un règlement, gardés en base
CREATE TABLE IF NOT EXISTS "PaymentProof" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PaymentProof_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PaymentProof_paymentId_idx" ON "PaymentProof"("paymentId");
DO $$ BEGIN
  ALTER TABLE "PaymentProof" ADD CONSTRAINT "PaymentProof_paymentId_fkey"
    FOREIGN KEY ("paymentId") REFERENCES "CustomerPayment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
