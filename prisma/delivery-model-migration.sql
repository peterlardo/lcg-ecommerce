-- === MIGRATION : MODÈLE DE LIVRAISON (zones, livreurs maison/partenaire, mode + frais) ===
-- Généré avec : npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script
-- Ne casse aucune donnée : 24 livraisons existantes, 0 assignation (deliveryAgentId NULL partout).
-- Seeding des zones de livraison (baseFee = tarif par défaut si aucun tarif livreur/zone renseigné).
-- Après application : npx prisma generate puis REDÉMARRER le dev server.

-- CreateEnum
CREATE TYPE "DeliveryMode" AS ENUM ('DELIVERY', 'PICKUP');

-- DropForeignKey
ALTER TABLE "Delivery" DROP CONSTRAINT "Delivery_deliveryAgentId_fkey";

-- AlterTable
ALTER TABLE "Delivery" DROP COLUMN "deliveryAgentId",
ADD COLUMN     "agentId" TEXT,
ADD COLUMN     "assignedAt" TIMESTAMP(3),
ADD COLUMN     "failedReason" TEXT,
ADD COLUMN     "fee" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "mode" "DeliveryMode" NOT NULL DEFAULT 'DELIVERY',
ADD COLUMN     "zoneId" TEXT;

-- CreateTable
CREATE TABLE "DeliveryZone" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "baseFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryZone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryAgent" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'MAISON',
    "userId" TEXT,
    "companyName" TEXT,
    "phone" TEXT,
    "vehicle" TEXT,
    "plateNumber" TEXT,
    "zonesLabel" TEXT,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryAgent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryAgentFee" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "fee" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "DeliveryAgentFee_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryZone_name_key" ON "DeliveryZone"("name");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryAgent_userId_key" ON "DeliveryAgent"("userId");

-- CreateIndex
CREATE INDEX "DeliveryAgent_kind_isActive_idx" ON "DeliveryAgent"("kind", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryAgentFee_agentId_zoneId_key" ON "DeliveryAgentFee"("agentId", "zoneId");

-- CreateIndex
CREATE INDEX "Delivery_status_idx" ON "Delivery"("status");

-- CreateIndex
CREATE INDEX "Delivery_agentId_status_idx" ON "Delivery"("agentId", "status");

-- CreateIndex
CREATE INDEX "Delivery_scheduledDate_idx" ON "Delivery"("scheduledDate");

-- CreateIndex
CREATE INDEX "Delivery_deliveredAt_idx" ON "Delivery"("deliveredAt");

-- CreateIndex
CREATE INDEX "Delivery_mode_idx" ON "Delivery"("mode");

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "DeliveryAgent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "DeliveryZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryAgent" ADD CONSTRAINT "DeliveryAgent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryAgentFee" ADD CONSTRAINT "DeliveryAgentFee_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "DeliveryAgent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryAgentFee" ADD CONSTRAINT "DeliveryAgentFee_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "DeliveryZone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- === Seed zones de livraison (tarifs de base, modifiables dans /admin/livraisons) ===
INSERT INTO "DeliveryZone" ("id", "name", "baseFee", "sortOrder", "updatedAt") VALUES
  (md5(random()::text || clock_timestamp()::text), 'Ouenzé', 1000, 1, CURRENT_TIMESTAMP),
  (md5(random()::text || clock_timestamp()::text), 'Talangaï', 1500, 2, CURRENT_TIMESTAMP),
  (md5(random()::text || clock_timestamp()::text), 'Poto-Poto', 1500, 3, CURRENT_TIMESTAMP),
  (md5(random()::text || clock_timestamp()::text), 'Moungali', 1500, 4, CURRENT_TIMESTAMP),
  (md5(random()::text || clock_timestamp()::text), 'Centre-ville / Plateau', 2000, 5, CURRENT_TIMESTAMP),
  (md5(random()::text || clock_timestamp()::text), 'Bacongo', 2000, 6, CURRENT_TIMESTAMP),
  (md5(random()::text || clock_timestamp()::text), 'Makélékélé', 2000, 7, CURRENT_TIMESTAMP),
  (md5(random()::text || clock_timestamp()::text), 'Mfilou / Djiri', 2500, 8, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;
