import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { generateLotNumber } from "@/lib/lot-utils";

async function main() {
  const variants = await prisma.productVariant.findMany({
    include: { product: true, pointOfSaleStocks: true, productionLots: true },
  });

  let fixed = 0;
  for (const v of variants) {
    const totalAll = v.stock + v.pointOfSaleStocks.reduce((s, p) => s + p.quantity, 0);
    const lotsRemaining = v.productionLots
      .filter((l) => l.status === "ACTIVE")
      .reduce((s, l) => s + l.remainingQuantity, 0);

    const gap = totalAll - lotsRemaining;
    if (gap === 0) continue;

    if (gap > 0) {
      const lotNumber = await generateLotNumber();
      await prisma.$transaction(async (tx) => {
        await tx.productionLot.create({
          data: {
            lotNumber,
            variantId: v.id,
            initialQuantity: gap,
            remainingQuantity: gap,
            notes: "Régularisation (rattrapage lots manquants)",
          },
        });
        await tx.stockMovement.create({
          data: {
            variantId: v.id,
            type: "ADJUSTMENT_IN",
            quantity: gap,
            reason: "Régularisation lots manquants",
            reference: lotNumber,
            lotId: (await tx.productionLot.findUnique({ where: { lotNumber } }))?.id,
          },
        });
      });
      console.log(
        `FIX +${gap} lot ${lotNumber} pour ${v.product.name} ${v.format} (C=${v.stock} P=${v.pointOfSaleStocks.reduce((s, p) => s + p.quantity, 0)} L=${lotsRemaining})`
      );
      fixed++;
    } else {
      console.log(
        `ATTENTION ${v.product.name} ${v.format}: lots (${lotsRemaining}) > stock total (${totalAll}) — écart de ${-gap} à vérifier manuellement`
      );
    }
  }

  console.log(fixed === 0 ? "Aucun écart à corriger." : `${fixed} variante(s) corrigée(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
