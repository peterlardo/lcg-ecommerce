import { NextResponse } from "next/server"
import { requireManagementAccess } from "@/lib/api-auth"
import { getPrisma } from "@/lib/prisma"
import { findDuplicates } from "@/lib/client-duplicates"

/**
 * Clients déjà présents qui ressemblent à celui qu'on s'apprête à créer (écran « Nouveau client »).
 * Lecture seule ; mêmes rôles que la création d'un client.
 */
export async function GET(request: Request) {
  const forbidden = await requireManagementAccess(["ADMIN", "COMMERCIAL"])
  if (forbidden) return forbidden

  try {
    const { searchParams } = new URL(request.url)
    const get = (key: string) => searchParams.get(key)?.trim() || null
    const type = get("type")
    const candidate = {
      type: type === "B2B" || type === "B2C" ? type : null,
      companyName: get("companyName"),
      tradeName: get("tradeName"),
      firstName: get("firstName"),
      lastName: get("lastName"),
      phone: get("phone"),
      email: get("email"),
    }

    const existing = await getPrisma().client.findMany({
      select: {
        id: true, type: true, companyName: true, tradeName: true, contactName: true, firstName: true, lastName: true,
        phone: true, email: true, city: true, isActive: true, commercial: { select: { name: true } },
      },
    })
    return NextResponse.json(findDuplicates(candidate, existing))
  } catch (error) {
    console.error("GET /api/clients/doublons error:", error)
    return NextResponse.json({ error: "Erreur lors de la recherche de doublons" }, { status: 500 })
  }
}
