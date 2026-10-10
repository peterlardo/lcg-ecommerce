-- === MIGRATION : ENVOI D'UNE COMMANDE À UNE CAISSIÈRE ===
-- Ajoute Order.cashierId (caissière ciblée par l'opérateur d'accueil) + sentToCashierAt,
-- l'index et la clé étrangère vers User.
-- Ne casse aucune donnée : les commandes existantes restent avec cashierId NULL.
-- Après application : npx prisma generate puis REDÉMARRER le dev server.

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "cashierId" TEXT,
ADD COLUMN     "sentToCashierAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Order_cashierId_idx" ON "Order"("cashierId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_cashierId_fkey" FOREIGN KEY ("cashierId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
