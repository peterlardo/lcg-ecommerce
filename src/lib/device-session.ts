import { getPrisma } from "./prisma"
import { deviceFingerprint } from "./device"

// ─── UNE SEULE SESSION OUVERTE PAR COMPTE ─────────────────────
// Un compte déjà ouvert sur un appareil ne peut pas être ouvert sur un autre.
// La session se libère à la déconnexion, après SESSION_IDLE_MS sans activité
// (appareil éteint sans déconnexion), ou quand un administrateur la libère.

/** Au-delà de ce délai sans activité, la session ne bloque plus une connexion ailleurs. */
export const SESSION_IDLE_MS = 30 * 60 * 1000
/** L'heure de dernière activité est rafraîchie au plus une fois par ce délai. */
export const SESSION_TOUCH_MS = 2 * 60 * 1000

/** Code renvoyé à l'écran de connexion quand le compte est déjà ouvert ailleurs. */
export const SESSION_OPEN_CODE = "session_ouverte"

const DEVICE_PREFIX = "dev:"

/**
 * Empreinte de l'appareil. L'identifiant tiré au hasard par le navigateur distingue deux appareils
 * du même modèle ; à défaut (ancienne session, appel sans identifiant) on retombe sur le navigateur.
 */
export function deviceKey(deviceId: unknown, userAgent: string | null | undefined): string {
  const id = typeof deviceId === "string" ? deviceId.trim() : ""
  return /^[A-Za-z0-9-]{16,64}$/.test(id) ? DEVICE_PREFIX + id : deviceFingerprint(userAgent)
}

/**
 * Session encore ouverte sur un AUTRE appareil, ou null.
 * Une ancienne session (sans identifiant d'appareil) du même navigateur est considérée comme le même appareil.
 */
export async function openSessionElsewhere(userId: string, fingerprint: string, userAgent: string | null | undefined) {
  const sameDevice = [fingerprint, deviceFingerprint(userAgent)]
  return getPrisma().userDeviceSession.findFirst({
    where: {
      userId,
      isActive: true,
      fingerprint: { notIn: sameDevice },
      lastActiveAt: { gt: new Date(Date.now() - SESSION_IDLE_MS) },
    },
    orderBy: { lastActiveAt: "desc" },
  })
}

/**
 * Nombre de sessions encore ouvertes sur un AUTRE appareil (dans la fenêtre d'inactivité).
 * Sert à faire respecter la limite de connexions simultanées d'un compte partagé.
 */
export async function countActiveSessionsElsewhere(userId: string, fingerprint: string, userAgent: string | null | undefined): Promise<number> {
  const sameDevice = [fingerprint, deviceFingerprint(userAgent)]
  return getPrisma().userDeviceSession.count({
    where: {
      userId,
      isActive: true,
      fingerprint: { notIn: sameDevice },
      lastActiveAt: { gt: new Date(Date.now() - SESSION_IDLE_MS) },
    },
  })
}

/** Ferme toutes les sessions du compte, sauf celle de l'appareil indiqué. Renvoie le nombre de sessions fermées. */
export async function closeUserSessions(userId: string, exceptFingerprint?: string): Promise<number> {
  const { count } = await getPrisma().userDeviceSession.updateMany({
    where: { userId, isActive: true, ...(exceptFingerprint ? { fingerprint: { not: exceptFingerprint } } : {}) },
    data: { isActive: false },
  })
  return count
}

/** Session réellement ouverte : active et vue depuis moins de SESSION_IDLE_MS. */
export function isSessionOpen(session: { isActive: boolean; lastActiveAt: Date }): boolean {
  return session.isActive && Date.now() - session.lastActiveAt.getTime() < SESSION_IDLE_MS
}
