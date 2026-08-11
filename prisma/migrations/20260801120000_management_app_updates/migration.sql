-- Keep the database aligned with the management application fields used by the admin UI.
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "badge" TEXT;
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "address" TEXT NOT NULL DEFAULT '';
