/**
 * Envoi de messages WhatsApp via l'API officielle Meta WhatsApp Cloud API.
 *
 * Configuration (.env) :
 *   WHATSAPP_TOKEN=...             Token d'accès Meta (EAA...)
 *   WHATSAPP_PHONE_NUMBER_ID=...   Identifiant du numéro WhatsApp Business
 *
 * Sans ces variables, l'envoi est simplement ignoré (retour false).
 */

const GRAPH_API = "https://graph.facebook.com/v20.0"

function isConfigured(): boolean {
  return Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID)
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "")
}

export async function sendWhatsAppMessage(phone: string, body: string): Promise<boolean> {
  if (!isConfigured() || !body) return false

  const to = normalizePhone(phone)
  if (to.length < 8) {
    console.warn("WhatsApp: numéro invalide", phone)
    return false
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    const res = await fetch(`${GRAPH_API}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { preview_url: false, body },
      }),
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (!res.ok) {
      const detail = await res.text().catch(() => "")
      console.error(`WhatsApp API ${res.status}:`, detail)
      return false
    }
    return true
  } catch (error) {
    console.error("WhatsApp envoi échoué:", error)
    return false
  }
}
