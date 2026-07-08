import { NextResponse } from "next/server"
import { getMessageById, markMessageAsRead, deleteMessage } from "@/data/store"

export async function GET(_req: Request, ctx: RouteContext<"/api/messages/[id]">) {
  const { id } = await ctx.params
  const msg = getMessageById(id)
  if (!msg) {
    return NextResponse.json({ error: "Message introuvable" }, { status: 404 })
  }
  return NextResponse.json(msg)
}

export async function PATCH(_req: Request, ctx: RouteContext<"/api/messages/[id]">) {
  const { id } = await ctx.params
  const success = markMessageAsRead(id)
  if (!success) {
    return NextResponse.json({ error: "Message introuvable" }, { status: 404 })
  }
  return NextResponse.json({ success: true })
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/messages/[id]">) {
  const { id } = await ctx.params
  const success = deleteMessage(id)
  if (!success) {
    return NextResponse.json({ error: "Message introuvable" }, { status: 404 })
  }
  return NextResponse.json({ success: true })
}
