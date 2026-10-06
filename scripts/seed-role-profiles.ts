import "dotenv/config"
import { Pool } from "pg"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@prisma/client"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter } as any)

async function main() {
  const roles = [
    { key: "ADMIN", label: "Administrateur", description: "Accès complet à toutes les fonctionnalités", color: "#7c3aed", isSystem: true },
    { key: "STOCK_MANAGER", label: "Gestionnaire de stock", description: "Gestion du stock, production et approvisionnement", color: "#059669", isSystem: true },
    { key: "DELIVERY_AGENT", label: "Agent de livraison", description: "Livraisons et suivi des commandes assignées", color: "#d97706", isSystem: true },
    { key: "COMPTABLE", label: "Responsable comptable", description: "Clients B2B, commandes, factures et rapports (lecture + suivi)", color: "#2563eb", isSystem: true },
    { key: "CUSTOMER", label: "Client", description: "Accès client (commandes en ligne)", color: "#6b7280", isSystem: true },
  ]

  for (const role of roles) {
    await prisma.roleProfile.upsert({
      where: { key: role.key },
      update: {},
      create: role,
    })
  }
  console.log("Seeded 5 role profiles")
  await prisma.$disconnect()
  await pool.end()
}

main().catch((e) => { console.error(e); process.exit(1) })
