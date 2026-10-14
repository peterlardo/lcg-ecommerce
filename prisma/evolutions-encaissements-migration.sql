-- Évolutions du module commercial (encaissements, avoirs, envoi par e-mail, réglages en base).
-- Uniquement des AJOUTS : aucune ligne existante n'est modifiée ni supprimée.
-- Rejouable sans erreur (IF NOT EXISTS partout). À appliquer AVANT de mettre en ligne le code qui s'en sert.
-- Chaque instruction s'exécute seule (pas de bloc BEGIN/COMMIT) : une valeur ajoutée à un type énuméré
-- n'est utilisable qu'une fois l'instruction validée.

-- Virement bancaire parmi les moyens de règlement
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'BANK_TRANSFER';

-- Avoir : document qui annule tout ou partie d'une facture
ALTER TYPE "B2bDocumentType" ADD VALUE IF NOT EXISTS 'AVOIR';

-- Règlement saisi par erreur : refusé par la caisse ou l'administrateur (il ne compte plus)
ALTER TYPE "PaymentValidationStatus" ADD VALUE IF NOT EXISTS 'REJECTED';

-- Règlements : référence de la transaction, auteur de la saisie, date de validation, motif du refus
ALTER TABLE "CustomerPayment" ADD COLUMN IF NOT EXISTS "reference" TEXT;
ALTER TABLE "CustomerPayment" ADD COLUMN IF NOT EXISTS "receivedById" TEXT;
ALTER TABLE "CustomerPayment" ADD COLUMN IF NOT EXISTS "validatedAt" TIMESTAMP(3);
ALTER TABLE "CustomerPayment" ADD COLUMN IF NOT EXISTS "rejectReason" TEXT;
CREATE INDEX IF NOT EXISTS "CustomerPayment_createdAt_idx" ON "CustomerPayment"("createdAt");

-- Documents B2B : dernier envoi par e-mail
ALTER TABLE "B2bDocument" ADD COLUMN IF NOT EXISTS "emailedAt" TIMESTAMP(3);
ALTER TABLE "B2bDocument" ADD COLUMN IF NOT EXISTS "emailedTo" TEXT;

-- Réglages de l'écran Paramètres (jusqu'ici écrits dans un fichier que Cloudflare ne conserve pas)
CREATE TABLE IF NOT EXISTS "AppSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);
