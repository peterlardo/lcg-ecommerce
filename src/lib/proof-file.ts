/**
 * Prépare un justificatif de règlement avant l'envoi (navigateur uniquement) : une photo de téléphone
 * est réduite (1 800 px au plus, JPEG) pour rester lisible et légère ; un PDF part tel quel.
 */
const MAX_SIDE = 1800

export async function prepareProof(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
    // petite image déjà légère : inutile de la recompresser
    if (scale === 1 && file.size < 1.5 * 1024 * 1024) { bitmap.close(); return file }
    const canvas = document.createElement("canvas")
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    const ctx = canvas.getContext("2d")
    if (!ctx) { bitmap.close(); return file }
    ctx.fillStyle = "#fff"
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82))
    if (!blob) return file
    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg"
    return new File([blob], name, { type: "image/jpeg" })
  } catch {
    return file
  }
}
