import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getPrisma } from "@/lib/prisma"

/**
 * Signe de vie d'une personne présente devant l'écran (souris, clavier, toucher), envoyé par le navigateur.
 * Seul ce signal rafraîchit la dernière activité du poste : les relectures automatiques ne comptent pas,
 * sinon un onglet oublié ouvert garderait le compte « occupé » et bloquerait la connexion ailleurs.
 */
export async function POST() {
  const session = await auth()
  const sessionId = session?.user?.sessionId
  if (!sessionId) return NextResponse.json({ ok: false }, { status: 401 })
  await getPrisma().userDeviceSession.updateMany({ where: { sessionId, isActive: true }, data: { lastActiveAt: new Date() } })
  return NextResponse.json({ ok: true })
}
