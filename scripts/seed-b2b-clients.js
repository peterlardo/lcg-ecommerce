const { PrismaClient } = require("@prisma/client");
const { PrismaNeon } = require("@prisma/adapter-neon");
const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");

// Load .env
const envPath = path.resolve(__dirname, "..", ".env");
const envContent = fs.readFileSync(envPath, "utf-8");
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const idx = trimmed.indexOf("=");
  if (idx === -1) continue;
  const key = trimmed.slice(0, idx).trim();
  const val = trimmed.slice(idx + 1).trim();
  if (!process.env[key]) process.env[key] = val;
}

const rawUrl = process.env.DATABASE_URL;
if (!rawUrl) { console.error("DATABASE_URL not found"); process.exit(1); }

const url = new URL(rawUrl);
url.hostname = url.hostname.replace(/^(ep-[^.]+)\./, "$1-pooler.");

const adapter = new PrismaNeon({ connectionString: url.toString() });
const prisma = new PrismaClient({ adapter });

// Debug
console.log("Available model delegates:", Object.keys(prisma).filter(k => !k.startsWith("_")).join(", "));

async function main() {
  const wb = XLSX.readFile(
    path.resolve("C:\\Users\\HP\\Downloads\\Base clients actifs CHR Brazzaville.xlsx")
  );
  const ws = wb.Sheets["Base complète"];
  const rows = XLSX.utils.sheet_to_json(ws);

  console.log(`Found ${rows.length} clients in Excel`);

  for (const row of rows) {
    const name = row["Nom de l\u00e9tablissement"] || row["Nom de l'établissement"] || "";
    const category = row["Cat\u00e9gorie"] || row["Catégorie"] || "";
    const phone = (row["T\u00e9l\u00e9phone (+242)"] || row["Téléphone (+242)"] || "").trim();
    const status = row["Statut"] || "Validé";

    try {
      await prisma.$executeRaw`
        INSERT INTO "B2BClient" ("id", "externalId", "name", "category", "phone", "status", "isActive", "createdAt", "updatedAt")
        VALUES (gen_random_uuid(), ${row["ID"]}, ${name}, ${category}, ${phone}, ${status}, true, NOW(), NOW())
        ON CONFLICT ("externalId") DO UPDATE SET "name" = ${name}, "category" = ${category}, "phone" = ${phone}, "status" = ${status}, "updatedAt" = NOW()
      `;
      process.stdout.write(".");
    } catch (e) {
      console.error(`\nError for ID ${row["ID"]}:`, e.message);
    }
  }
  console.log("\nDone!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
