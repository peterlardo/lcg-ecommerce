import { getPrisma } from "@/lib/prisma";

export const COMPTOIR_CODE = "PDV-COMPTOIR"

export async function getOrCreateComptoir() {
  return getPrisma().pointOfSale.upsert({
    where: { code: COMPTOIR_CODE },
    update: {},
    create: {
      name: "Comptoir LCG",
      code: COMPTOIR_CODE,
      address: "Dépôt central LCG",
      city: "Brazzaville",
      isActive: true,
    },
  })
}
