import { NextResponse } from "next/server"
import { writeFile } from "fs/promises"
import { join } from "path"
import { requireManagementAccess } from "@/lib/api-auth"

export async function POST(request: Request) {
  const forbidden = await requireManagementAccess(["ADMIN"])
  if (forbidden) return forbidden
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File | null
    if (!file) return NextResponse.json({ error: "Aucun fichier" }, { status: 400 })

    const allowed = ["image/jpeg", "image/png", "image/webp"]
    if (!allowed.includes(file.type)) return NextResponse.json({ error: "Format non supporté (jpeg, png, webp)" }, { status: 400 })
    if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: "Fichier trop volumineux (max 5 Mo)" }, { status: 400 })

    const ext = file.name.split(".").pop() || "jpg"
    const filename = `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const bytes = Buffer.from(await file.arrayBuffer())
    const uploadDir = join(process.cwd(), "public", "uploads", "users")
    await writeFile(join(uploadDir, filename), bytes)

    return NextResponse.json({ url: `/uploads/users/${filename}` })
  } catch (error) {
    console.error("Upload error:", error)
    return NextResponse.json({ error: "Erreur d'upload" }, { status: 500 })
  }
}
