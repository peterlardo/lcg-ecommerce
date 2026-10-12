import { NextResponse } from "next/server"
import { getPrisma } from "@/lib/prisma"
import { requireManagementAccess } from "@/lib/api-auth"
import { logActivity } from "@/lib/activity"
import { closeUserSessions } from "@/lib/device-session"

/** Libère la session ouverte d'un compte : l'appareil concerné est déconnecté, le compte peut se reconnecter ailleurs. */
export async function DELETE(_request: Request, context: { params: Promise<unknown> }) {
  const forbidden = await requireManagementAccess(["ADMIN"])
  if (forbidden) return forbidden
  try {
    const { id } = (await context.params) as { id: string }
    const user = await getPrisma().user.findUnique({ where: { id }, select: { email: true } })
    if (!user) return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 })

    const closed = await closeUserSessions(id)
    if (closed > 0) {
      await logActivity({ module: "utilisateurs", action: "Libération de session", entity: "user", entityId: id, summary: `Session du compte ${user.email} libérée` })
    }
    return NextResponse.json({ closed })
  } catch (error) {
    console.error("DELETE utilisateurs/sessions error:", error)
    return NextResponse.json({ error: "Impossible de libérer la session" }, { status: 500 })
  }
}
