import "dotenv/config"
import { PrismaClient } from "../src/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter } as any)

async function main() {
  const variants = await prisma.productVariant.findMany({
    include: {
      product: true,
      pointOfSaleStocks: true,
      productionLots: { select: { id: true, remainingQuantity: true, status: true, initialQuantity: true } },
    },
  })

  const posList = await prisma.pointOfSale.findMany({ select: { id: true, name: true, code: true } })
  console.log("=== POINTS DE VENTE ===")
  for (const p of posList) console.log(`- ${p.code} | ${p.name}`)

  console.log("\n=== PER VARIANTE (C=central, P=sum POS incl compactir, L=sum lots ACTIVE, INIT=sum initialQuantity) ===")
  let bad = 0
  for (const v of variants) {
    const c = v.stock
    const p = v.pointOfSaleStocks.reduce((s, x) => s + x.quantity, 0)
    const active = v.productionLots.filter((l) => l.status === "ACTIVE")
    const l = active.reduce((s, x) => s + x.remainingQuantity, 0)
    const lall = v.productionLots.reduce((s, x) => s + x.remainingQuantity, 0)
    const init = v.productionLots.reduce((s, x) => s + x.initialQuantity, 0)
    const invariant = c + p !== l
    const consumed = init - lall
    const mark = invariant ? "  <<< ECART C+P vs L(ACTIVE)" : ""
    if (invariant) bad++
    console.log(
      `${v.product.name} | ${v.format} | C=${c} P=${p} L(active)=${l} L(tous)=${lall} INIT=${init} consomme=${consumed}${mark}`
    )
    if (v.pointOfSaleStocks.length > 1) {
      for (const s of v.pointOfSaleStocks) {
        const pos = posList.find((x) => x.id === s.pointOfSaleId)
        console.log(`   -> ${pos?.code ?? s.pointOfSaleId}: ${s.quantity}`)
      }
    }
  }

  console.log(`\n=== TOTAL: ${variants.length} variantes, ${bad} ECARTS ===`)

  const ordersW = await prisma.order.findMany({
    where: { source: "RESERVATION", status: { notIn: ["PENDING", "CANCELLED"] } },
    select: { id: true, orderNumber: true, status: true, pointOfSaleId: true, items: true },
  })
  console.log(`\n=== Commandes RESERVATION non-annulées/confirmées: ${ordersW.length} ===`)
  for (const o of ordersW) {
    console.log(`- ${o.orderNumber} ${o.status} pos=${o.pointOfSaleId ? "OUI" : "NON"} items=${o.items.length}`)
  }

  const rsv = await prisma.reservation.findMany({
    where: { status: "CONFIRMED", orderId: { not: null } },
    select: { id: true, status: true, order: { select: { status: true, orderNumber: true, pointOfSaleId: true } } },
  })
  console.log(`\n=== Reservations CONFIRMED liées à un order: ${rsv.length} ===`)
  for (const r of rsv) {
    console.log(`- ${r.id.slice(-6).toUpperCase()} order=${r.order?.orderNumber} status=${r.order?.status} pos=${r.order?.pointOfSaleId ? "OUI" : "NON"}`)
  }

  const dups = await prisma.productionLot.groupBy({ by: ["lotNumber"], _count: true, having: { lotNumber: { _count: { gt: 1 } } } })
  console.log(`\n=== lotNumber en double: ${dups.length} ===`)
  if (dups.length) console.log(JSON.stringify(dups, null, 2))

  const allocByRef = await prisma.lotAllocation.groupBy({ by: ["reference"], _count: { _all: true }, orderBy: { reference: "asc" } })
  console.log(`\n=== LotAllocation par reference (incl doubles) ===`)
  for (const r of allocByRef) {
    if (r.reference?.startsWith("COMPTOIR-") || r.reference?.startsWith("TRANSFERT-")) {
      console.log(`- ${r.reference}: ${r._count._all}`)
    }
  }
  console.log(`\nTotal allocations BY-TIME refs: ${allocByRef.filter((r) => r.reference?.startsWith("COMPTOIR-")).length} COMPTOIR, ${allocByRef.filter((r) => r.reference?.startsWith("TRANSFERT-")).length} TRANSFERT`)
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("FATAL:", e)
    process.exit(1)
  })
