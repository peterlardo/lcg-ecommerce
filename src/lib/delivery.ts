import { getPrisma } from "@/lib/prisma"

export type DeliveryModeValue = "DELIVERY" | "PICKUP"

export type DeliveryChoiceInput = {
  mode?: string | null
  zoneId?: string | null
  agentId?: string | null
}

export type ResolvedDeliveryChoice = {
  mode: DeliveryModeValue
  zoneId: string | null
  agentId: string | null
  fee: number
  zoneName: string | null
  agentName: string | null
}

/**
 * Calcule les frais de livraison CÔTÉ SERVEUR à partir du mode, de la zone et
 * du livreur choisis au checkout. La valeur envoyée par le client est ignorée.
 *
 * Règles :
 * - PICKUP  → frais 0, ni zone ni livreur
 * - DELIVERY → zone obligatoire ; frais = tarif livreur/zone s'il existe,
 *   sinon tarif de base de la zone
 */
export async function resolveDeliveryChoice(input: DeliveryChoiceInput): Promise<ResolvedDeliveryChoice> {
  const prisma = getPrisma()
  const mode: DeliveryModeValue = String(input.mode || "DELIVERY").toUpperCase() === "PICKUP" ? "PICKUP" : "DELIVERY"

  if (mode === "PICKUP") {
    return { mode, zoneId: null, agentId: null, fee: 0, zoneName: null, agentName: null }
  }

  const zoneId = input.zoneId ? String(input.zoneId) : null
  if (!zoneId) {
    throw new DeliveryChoiceError("Zone de livraison requise")
  }

  const zone = await prisma.deliveryZone.findFirst({ where: { id: zoneId, isActive: true } })
  if (!zone) {
    throw new DeliveryChoiceError("Zone de livraison introuvable ou inactive")
  }

  const agentId = input.agentId ? String(input.agentId) : null
  let agentName: string | null = null
  let fee = zone.baseFee

  if (agentId) {
    const agent = await prisma.deliveryAgent.findFirst({ where: { id: agentId, isActive: true } })
    if (!agent) throw new DeliveryChoiceError("Livreur introuvable ou désactivé")
    if (!agent.isAvailable) throw new DeliveryChoiceError(`Le livreur « ${agent.name} » n'est pas disponible`)
    agentName = agent.name
    const agentFee = await prisma.deliveryAgentFee.findUnique({
      where: { agentId_zoneId: { agentId, zoneId } },
    })
    if (agentFee) fee = agentFee.fee
  }

  return { mode, zoneId, agentId, fee: Math.max(0, Number(fee) || 0), zoneName: zone.name, agentName }
}

export class DeliveryChoiceError extends Error {}

export async function deliveryChoiceErrorMessage(error: unknown): Promise<string> {
  if (error instanceof DeliveryChoiceError) return error.message
  return "Choix de livraison invalide"
}
