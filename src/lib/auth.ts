import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import bcrypt from "bcryptjs"
import { getPrisma } from "./prisma"
import { parseUserAgent, deviceFingerprint } from "./device"

type Role = string

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
      },
      async authorize(credentials, request) {
        if (!credentials?.email || !credentials?.password) return null

        const clientInfo = parseUserAgent(request?.headers.get("user-agent") ?? "")
        const userAgent = request?.headers.get("user-agent") ?? null
        const ip =
          (request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim()?.slice(0, 45) ||
            request?.headers.get("cf-connecting-ip")) ?? null

        const user = await getPrisma().user.findUnique({
          where: { email: credentials.email as string },
        })

        const STAFF_ROLES = ["ADMIN", "STOCK_MANAGER", "DELIVERY_AGENT"]
        const isStaff = user ? STAFF_ROLES.includes(user.role) && user.emailVerified : false
        const nonStaffValid = user ? !STAFF_ROLES.includes(user.role) && !!user.emailVerified : false

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

        const fingerprint = deviceFingerprint(userAgent ?? "")
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
          const fresh = await getPrisma().user.findUnique({ where: { id: token.id as string }, select: { updatedAt: true, role: true, isActive: true } })
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