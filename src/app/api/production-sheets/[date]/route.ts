import { NextResponse } from "next/server"
import { getPrisma } from "@/lib/prisma"
import { requireManagementAccess } from "@/lib/api-auth"
import { auth } from "@/lib/auth"
import { logActivity } from "@/lib/activity"

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const SHIFTS = ["Matin", "Après-midi", "Nuit"]

function parseDateParam(value: string): Date | null {
  if (!ISO_DATE.test(value)) return null
  const d = new Date(`${value}T00:00:00.000Z`)
  return Number.isNaN(d.getTime()) ? null : d
}

function intField(value: unknown, fallback = 0): number {
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0) return fallback
  return Math.trunc(n)
}

function floatField(value: unknown): number | null {
  if (value == null || value === "") return null
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? n : null
}

function strField(value: unknown, max = 300): string | null {
  if (value == null) return null
  const s = String(value).trim()
  if (!s) return null
  return s.slice(0, max)
}

function timeField(value: unknown): string | null {
  const s = strField(value, 5)
  if (!s) return null
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(s) ? s : null
}

function dayLabel(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", { weekday: "long", timeZone: "UTC" }).format(date)
}

function sheetNumberFor(date: Date): string {
  const y = String(date.getUTCFullYear()).slice(2)
  const m = String(date.getUTCMonth() + 1).padStart(2, "0")
  const d = String(date.getUTCDate()).padStart(2, "0")
  return `FP-${y}${m}${d}`
}

export async function GET(_req: Request, { params }: { params: Promise<{ date: string }> }) {
  const forbidden = await requireManagementAccess(undefined, [["production"], "view"])
  if (forbidden) return forbidden

  const { date: dateParam } = await params
  const date = parseDateParam(dateParam)
  if (!date) return NextResponse.json({ error: "Date invalide" }, { status: 400 })

  const prisma = await getPrisma()
  const sheet = await prisma.productionSheet.findUnique({
    where: { date },
    include: { lines: { orderBy: { id: "asc" } } },
  })

  const paramsList = await prisma.productionParam.findMany({ orderBy: { sortOrder: "asc" } })

  return NextResponse.json({
    sheet: sheet ?? null,
    params: paramsList,
    dayLabel: dayLabel(date),
  })
}

export async function PUT(request: Request, { params }: { params: Promise<{ date: string }> }) {
  const forbidden = await requireManagementAccess(undefined, [["production"], "create"])
  if (forbidden) return forbidden

  const { date: dateParam } = await params
  const date = parseDateParam(dateParam)
  if (!date) return NextResponse.json({ error: "Date invalide" }, { status: 400 })

  const session = await auth()
  const userId = session?.user?.id ?? null

  const prisma = await getPrisma()
  try {
    const body = await request.json()

    const manager = strField(body?.manager, 150)
    const qualityControl = strField(body?.qualityControl, 150)
    const shifts = strField(body?.shifts, 200)
    const incidents = strField(body?.incidents, 2000)
    const emptyPackaging = body?.emptyPackaging == null || body.emptyPackaging === "" ? null : intField(body.emptyPackaging)
    const waterM3 = floatField(body?.waterM3)
    const electricityKwh = floatField(body?.electricityKwh)
    const generatorLiters = floatField(body?.generatorLiters)
    const outageMinutes = body?.outageMinutes == null || body.outageMinutes === "" ? null : intField(body.outageMinutes)
    const machineDowntimeMinutes =
      body?.machineDowntimeMinutes == null || body.machineDowntimeMinutes === "" ? null : intField(body.machineDowntimeMinutes)

    const rawLines = Array.isArray(body?.lines) ? body.lines : []
    const lines: {
      productName: string
      productCode: string
      shift: string | null
      machine: string | null
      startTime: string | null
      endTime: string | null
      producedQty: number
      rejectedQty: number
      conformQty: number
      unit: string
      operator: string | null
      qualityStatus: string | null
      notes: string | null
    }[] = rawLines
      .filter((l: Record<string, unknown>) => l && strField(l.productName, 100))
      .map((l: Record<string, unknown>) => {        const producedQty = intField(l.producedQty)
        const rejectedQty = Math.min(intField(l.rejectedQty), producedQty)
        return {
          productName: strField(l.productName, 100)!,
          productCode: strField(l.productCode, 20) ?? "",
          shift: l.shift && SHIFTS.includes(String(l.shift)) ? String(l.shift) : null,
          machine: strField(l.machine, 100),
          startTime: timeField(l.startTime),
          endTime: timeField(l.endTime),
          producedQty,
          rejectedQty,
          conformQty: producedQty - rejectedQty,
          unit: strField(l.unit, 20) ?? "Kg",
          operator: strField(l.operator, 150),
          qualityStatus: strField(l.qualityStatus, 50),
          notes: strField(l.notes, 500),
        }
      })

    const sheet = await prisma.$transaction(async (tx) => {
      const number = sheetNumberFor(date)
      const existing = await tx.productionSheet.findUnique({ where: { date } })
      const data = {
        manager,
        qualityControl,
        shifts,
        emptyPackaging,
        waterM3,
        electricityKwh,
        generatorLiters,
        outageMinutes,
        machineDowntimeMinutes,
        incidents,
        status: "SUBMITTED",
      }
      const saved = existing
        ? await tx.productionSheet.update({ where: { id: existing.id }, data: { ...data, sheetNumber: number } })
        : await tx.productionSheet.create({ data: { ...data, date, sheetNumber: number, createdById: userId } })

      await tx.productionSheetLine.deleteMany({ where: { sheetId: saved.id } })
      if (lines.length > 0) {
        await tx.productionSheetLine.createMany({ data: lines.map((l) => ({ ...l, sheetId: saved.id })) })
      }
      return tx.productionSheet.findUnique({
        where: { id: saved.id },
        include: { lines: { orderBy: { id: "asc" } } },
      })
    })

    await logActivity({
      module: "production",
      action: "fiche-production",
      summary: `Fiche de production ${sheet?.sheetNumber} (${dateParam}) enregistrée : ${lines.length} ligne(s).`,
    })

    return NextResponse.json({ sheet })
  } catch (error) {
    console.error("production-sheets/[date] PUT", error)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}
