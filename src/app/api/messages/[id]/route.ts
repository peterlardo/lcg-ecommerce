import { NextResponse } from "next/server"
import { getMessageById, markMessageAsRead, deleteMessage } from "@/data/store"
import { requireModuleAccess } from "@/lib/api-auth"

export async function GET(_req: Request, ctx: RouteContext<"/api/messages/[id]">) {
  const forbidden = await requireModuleAccess("messages")
  if (forbidden) return forbidden
  const { id } = await ctx.params
  const msg = await getMessageById(id)
  if (!msg) {
    return NextResponse.json({ error: "Message introuvable" }, { status: 404 })
  }
  return NextResponse.json(msg)
}

export async function PATCH(_req: Request, ctx: RouteContext<"/api/messages/[id]">) {
  const forbidden = await requireModuleAccess("messages", "edit")
  if (forbidden) return forbidden
  const { id } = await ctx.params
  const success = await markMessageAsRead(id)
  if (!success) {
    return NextResponse.json({ error: "Message introuvable" }, { status: 404 })
  }
  return NextResponse.json({ success: true })
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/messages/[id]">) {
  const forbidden = await requireModuleAccess("messages", "delete")
  if (forbidden) return forbidden
  const { id } = await ctx.params
  const success = await deleteMessage(id)
  if (!success) {
    return NextResponse.json({ error: "Message introuvable" }, { status: 404 })
  }
  return NextResponse.json({ success: true })
}
