/**
 * Envoi de messages WhatsApp via l'API officielle Meta WhatsApp Cloud API.
 *
 * Configuration (.env) :
 *   WHATSAPP_TOKEN=...             Token d'accès Meta (EAA...)
 *   WHATSAPP_PHONE_NUMBER_ID=...   Identifiant du numéro WhatsApp Business
 *
 *   WHATSAPP_TEMPLATE=...          (recommandé) Nom d'un modèle approuvé par Meta, langue fr,
 *                                  avec UNE variable {{1}} dans le corps : le texte du message.
 *
 * Meta refuse les messages libres hors fenêtre de 24 h (client qui n'a pas écrit) :
 * pour prévenir un client de soi-même, il faut un modèle. Sans modèle, envoi en texte libre.
 * Sans token ni identifiant, l'envoi est simplement ignoré (retour false).
 */
import { normalizeWaPhone } from "@/lib/devis-text"

const GRAPH_API = "https://graph.facebook.com/v20.0"

function isConfigured(): boolean {
  return Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID)
}

export async function sendWhatsAppMessage(phone: string, body: string): Promise<boolean> {
  if (!isConfigured() || !body) return false

  const to = normalizeWaPhone(phone)
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
        ...(process.env.WHATSAPP_TEMPLATE
          ? {
              type: "template",
              template: {
                name: process.env.WHATSAPP_TEMPLATE,
                language: { code: process.env.WHATSAPP_TEMPLATE_LANG || "fr" },
                // Meta interdit retours à la ligne et tabulations dans un paramètre de modèle.
                components: [{ type: "body", parameters: [{ type: "text", text: body.replace(/\s*\n+\s*/g, " · ").replace(/\s{2,}/g, " ").slice(0, 1000) }] }],
              },
            }
          : { type: "text", text: { preview_url: false, body } }),
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
