import { NextResponse } from "next/server"
import { requireManagementAccess } from "@/lib/api-auth"
import { readFile, writeFile } from "fs/promises"
import { join } from "path"

const SETTINGS_FILE = join(process.cwd(), "data", "settings.json")

async function readSettings() {
  try {
    const raw = await readFile(SETTINGS_FILE, "utf-8")
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

export async function GET() {
  const forbidden = await requireManagementAccess()
  if (forbidden) return forbidden

  const settings = await readSettings()
  return NextResponse.json(settings)
}

export async function POST(req: Request) {
  const forbidden = await requireManagementAccess()
  if (forbidden) return forbidden

  const body = await req.json()
  const current = await readSettings()
  const updated = { ...current, ...body }

  try {
    const { mkdirSync } = await import("fs")
    mkdirSync(join(process.cwd(), "data"), { recursive: true })
  } catch { /* already exists */ }

  await writeFile(SETTINGS_FILE, JSON.stringify(updated, null, 2), "utf-8")
  return NextResponse.json({ ok: true })
}
