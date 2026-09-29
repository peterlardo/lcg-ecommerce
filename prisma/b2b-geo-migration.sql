-- AlterTable
ALTER TABLE "B2BClient" ADD COLUMN     "address" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "geoConfidence" TEXT,
ADD COLUMN     "geoSource" TEXT,
ADD COLUMN     "geoVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION;

-- CreateIndex
CREATE INDEX "B2BClient_latitude_longitude_idx" ON "B2BClient"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "B2BClient_geoVerified_idx" ON "B2BClient"("geoVerified");
