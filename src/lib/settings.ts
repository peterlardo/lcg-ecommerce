import type { Prisma } from "@prisma/client"
import { getPrisma } from "./prisma"

// ─── RÉGLAGES DE L'ADMINISTRATION (écran Paramètres) ─────────────
// Une ligne de la table AppSetting par rubrique. Avant, l'écran écrivait dans data/settings.json,
// que Cloudflare Workers ne conserve pas : rien n'était jamais enregistré.

export interface GeneralSettings {
  companyName: string
  email: string
  phone: string
  address: string
  website: string
  /** mentions légales imprimées en pied des documents (forme, capital, RCCM, NIU) */
  legal: string
}

export interface DeliverySettings {
  deliveryFee: number
  freeDeliveryThreshold: number
  zones: string[]
}

export interface PaymentSettings {
  card: boolean
  mobileMoney: boolean
  cod: boolean
}

export interface NotificationSettings {
  newOrder: boolean
  deliveryUpdate: boolean
  lowStock: boolean
  newRegistration: boolean
}

/** Coordonnées de règlement imprimées sur les factures. Vides tant que l'administrateur ne les a pas saisies. */
export interface BankSettings {
  bankName: string
  accountHolder: string
  /** RIB ou IBAN */
  accountNumber: string
  mtnMoney: string
  airtelMoney: string
  /** consigne libre (ex. « indiquer le n° de facture en libellé ») */
  instructions: string
}

/** Points de vente sur lesquels les commerciaux et le responsable commercial enregistrent leurs commandes. */
export interface CommercialSettings {
  pointOfSaleIds: string[]
}

export interface AppSettings {
  general: GeneralSettings
  delivery: DeliverySettings
  payment: PaymentSettings
  notifications: NotificationSettings
  bank: BankSettings
  commercial: CommercialSettings
}

export type SettingsSection = keyof AppSettings
export const SETTINGS_SECTIONS: SettingsSection[] = ["general", "delivery", "payment", "notifications", "bank", "commercial"]

/** Valeurs en vigueur tant que rien n'est enregistré : celles imprimées jusqu'ici sur les documents. */
export const DEFAULT_SETTINGS: AppSettings = {
  general: {
    companyName: "LCG — La Congolaise des Glaçons",
    email: "contact@lcg.cg",
    phone: "+242 06 739 49 49 · +242 05 607 91 91",
    address: "97 Rue EWO, Ouenzé — Brazzaville, République du Congo",
    website: "https://lcg.cg",
    legal: "SARL au capital de 1 000 000 FCFA — RCCM : CG-BZV-01-2025-B12-00-146 — NIU : M250000007225623",
  },
  // frais à 0 tant que l'administrateur ne les a pas fixés : c'est ce que la boutique applique aujourd'hui
  delivery: { deliveryFee: 0, freeDeliveryThreshold: 0, zones: [] },
  payment: { card: true, mobileMoney: true, cod: true },
  notifications: { newOrder: true, deliveryUpdate: true, lowStock: false, newRegistration: true },
  bank: { bankName: "", accountHolder: "", accountNumber: "", mtnMoney: "", airtelMoney: "", instructions: "" },
  commercial: { pointOfSaleIds: [] },
}

const text = (value: unknown, fallback: string, max = 300) => (typeof value === "string" ? value.trim().slice(0, max) : fallback)
const amount = (value: unknown, fallback: number) => {
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : fallback
}
const flag = (value: unknown, fallback: boolean) => (typeof value === "boolean" ? value : fallback)

/**
 * Nettoie une rubrique reçue de l'écran (ou lue en base) : champs connus seulement, types forcés,
 * valeur courante gardée pour tout champ absent ou invalide.
 */
export function sanitizeSection<K extends SettingsSection>(section: K, raw: unknown, current: AppSettings[K]): AppSettings[K] {
  const v = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
  switch (section) {
    case "general": {
      const c = current as GeneralSettings
      return {
        companyName: text(v.companyName, c.companyName, 120) || c.companyName,
        email: text(v.email, c.email, 120),
        phone: text(v.phone, c.phone, 120),
        address: text(v.address, c.address, 200),
        website: text(v.website, c.website, 120),
        legal: text(v.legal, c.legal, 300),
      } as AppSettings[K]
    }
    case "delivery": {
      const c = current as DeliverySettings
      const zones = Array.isArray(v.zones) ? v.zones.filter((z): z is string => typeof z === "string" && z.trim() !== "").map((z) => z.trim().slice(0, 80)).slice(0, 50) : c.zones
      return { deliveryFee: amount(v.deliveryFee, c.deliveryFee), freeDeliveryThreshold: amount(v.freeDeliveryThreshold, c.freeDeliveryThreshold), zones } as AppSettings[K]
    }
    case "payment": {
      const c = current as PaymentSettings
      return { card: flag(v.card, c.card), mobileMoney: flag(v.mobileMoney, c.mobileMoney), cod: flag(v.cod, c.cod) } as AppSettings[K]
    }
    case "notifications": {
      const c = current as NotificationSettings
      return {
        newOrder: flag(v.newOrder, c.newOrder),
        deliveryUpdate: flag(v.deliveryUpdate, c.deliveryUpdate),
        lowStock: flag(v.lowStock, c.lowStock),
        newRegistration: flag(v.newRegistration, c.newRegistration),
      } as AppSettings[K]
    }
    case "bank": {
      const c = current as BankSettings
      return {
        bankName: text(v.bankName, c.bankName, 120),
        accountHolder: text(v.accountHolder, c.accountHolder, 120),
        accountNumber: text(v.accountNumber, c.accountNumber, 80),
        mtnMoney: text(v.mtnMoney, c.mtnMoney, 40),
        airtelMoney: text(v.airtelMoney, c.airtelMoney, 40),
        instructions: text(v.instructions, c.instructions, 300),
      } as AppSettings[K]
    }
    case "commercial": {
      const c = current as CommercialSettings
      const ids = Array.isArray(v.pointOfSaleIds)
        ? [...new Set(v.pointOfSaleIds.filter((x): x is string => typeof x === "string" && x.length > 0 && x.length < 64))].slice(0, 20)
        : c.pointOfSaleIds
      return { pointOfSaleIds: ids } as AppSettings[K]
    }
  }
  return current
}

/** Tous les réglages : valeurs enregistrées, complétées par les valeurs par défaut. */
export async function getSettings(): Promise<AppSettings> {
  const rows = await getPrisma().appSetting.findMany({ where: { key: { in: SETTINGS_SECTIONS } } })
  const out: AppSettings = structuredClone(DEFAULT_SETTINGS)
  for (const row of rows) {
    const key = row.key as SettingsSection
    // une valeur enregistrée sous une forme ancienne ne casse rien : les champs inconnus sont ignorés
    ;(out as unknown as Record<string, unknown>)[key] = sanitizeSection(key, row.value, DEFAULT_SETTINGS[key])
  }
  return out
}

/** Enregistre une rubrique ; renvoie la valeur retenue. */
export async function saveSection<K extends SettingsSection>(section: K, raw: unknown, userId: string | null): Promise<AppSettings[K]> {
  const current = (await getSettings())[section]
  const value = sanitizeSection(section, raw, current)
  const json = value as unknown as Prisma.InputJsonValue
  await getPrisma().appSetting.upsert({
    where: { key: section },
    create: { key: section, value: json, updatedById: userId },
    update: { value: json, updatedById: userId },
  })
  return value
}

/** Points de vente actifs des commerciaux (réglage « Points de vente des commerciaux »), dans l'ordre du réglage. */
export async function commercialPointsOfSale(): Promise<{ id: string; name: string; code: string }[]> {
  const { commercial } = await getSettings()
  if (commercial.pointOfSaleIds.length === 0) return []
  const points = await getPrisma().pointOfSale.findMany({
    where: { id: { in: commercial.pointOfSaleIds }, isActive: true },
    select: { id: true, name: true, code: true },
  })
  return commercial.pointOfSaleIds.map((pid) => points.find((p) => p.id === pid)).filter((p): p is { id: string; name: string; code: string } => Boolean(p))
}

/** En-tête et pied des documents imprimés ou envoyés (devis, bons, factures). */
export function documentCompany(general: GeneralSettings) {
  const site = general.website.replace(/^https?:\/\//, "").replace(/\/$/, "")
  return {
    name: general.companyName,
    address: general.address,
    phones: general.phone,
    contact: [site, general.email].filter(Boolean).join(" · "),
    legal: general.legal,
  }
}

/** Les coordonnées de règlement ont-elles été saisies ? */
export function hasBankDetails(bank: BankSettings): boolean {
  return Boolean(bank.accountNumber || bank.mtnMoney || bank.airtelMoney)
}
