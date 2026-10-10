import { auth } from "@/lib/auth"
import { getPrisma } from "@/lib/prisma"

/**
 * Journal des actions métier (table ActivityLog). Ne fait jamais échouer l'action journalisée :
 * une erreur d'écriture du journal est seulement tracée.
 */
export async function logActivity(entry: {
  module: string
  action: string
  entity?: string
  entityId?: string | null
  summary: string
  userId?: string
}): Promise<void> {
  try {
    const userId = entry.userId ?? (await auth())?.user?.id
    if (!userId) return
    await getPrisma().activityLog.create({
      data: {
        userId,
        module: entry.module,
        action: entry.action,
        entity: entry.entity ?? null,
        entityId: entry.entityId ?? null,
        summary: entry.summary,
      },
    })
  } catch (error) {
    console.error("logActivity error:", error)
  }
}
