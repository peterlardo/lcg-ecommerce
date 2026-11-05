-- Fiches de production (documentation, sans effet sur le stock)
CREATE TABLE IF NOT EXISTS "ProductionParam" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "unit" TEXT NOT NULL DEFAULT 'Kg',
  "weightKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "dailyObjective" INTEGER NOT NULL DEFAULT 0,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "ProductionParam_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ProductionParam_name_key" ON "ProductionParam"("name");
CREATE UNIQUE INDEX IF NOT EXISTS "ProductionParam_code_key" ON "ProductionParam"("code");

CREATE TABLE IF NOT EXISTS "ProductionSheet" (
  "id" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "sheetNumber" TEXT NOT NULL,
  "manager" TEXT,
  "qualityControl" TEXT,
  "shifts" TEXT,
  "emptyPackaging" INTEGER,
  "waterM3" DOUBLE PRECISION,
  "electricityKwh" DOUBLE PRECISION,
  "generatorLiters" DOUBLE PRECISION,
  "outageMinutes" INTEGER,
  "machineDowntimeMinutes" INTEGER,
  "incidents" TEXT,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductionSheet_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ProductionSheet_date_key" ON "ProductionSheet"("date");
CREATE UNIQUE INDEX IF NOT EXISTS "ProductionSheet_sheetNumber_key" ON "ProductionSheet"("sheetNumber");

CREATE TABLE IF NOT EXISTS "ProductionSheetLine" (
  "id" TEXT NOT NULL,
  "sheetId" TEXT NOT NULL,
  "productName" TEXT NOT NULL,
  "productCode" TEXT NOT NULL,
  "shift" TEXT,
  "machine" TEXT,
  "startTime" TEXT,
  "endTime" TEXT,
  "producedQty" INTEGER NOT NULL DEFAULT 0,
  "rejectedQty" INTEGER NOT NULL DEFAULT 0,
  "conformQty" INTEGER NOT NULL DEFAULT 0,
  "unit" TEXT NOT NULL DEFAULT 'Kg',
  "operator" TEXT,
  "qualityStatus" TEXT,
  "notes" TEXT,
  CONSTRAINT "ProductionSheetLine_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ProductionSheetLine_sheetId_idx" ON "ProductionSheetLine"("sheetId");

ALTER TABLE "ProductionSheet" ADD CONSTRAINT "ProductionSheet_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProductionSheetLine" ADD CONSTRAINT "ProductionSheetLine_sheetId_fkey" FOREIGN KEY ("sheetId") REFERENCES "ProductionSheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
