import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { requireManagementAccess } from "@/lib/api-auth";

const ADMIN_ONLY = ["ADMIN"] as string[];

function shape(m: { id: string; cashSessionId: string; type: string; amount: number; reason: string; reference: string | null; createdById: string; createdAt: Date; updatedAt: Date; createdBy?: { id: string; name: string | null; email: string } | null }) {
  return {
    id: m.id,
    cashSessionId: m.cashSessionId,
    type: m.type,
    amount: m.amount,
    reason: m.reason,
    reference: m.reference,
    createdById: m.createdById,
    author: m.createdBy?.name || m.createdBy?.email || null,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
  };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; mid: string }> }) {
  const forbidden = await requireManagementAccess(ADMIN_ONLY);
  if (forbidden) return forbidden;
  const { id, mid } = await params;
  const existing = await getPrisma().cashMovement.findFirst({ where: { id: mid, cashSessionId: id }, include: { cashSession: { select: { status: true } } } });
  if (!existing) return NextResponse.json({ error: "Mouvement introuvable" }, { status: 404 });
  if (existing.cashSession.status !== "OPEN") return NextResponse.json({ error: "Session clôturée" }, { status: 409 });

  const body = await request.json().catch(() => ({}));
  const data: { type?: string; amount?: number; reason?: string; reference?: string | null } = {};
  if (body?.type !== undefined) {
    const t = String(body.type).toUpperCase();
    if (t !== "IN" && t !== "OUT") return NextResponse.json({ error: "Type invalide" }, { status: 400 });
    data.type = t;
  }
  if (body?.amount !== undefined) {
    const n = Number(body.amount);
    if (!Number.isFinite(n) || n <= 0) return NextResponse.json({ error: "Montant invalide" }, { status: 400 });
    data.amount = n;
  }
  if (body?.reason !== undefined) {
    const r = String(body.reason).trim();
    if (!r) return NextResponse.json({ error: "Le motif est obligatoire" }, { status: 400 });
    data.reason = r;
  }
  if (body?.reference !== undefined) data.reference = body.reference ? String(body.reference).trim() || null : null;

  const movement = await getPrisma().cashMovement.update({
    where: { id: mid },
    data,
    include: { createdBy: { select: { id: true, name: true, email: true } } },
  });
  return NextResponse.json(shape(movement));
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; mid: string }> }) {
  const forbidden = await requireManagementAccess(ADMIN_ONLY);
  if (forbidden) return forbidden;
  const { id, mid } = await params;
  const existing = await getPrisma().cashMovement.findFirst({ where: { id: mid, cashSessionId: id }, include: { cashSession: { select: { status: true } } } });
  if (!existing) return NextResponse.json({ error: "Mouvement introuvable" }, { status: 404 });
  if (existing.cashSession.status !== "OPEN") return NextResponse.json({ error: "Session clôturée" }, { status: 409 });
  await getPrisma().cashMovement.delete({ where: { id: mid } });
  return NextResponse.json({ ok: true });
}
