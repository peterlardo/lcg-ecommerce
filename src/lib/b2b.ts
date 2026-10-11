import type { Prisma, PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";

export const PRIMARY_DOC_TYPES = ["DEVIS", "COMMANDE", "LIVRAISON", "FACTURE"] as const;

export const B2B_SCOPE_USERS = ["ADMIN", "COMPTABLE"] as const;

export async function nextDocumentReference(
  tx: Prisma.TransactionClient,
  prefix: "DEV" | "BC" | "BL" | "FAC",
  year = new Date().getFullYear()
): Promise<string> {
  const count = await tx.b2bDocument.count({
    where: { reference: { startsWith: `${prefix}-${year}-` } },
  });
  return `${prefix}-${year}-${String(count + 1).padStart(4, "0")}`;
}

export async function applicableContract(prisma: PrismaClient, clientId: string) {
  const now = new Date();
  return prisma.b2bContract.findFirst({
    where: {
      clientId,
      status: "ACTIVE",
      startsAt: { lte: now },
      OR: [{ endsAt: null }, { endsAt: { gte: now } }],
    },
    orderBy: { startsAt: "desc" },
    include: { items: true },
  });
}

export function contractUnitPrice(
  contract: { items: { productVariantId: string; unitPrice: number }[] } | null,
  variantId: string
) {
  return contract?.items.find((i) => i.productVariantId === variantId)?.unitPrice ?? null;
}

export function computeCreance(
  total: number,
  payments: { amount: number; validationStatus: string }[],
  promises: { amount: number; status: string }[]
) {
  const paid = payments
    .filter((p) => p.validationStatus === "VALIDATED" || p.validationStatus === "PENDING")
    .reduce((s, p) => s + p.amount, 0);
  const promised = promises.filter((p) => p.status === "PENDING").reduce((s, p) => s + p.amount, 0);
  return Math.max(0, total - paid - promised);
}

export function buildDevisToken(ref: string, secret: string) {
  return createHash("sha256").update(ref + secret).digest("hex");
}
