import nodemailer from "nodemailer"
import type { Transporter } from "nodemailer"

export interface OrderMailItem {
  name: string
  format: string
  quantity: number
  price: number
}

export interface OrderMailData {
  orderNumber: string
  createdAt: string
  customerName: string
  customerPhone: string
  customerEmail: string
  address: string
  city: string
  district: string
  paymentMethod: string
  source: string
  notes: string
  items: OrderMailItem[]
  subtotal: number
  deliveryFee: number
  total: number
}

export interface ReservationMailData {
  ref: string
  createdAt: string
  client: string
  telephone: string
  email: string
  type: string
  date: string
  heure: string
  address: string
  source: string
  notes: string
  items: OrderMailItem[]
}

const MAIL_TO = process.env.MAIL_TO || "fred.bialard@gmail.com"

function formatPrice(price: number): string {
  return price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " FCFA"
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("fr-FR", {
      dateStyle: "long",
      timeStyle: "short",
    })
  } catch {
    return iso
  }
}

function itemsTable(items: OrderMailItem[]): string {
  const rows = items
    .map(
      (i) => `
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 12px 8px; font-size: 14px; color: #1f2937;">${i.name}</td>
        <td style="padding: 12px 8px; font-size: 13px; color: #6b7280; text-align: center;">${i.format}</td>
        <td style="padding: 12px 8px; font-size: 14px; color: #1f2937; text-align: center;">${i.quantity}</td>
        <td style="padding: 12px 8px; font-size: 13px; color: #6b7280; text-align: right;">${formatPrice(i.price)}</td>
        <td style="padding: 12px 8px; font-size: 14px; font-weight: 700; color: #1f2937; text-align: right;">${formatPrice(i.price * i.quantity)}</td>
      </tr>`
    )
    .join("")

  return `
    <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
      <thead>
        <tr style="background: #f3f4f6;">
          <th style="padding: 10px 8px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #374151; text-align: left;">Produit</th>
          <th style="padding: 10px 8px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #374151; text-align: center;">Format</th>
          <th style="padding: 10px 8px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #374151; text-align: center;">Qté</th>
          <th style="padding: 10px 8px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #374151; text-align: right;">Prix unitaire</th>
          <th style="padding: 10px 8px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #374151; text-align: right;">Total</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`
}

function shell(title: string, badge: string, inner: string): string {
  return `
  <div style="margin:0; padding:0; background:#f4f7f6; font-family: Arial, Helvetica, sans-serif;">
    <div style="max-width: 640px; margin: 0 auto; padding: 24px 16px;">
      <div style="background: linear-gradient(135deg, #0f766e, #059669); border-radius: 12px 12px 0 0; padding: 24px 28px; color: #ffffff;">
        <div style="font-size: 20px; font-weight: 800; letter-spacing: 0.5px;">LCG · La Congolaise des Glaçons</div>
        <div style="font-size: 12px; opacity: 0.85; margin-top: 4px;">97 Rue EWO, Ouenzé — Brazzaville · Tél : +242 XX XXX XXX</div>
        <div style="display: inline-block; margin-top: 14px; background: rgba(255,255,255,0.18); border: 1px solid rgba(255,255,255,0.35); border-radius: 999px; padding: 5px 14px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">${badge}</div>
      </div>
      <div style="background: #ffffff; border-radius: 0 0 12px 12px; padding: 28px; border: 1px solid #e5e7eb; border-top: none;">
        ${inner}
        <div style="margin-top: 28px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af; text-align: center;">
          Cet email est envoyé automatiquement par le site LCG. Merci de ne pas y répondre.
        </div>
      </div>
    </div>
  </div>`
}

function infoRow(label: string, value: string): string {
  return `
    <tr>
      <td style="padding: 4px 0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; width: 140px;">${label}</td>
      <td style="padding: 4px 0; font-size: 14px; font-weight: 600; color: #1f2937;">${value || "—"}</td>
    </tr>`
}

function buildOrderHtml(data: OrderMailData): string {
  const paymentLabels: Record<string, string> = {
    CARD: "Carte bancaire",
    MOBILE_MONEY: "Mobile Money",
    CASH_ON_DELIVERY: "Paiement à la livraison",
    card: "Carte bancaire",
    mobile: "Mobile Money",
    cod: "Paiement à la livraison",
  }
  const payment = paymentLabels[data.paymentMethod] || data.paymentMethod || "—"
const sourceLabel = data.source === "OPERATOR" ? "Saisie opérateur (plateforme)" : "Site web (commande en ligne)"

  const inner = `
    <h1 style="margin: 0; font-size: 22px; color: #111827;">Nouvelle commande</h1>
    <p style="margin: 6px 0 0; font-size: 14px; color: #6b7280;">Reçue le ${formatDate(data.createdAt)} · Provenance : ${sourceLabel}</p>

    <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 14px 18px; margin-top: 18px;">
      <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #059669; font-weight: 700;">Référence</div>
      <div style="font-size: 20px; font-weight: 800; color: #047857; margin-top: 2px;">${data.orderNumber}</div>
    </div>

    <h2 style="margin: 24px 0 8px; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; color: #059669;">Client</h2>
    <table style="width: 100%; border-collapse: collapse;">
      ${infoRow("Nom", data.customerName)}
      ${infoRow("Téléphone", data.customerPhone)}
      ${infoRow("Email", data.customerEmail)}
      ${infoRow("Adresse", `${data.address}${data.district ? ` — ${data.district}` : ""}`)}
      ${infoRow("Ville", data.city)}
    </table>

    <h2 style="margin: 24px 0 8px; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; color: #059669;">Articles commandés</h2>
    ${itemsTable(data.items)}

    <table style="width: 100%; margin-top: 16px;">
      <tr>
        <td style="font-size: 14px; color: #374151;">Sous-total</td>
        <td style="font-size: 14px; color: #1f2937; text-align: right;">${formatPrice(data.subtotal)}</td>
      </tr>
      <tr>
        <td style="font-size: 14px; color: #374151;">Livraison</td>
        <td style="font-size: 14px; color: #1f2937; text-align: right;">${data.deliveryFee > 0 ? formatPrice(data.deliveryFee) : "Gratuite"}</td>
      </tr>
      <tr>
        <td style="padding-top: 10px; font-size: 16px; font-weight: 800; color: #111827;">TOTAL</td>
        <td style="padding-top: 10px; font-size: 18px; font-weight: 800; color: #059669; text-align: right;">${formatPrice(data.total)}</td>
      </tr>
    </table>

    <h2 style="margin: 24px 0 8px; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; color: #059669;">Paiement</h2>
    <p style="margin: 0; font-size: 14px; color: #1f2937;">${payment}</p>

    ${data.notes ? `<h2 style="margin: 24px 0 8px; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; color: #059669;">Notes</h2><p style="margin: 0; font-size: 14px; color: #374151; white-space: pre-wrap;">${data.notes}</p>` : ""}
  `
  return shell("Nouvelle commande LCG", "Commande", inner)
}

function buildReservationHtml(data: ReservationMailData): string {
  const sourceLabel = data.source === "OPERATOR" ? "Saisie opérateur (plateforme)" : "Site web (réservation en ligne)"
  const inner = `
    <h1 style="margin: 0; font-size: 22px; color: #111827;">Nouvelle réservation</h1>
    <p style="margin: 6px 0 0; font-size: 14px; color: #6b7280;">Reçue le ${formatDate(data.createdAt)} · Provenance : ${sourceLabel}</p>

    <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 14px 18px; margin-top: 18px;">
      <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #059669; font-weight: 700;">Référence</div>
      <div style="font-size: 20px; font-weight: 800; color: #047857; margin-top: 2px;">${data.ref}</div>
    </div>

    <h2 style="margin: 24px 0 8px; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; color: #059669;">Client</h2>
    <table style="width: 100%; border-collapse: collapse;">
      ${infoRow("Nom", data.client)}
      ${infoRow("Téléphone", data.telephone)}
      ${infoRow("Email", data.email)}
    </table>

    <h2 style="margin: 24px 0 8px; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; color: #059669;">Détails de la réservation</h2>
    <table style="width: 100%; border-collapse: collapse;">
      ${infoRow("Type", data.type)}
      ${infoRow("Date", data.date)}
      ${infoRow("Heure", data.heure)}
      ${infoRow("Lieu", data.address)}
    </table>

    <h2 style="margin: 24px 0 8px; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; color: #059669;">Articles réservés</h2>
    ${itemsTable(data.items)}

    ${data.notes ? `<h2 style="margin: 24px 0 8px; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; color: #059669;">Notes</h2><p style="margin: 0; font-size: 14px; color: #374151; white-space: pre-wrap;">${data.notes}</p>` : ""}
  `
  return shell("Nouvelle réservation LCG", "Réservation", inner)
}

function getTransporter(): Transporter {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER || "",
      pass: process.env.SMTP_PASS || "",
    },
  })
}

export async function sendOrderEmail(data: OrderMailData): Promise<boolean> {
  try {
    await getTransporter().sendMail({
      from: `"LCG Site" <${process.env.SMTP_USER || "noreply@lcg.cg"}>`,
      to: MAIL_TO,
      subject: `Nouvelle commande ${data.orderNumber} — ${data.customerName}`,
      html: buildOrderHtml(data),
    })
    return true
  } catch (error) {
    console.error("Échec envoi email commande:", error)
    return false
  }
}

export async function sendReservationEmail(data: ReservationMailData): Promise<boolean> {
  try {
    await getTransporter().sendMail({
      from: `"LCG Site" <${process.env.SMTP_USER || "noreply@lcg.cg"}>`,
      to: MAIL_TO,
      subject: `Nouvelle réservation ${data.ref} — ${data.client} (${data.date} ${data.heure})`,
      html: buildReservationHtml(data),
    })
    return true
  } catch (error) {
    console.error("Échec envoi email réservation:", error)
    return false
  }
}

export interface ReservationConfirmedMailData {
  ref: string
  orderNumber: string
  client: string
  telephone: string
  email: string
  date: string
  heure: string
  address: string
  items: OrderMailItem[]
  total: number
}

function buildReservationConfirmedHtml(data: ReservationConfirmedMailData): string {
  const inner = `
    <h1 style="margin: 0; font-size: 22px; color: #111827;">Votre pré-commande est confirmée</h1>
    <p style="margin: 6px 0 0; font-size: 14px; color: #6b7280;">Bonjour ${data.client}, votre réservation a été validée par notre équipe.</p>

    <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 14px 18px; margin-top: 18px;">
      <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #059669; font-weight: 700;">Référence réservation</div>
      <div style="font-size: 18px; font-weight: 800; color: #047857; margin-top: 2px;">${data.ref}</div>
    </div>

    <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 14px 18px; margin-top: 12px;">
      <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #2563eb; font-weight: 700;">Commande liée</div>
      <div style="font-size: 18px; font-weight: 800; color: #1d4ed8; margin-top: 2px;">${data.orderNumber}</div>
    </div>

    <h2 style="margin: 24px 0 8px; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; color: #059669;">Détails</h2>
    <table style="width: 100%; border-collapse: collapse;">
      ${infoRow("Date de livraison", data.date)}
      ${infoRow("Heure souhaitée", data.heure || "—")}
      ${infoRow("Lieu", data.address)}
    </table>

    <h2 style="margin: 24px 0 8px; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; color: #059669;">Articles</h2>
    ${itemsTable(data.items)}

    <table style="width: 100%; margin-top: 16px;">
      <tr>
        <td style="padding-top: 10px; font-size: 16px; font-weight: 800; color: #111827;">TOTAL</td>
        <td style="padding-top: 10px; font-size: 18px; font-weight: 800; color: #059669; text-align: right;">${formatPrice(data.total)}</td>
      </tr>
    </table>

    <p style="margin-top: 20px; font-size: 14px; color: #374151;">
      Notre équipe vous contactera très vite pour confirmer le créneau de livraison et le mode de paiement.
    </p>
  `
  return shell("Pré-commande confirmée LCG", "Pré-commande confirmée", inner)
}

export async function sendReservationConfirmedEmail(data: ReservationConfirmedMailData): Promise<boolean> {
  if (!data.email) return false
  try {
    await getTransporter().sendMail({
      from: `"LCG Site" <${process.env.SMTP_USER || "noreply@lcg.cg"}>`,
      to: data.email,
      subject: `Pré-commande confirmée ${data.ref} — ${data.client}`,
      html: buildReservationConfirmedHtml(data),
    })
    return true
  } catch (error) {
    console.error("Échec envoi email confirmation réservation:", error)
    return false
  }
}

function buildVerificationHtml(verifyUrl: string): string {
  const inner = `
    <h1 style="margin: 0; font-size: 22px; color: #111827;">Vérifiez votre adresse email</h1>
    <p style="margin: 8px 0 0; font-size: 14px; color: #6b7280;">
      Merci pour votre inscription sur <strong>LCG Clients</strong>. Pour activer votre compte, veuillez cliquer sur le bouton ci-dessous.
    </p>

    <div style="text-align: center; margin: 28px 0;">
      <a href="${verifyUrl}" style="display: inline-block; background: linear-gradient(135deg, #0f766e, #059669); color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 700; padding: 14px 36px; border-radius: 10px; letter-spacing: 0.3px;">
        Vérifier mon email
      </a>
    </div>

    <p style="margin: 0; font-size: 13px; color: #9ca3af;">
      Ce lien est valable pendant 24 heures. Si vous n'avez pas créé de compte, vous pouvez ignorer cet email.
    </p>
  `
  return shell("Vérification email LCG Clients", "Vérification", inner)
}

export async function sendVerificationEmail(email: string, token: string, baseUrl: string): Promise<boolean> {
  try {
    const verifyUrl = `${baseUrl}/auth/verification?token=${token}`
    await getTransporter().sendMail({
      from: `"LCG Clients" <${process.env.SMTP_USER || "noreply@lcg.cg"}>`,
      to: email,
      subject: "Vérifiez votre adresse email — LCG Clients",
      html: buildVerificationHtml(verifyUrl),
    })
    return true
  } catch (error) {
    console.error("Échec envoi email vérification:", error)
    return false
  }
}

function buildPasswordResetHtml(resetUrl: string): string {
  const inner = `
    <h1 style="margin: 0; font-size: 22px; color: #111827;">Réinitialisation du mot de passe</h1>
    <p style="margin: 8px 0 0; font-size: 14px; color: #6b7280;">
      Vous avez demandé la réinitialisation de votre mot de passe sur <strong>LCG Clients</strong>.
    </p>

    <div style="text-align: center; margin: 28px 0;">
      <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #0f766e, #059669); color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 700; padding: 14px 36px; border-radius: 10px; letter-spacing: 0.3px;">
        Réinitialiser mon mot de passe
      </a>
    </div>

    <p style="margin: 0; font-size: 13px; color: #9ca3af;">
      Ce lien est valable pendant 1 heure. Si vous n'avez pas demandé cette réinitialisation, vous pouvez ignorer cet email.
    </p>
  `
  return shell("Réinitialisation mot de passe LCG Clients", "Mot de passe", inner)
}

export async function sendPasswordResetEmail(email: string, token: string, baseUrl: string): Promise<boolean> {
  try {
    const resetUrl = `${baseUrl}/auth/reset-password?token=${token}`
    await getTransporter().sendMail({
      from: `"LCG Clients" <${process.env.SMTP_USER || "noreply@lcg.cg"}>`,
      to: email,
      subject: "Réinitialisation du mot de passe — LCG Clients",
      html: buildPasswordResetHtml(resetUrl),
    })
    return true
  } catch (error) {
    console.error("Échec envoi email réinitialisation:", error)
    return false
  }
}
