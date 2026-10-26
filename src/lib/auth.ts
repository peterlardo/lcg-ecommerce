import NextAuth, { CredentialsSignin } from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import bcrypt from "bcryptjs"
import { getPrisma } from "./prisma"
import { parseUserAgent } from "./device"
import { correctStaffEmail } from "./email-typo"
import { COMMERCIAL_MANAGER_ROLE, isStaffRole } from "./permissions"
import { SESSION_OPEN_CODE, closeUserSessions, countActiveSessionsElsewhere, deviceKey } from "./device-session"

type Role = string

/** Connexion refusée : le compte est déjà ouvert sur un autre appareil. */
class SessionOpenError extends CredentialsSignin {
  code = SESSION_OPEN_CODE
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(getPrisma()),
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/auth/connexion",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
        deviceId: { label: "Appareil", type: "text" },
        takeover: { label: "Reprendre la session", type: "text" },
      },
      async authorize(credentials, request) {
        if (!credentials?.email || !credentials?.password) return null

        const clientInfo = parseUserAgent(request?.headers.get("user-agent") ?? "")
        const userAgent = request?.headers.get("user-agent") ?? null
        const ip =
          (request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim()?.slice(0, 45) ||
            request?.headers.get("cf-connecting-ip")) ?? null

        // Majuscules (clavier de téléphone) et espaces ne comptent pas ; un domaine proche (lcg.cgt, lcg.com) est corrigé.
        // Le mot de passe reste exigé : la correction ne donne aucun accès.
        const typed = String(credentials.email).trim().toLowerCase()
        const findByEmail = (address: string) =>
          getPrisma().user.findFirst({ where: { email: { equals: address, mode: "insensitive" } } })
        let user = await findByEmail(typed)
        if (!user) {
          const corrected = correctStaffEmail(typed)
          if (corrected) user = await findByEmail(corrected)
        }

        // Personnel = tout rôle autre que client (caissier, commercial, comptable, profils créés par l'administrateur…) :
        // ces comptes sont créés par un administrateur, leur e-mail n'a pas à être vérifié.
        // Seuls les clients inscrits en ligne doivent confirmer leur e-mail.
        const isStaff = user ? isStaffRole(user.role) : false
        const nonStaffValid = user ? !isStaffRole(user.role) && !!user.emailVerified : false

        if (!user || !user.password || !user.isActive || (!isStaff && !nonStaffValid)) {
          await getPrisma().loginLog.create({
            data: {
              email: String(credentials.email),
              status: "FAILED",
              method: "PASSWORD",
              deviceName: clientInfo.deviceName,
              deviceType: clientInfo.deviceType,
              ip,
            },
          }).catch(() => {})
          return null
        }

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.password
        )

        if (!isValid) {
          await getPrisma().loginLog.create({
            data: {
              userId: user.id,
              email: user.email,
              status: "FAILED",
              method: "PASSWORD",
              deviceName: clientInfo.deviceName,
              deviceType: clientInfo.deviceType,
              ip,
            },
          }).catch(() => {})
          return null
        }

        // Limite de sessions simultanées du compte (1 par défaut). Un compte partagé
        // (ex. un poste de caisse utilisé par deux personnes) peut être autorisé à en ouvrir plusieurs.
        const fingerprint = deviceKey(credentials.deviceId, userAgent)
        const sessionLimit = Math.max(1, user.sessionLimit || 1)
        const othersOpen = await countActiveSessionsElsewhere(user.id, fingerprint, userAgent)
        // Reprise volontaire (mot de passe déjà vérifié) : l'autre poste est déconnecté au lieu de bloquer cette connexion
        const takeover = credentials.takeover === "1"
        if (othersOpen >= sessionLimit && !takeover) {
          await getPrisma().loginLog.create({
            data: {
              userId: user.id,
              email: user.email,
              status: "BLOCKED",
              method: "PASSWORD",
              deviceName: clientInfo.deviceName,
              deviceType: clientInfo.deviceType,
              ip,
              userAgent,
            },
          }).catch(() => {})
          throw new SessionOpenError()
        }
        // Comportement historique (une seule session) : les sessions des autres appareils
        // sont fermées. Au-delà d'une session autorisée, on les laisse ouvertes.
        if (sessionLimit <= 1 || takeover) {
          await closeUserSessions(user.id, fingerprint)
        }

        let deviceSession = await getPrisma().userDeviceSession.findUnique({
          where: { userId_fingerprint: { userId: user.id, fingerprint } },
        })
        if (!deviceSession) {
          deviceSession = await getPrisma().userDeviceSession.create({
            data: {
              userId: user.id,
              sessionId: crypto.randomUUID(),
              fingerprint,
              deviceName: clientInfo.deviceName,
              deviceType: clientInfo.deviceType,
              ip,
              userAgent,
              lastActiveAt: new Date(),
            },
          })
        } else {
          deviceSession = await getPrisma().userDeviceSession.update({
            where: { id: deviceSession.id },
            data: {
              deviceName: clientInfo.deviceName,
              deviceType: clientInfo.deviceType,
              ip,
              userAgent,
              lastActiveAt: new Date(),
              isActive: true,
            },
          })
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          role: user.role as Role,
          sessionId: deviceSession.sessionId,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role as Role
        token.id = user.id
        token.sessionId = (user as { sessionId?: string }).sessionId
        token.permissions = await getPrisma().userPermission.findMany({ where: { userId: user.id as string }, select: { module: true, canView: true, canCreate: true, canEdit: true, canDelete: true } })
        token.authorAt = Date.now()
        return token
      }
      if (token.id) {
        try {
          const fresh = await getPrisma().user.findUnique({
            where: { id: token.id as string },
            select: {
              updatedAt: true,
              role: true,
              isActive: true,
              deviceSessions: { where: { sessionId: token.sessionId ?? "" }, select: { id: true, isActive: true, lastActiveAt: true } },
            },
          })
          if (fresh && token.sessionId) {
            const device = fresh.deviceSessions[0]
            // Session fermée (déconnexion, libération par un administrateur, connexion ailleurs après inactivité)
            if (!device || !device.isActive) return null
            // La dernière activité n'est PAS rafraîchie ici : les relectures automatiques ne prouvent pas une présence (voir /api/session-ping)
          }
          const freshAt = fresh ? fresh.updatedAt.getTime() : null
          if (fresh && (!token.authorAt || freshAt !== token.authorAt)) {
            token.role = fresh.role as Role
            token.permissions = await getPrisma().userPermission.findMany({ where: { userId: token.id as string }, select: { module: true, canView: true, canCreate: true, canEdit: true, canDelete: true } })
            token.authorAt = freshAt
          }
          if (fresh && !fresh.isActive) token.role = "DISABLED" as Role
        } catch {
          // Garde le token existant si la base est temporairement indisponible
        }
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role as Role
        session.user.id = token.id as string
        session.user.sessionId = token.sessionId as string | undefined
        // le responsable commercial supervise tout le portefeuille B2B
        session.user.supervisesB2b = token.role === COMMERCIAL_MANAGER_ROLE
        session.user.permissions = (token.permissions || []) as { module: string; canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean }[]
      }
      return session
    },
  },
  events: {
    async signIn({ user }) {
      if (!user?.id) return
      try {
        const session = await getPrisma().userDeviceSession.findFirst({
          where: { userId: user.id },
          orderBy: { lastActiveAt: "desc" },
          take: 1,
        })
        await getPrisma().loginLog.create({
          data: {
            userId: user.id,
            email: user.email,
            status: "SUCCESS",
            method: "PASSWORD",
            deviceName: session?.deviceName,
            deviceType: session?.deviceType,
            ip: session?.ip,
            userAgent: session?.userAgent,
          },
        })
        await getPrisma().activityLog.create({
          data: {
            userId: user.id,
            module: "auth",
            action: "login",
            entity: "user",
            entityId: user.id,
            summary: "Connexion",
            ip: session?.ip,
            userAgent: session?.userAgent,
          },
        })
      } catch (error) {
        console.error("signIn event error:", error)
      }
    },
    async signOut(params: { token?: unknown; session?: unknown }) {
      try {
        const token = (params as { token?: unknown }).token as { sessionId?: string; email?: string } | null | undefined
        const sessionId = (token as { sessionId?: string } | null)?.sessionId
        const session = sessionId
          ? await getPrisma().userDeviceSession.findUnique({ where: { sessionId } })
          : null
        if (session) {
          await getPrisma().userDeviceSession.update({
            where: { id: session.id },
            data: { isActive: false, lastActiveAt: new Date() },
          })
          await getPrisma().loginLog.create({
            data: {
              userId: session.userId,
              email: (token as { email?: string }).email ?? null,
              status: "LOGOUT",
              method: "PASSWORD",
              deviceName: session.deviceName,
              deviceType: session.deviceType,
              ip: session.ip,
              userAgent: session.userAgent,
            },
          })
          await getPrisma().activityLog.create({
            data: {
              userId: session.userId,
              module: "auth",
              action: "logout",
              entity: "user",
              entityId: session.userId,
              summary: "Déconnexion",
              ip: session.ip,
              userAgent: session.userAgent,
            },
          })
        }
      } catch (error) {
        console.error("signOut event error:", error)
      }
    },
  },
})

export async function getCurrentUser() {
  const session = await auth()
  return session?.user
}

export async function requireAuth(allowedRoles?: Role[]) {
  const user = await getCurrentUser()
  if (!user) throw new Error("Non authentifié")
  if (allowedRoles && !allowedRoles.includes(user.role as Role)) {
    throw new Error("Accès non autorisé")
  }
  return user
}