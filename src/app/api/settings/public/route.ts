import { NextResponse } from "next/server"
import { readFile } from "fs/promises"
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
  const settings = await readSettings()
  const data = settings?.data || settings

  return NextResponse.json({
    general: data.general || {},
    delivery: data.delivery || {},
    payment: data.payment || {},
  })
}
