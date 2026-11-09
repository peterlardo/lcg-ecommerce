import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import { MANAGEMENT_ROLES, requireManagementAccess } from "@/lib/api-auth";

const MANAGE_ROLES = ["ADMIN", "STOCK_MANAGER"] as string[];

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

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const forbidden = await requireManagementAccess(MANAGEMENT_ROLES, [["caisse"]]);
  if (forbidden) return forbidden;
  const { id } = await params;
  const session = await getPrisma().cashSession.findUnique({ where: { id }, select: { id: true } });
  if (!session) return NextResponse.json({ error: "Session introuvable" }, { status: 404 });
  const movements = await getPrisma().cashMovement.findMany({
    where: { cashSessionId: id },
    orderBy: { createdAt: "asc" },
    include: { createdBy: { select: { id: true, name: true, email: true } } },
  });
  return NextResponse.json(movements.map(shape));
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const forbidden = await requireManagementAccess(MANAGE_ROLES);
  if (forbidden) return forbidden;
  const sessionAuth = await auth();
  const authorId = (sessionAuth?.user as { id?: string } | undefined)?.id;
  if (!authorId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { id } = await params;
  const cashSession = await getPrisma().cashSession.findUnique({ where: { id }, select: { id: true, status: true } });
  if (!cashSession) return NextResponse.json({ error: "Session introuvable" }, { status: 404 });
  if (cashSession.status !== "OPEN") {
    return NextResponse.json({ error: "Les mouvements ne sont possibles que sur une caisse ouverte" }, { status: 409 });
  }

  const body = await request.json().catch(() => ({}));
  const type = String(body?.type ?? "").toUpperCase();
  if (type !== "IN" && type !== "OUT") {
    return NextResponse.json({ error: "Type invalide (IN encaissement, OUT décaissement)" }, { status: 400 });
  }
  const amount = Number(body?.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Montant invalide" }, { status: 400 });
  }
  const reason = String(body?.reason ?? "").trim();
  if (!reason) return NextResponse.json({ error: "Le motif est obligatoire" }, { status: 400 });
  const reference = body?.reference ? String(body.reference).trim() || null : null;

  const movement = await getPrisma().cashMovement.create({
    data: { cashSessionId: id, type, amount, reason, reference, createdById: authorId },
    include: { createdBy: { select: { id: true, name: true, email: true } } },
  });
  return NextResponse.json(shape(movement), { status: 201 });
}
