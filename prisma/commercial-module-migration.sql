-- Generated par prisma migrate diff, assaini selon Ruling E (derive pre-existante exclue: SellerDailyStock + _backup_20261001*)

-- CreateEnum
CREATE TYPE "B2bDocumentType" AS ENUM ('DEVIS', 'COMMANDE', 'LIVRAISON', 'FACTURE');

-- CreateEnum
CREATE TYPE "B2bDocumentStatus" AS ENUM ('DRAFT', 'SENT', 'CONFIRMED', 'REJECTED', 'DELIVERED', 'INVOICED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "B2bContractStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PaymentPromiseStatus" AS ENUM ('PENDING', 'KEPT', 'BROKEN');

-- CreateEnum
CREATE TYPE "PaymentValidationStatus" AS ENUM ('PENDING', 'VALIDATED');

-- CreateEnum
CREATE TYPE "PaymentReminderType" AS ENUM ('PAYMENT_DUE', 'OVERDUE', 'FOLLOW_UP');

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "category" TEXT,
ADD COLUMN     "creditLimit" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "ProductVariant" ADD COLUMN     "wholesalePrice" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "supervisesB2b" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "B2bDocument" (
    "id" TEXT NOT NULL,
    "type" "B2bDocumentType" NOT NULL,
    "reference" TEXT NOT NULL,
    "status" "B2bDocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "clientId" TEXT,
    "parentId" TEXT,
    "pointOfSaleId" TEXT,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "validUntil" TIMESTAMP(3),
    "deliveryTerms" TEXT,
    "requestedDeliveryDate" TIMESTAMP(3),
    "createdById" TEXT,
    "receivedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "invoicedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelledById" TEXT,
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "B2bDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "B2bDocumentItem" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "productVariantId" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "lineTotal" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "B2bDocumentItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "B2bContract" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "status" "B2bContractStatus" NOT NULL DEFAULT 'ACTIVE',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "paymentTermsDays" INTEGER NOT NULL DEFAULT 30,
    "minOrderAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "deliveryFrequency" TEXT,
    "discountPercent" DOUBLE PRECISION,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "B2bContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "B2bContractItem" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "productVariantId" TEXT NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "B2bContractItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommercialTarget" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "yearMonth" TEXT NOT NULL,
    "targetAmount" DOUBLE PRECISION NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommercialTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentPromise" (
    "id" TEXT NOT NULL,
    "b2bDocumentId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "PaymentPromiseStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentPromise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerPayment" (
    "id" TEXT NOT NULL,
    "b2bDocumentId" TEXT,
    "orderId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "notes" TEXT,
    "customerName" TEXT,
    "validationStatus" "PaymentValidationStatus" NOT NULL DEFAULT 'PENDING',
    "validatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentReminder" (
    "id" TEXT NOT NULL,
    "b2bDocumentId" TEXT,
    "orderId" TEXT,
    "type" "PaymentReminderType" NOT NULL DEFAULT 'PAYMENT_DUE',
    "sentAt" TIMESTAMP(3),
    "channel" TEXT NOT NULL DEFAULT 'WHATSAPP',
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentReminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "B2bDocument_reference_key" ON "B2bDocument"("reference");

-- CreateIndex
CREATE INDEX "B2bDocument_type_idx" ON "B2bDocument"("type");

-- CreateIndex
CREATE INDEX "B2bDocument_clientId_idx" ON "B2bDocument"("clientId");

-- CreateIndex
CREATE INDEX "B2bDocument_status_idx" ON "B2bDocument"("status");

-- CreateIndex
CREATE INDEX "B2bDocumentItem_documentId_idx" ON "B2bDocumentItem"("documentId");

-- CreateIndex
CREATE INDEX "B2bContract_clientId_idx" ON "B2bContract"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "B2bContractItem_contractId_productVariantId_key" ON "B2bContractItem"("contractId", "productVariantId");

-- CreateIndex
CREATE UNIQUE INDEX "CommercialTarget_userId_yearMonth_key" ON "CommercialTarget"("userId", "yearMonth");

-- CreateIndex
CREATE INDEX "CustomerPayment_b2bDocumentId_idx" ON "CustomerPayment"("b2bDocumentId");

-- AddForeignKey
ALTER TABLE "B2bDocument" ADD CONSTRAINT "B2bDocument_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "B2bDocument" ADD CONSTRAINT "B2bDocument_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "B2bDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "B2bDocumentItem" ADD CONSTRAINT "B2bDocumentItem_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "B2bDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "B2bDocumentItem" ADD CONSTRAINT "B2bDocumentItem_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "B2bContract" ADD CONSTRAINT "B2bContract_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "B2bContractItem" ADD CONSTRAINT "B2bContractItem_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "B2bContract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "B2bContractItem" ADD CONSTRAINT "B2bContractItem_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommercialTarget" ADD CONSTRAINT "CommercialTarget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentPromise" ADD CONSTRAINT "PaymentPromise_b2bDocumentId_fkey" FOREIGN KEY ("b2bDocumentId") REFERENCES "B2bDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerPayment" ADD CONSTRAINT "CustomerPayment_b2bDocumentId_fkey" FOREIGN KEY ("b2bDocumentId") REFERENCES "B2bDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentReminder" ADD CONSTRAINT "PaymentReminder_b2bDocumentId_fkey" FOREIGN KEY ("b2bDocumentId") REFERENCES "B2bDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;
