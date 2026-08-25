import "dotenv/config"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  await prisma.orderItem.deleteMany()
  await prisma.stockMovement.deleteMany()
  await prisma.pointOfSaleStock.deleteMany()
  await prisma.productVariant.deleteMany()
  await prisma.product.deleteMany()

  const products = [
    {
      name: "Glaçon Creux",
      subtitle: "Tube",
      description: "Glaçons creux en forme de tube, idéaux pour vos boissons.",
      variants: [
        { format: "1kg", price: 1000, stock: 100, unit: "sac" },
        { format: "2kg", price: 1500, stock: 80, unit: "sac" },
        { format: "5kg", price: 4000, stock: 50, unit: "sac" },
      ],
    },
    {
      name: "Glaçon Cubes",
      subtitle: null,
      description: "Glaçons classiques en forme de cubes.",
      variants: [
        { format: "1kg", price: 1000, stock: 100, unit: "sac" },
        { format: "2kg", price: 1500, stock: 80, unit: "sac" },
        { format: "5kg", price: 4000, stock: 50, unit: "sac" },
      ],
    },
    {
      name: "Glaçon Pilé",
      subtitle: null,
      description: "Glaçons pilés, parfaits pour les cocktails et smoothies.",
      variants: [
        { format: "1kg", price: 2000, stock: 60, unit: "sac" },
        { format: "2kg", price: 2500, stock: 45, unit: "sac" },
        { format: "5kg", price: 4500, stock: 30, unit: "sac" },
      ],
    },
    {
      name: "Glaçon Plein",
      subtitle: null,
      description: "Glaçons pleins, fondent lentement pour une fraîcheur durable.",
      variants: [
        { format: "1kg", price: 1500, stock: 60, unit: "sac" },
        { format: "2kg", price: 2500, stock: 45, unit: "sac" },
        { format: "5kg", price: 5500, stock: 30, unit: "sac" },
      ],
    },
  ]

  for (const product of products) {
    const created = await prisma.product.create({
      data: {
        name: product.name,
        subtitle: product.subtitle,
        description: product.description,
        isActive: true,
        isFeatured: product.name === "Glaçon Creux",
      },
    })

    for (const variant of product.variants) {
      await prisma.productVariant.create({
        data: {
          productId: created.id,
          format: variant.format,
          price: variant.price,
          stock: variant.stock,
          unit: variant.unit,
        },
      })
    }

    console.log(`Produit créé: ${product.name} avec ${product.variants.length} variantes`)
  }

  console.log("Migration des produits terminée !")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
