import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import bcrypt from "bcryptjs"
import { getPrisma } from "./prisma"

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
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const user = await getPrisma().user.findUnique({
          where: { email: credentials.email as string },
        })

        if (!user || !user.password || !user.isActive) return null

        const STAFF_ROLES = ["ADMIN", "STOCK_MANAGER", "DELIVERY_AGENT"]
        if (!STAFF_ROLES.includes(user.role) && !user.emailVerified) return null

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.password
        )

        if (!isValid) return null

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          role: user.role as Role,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role as Role
        token.id = user.id
      }
      if (token.id) {
        token.permissions = await getPrisma().userPermission.findMany({ where: { userId: token.id as string }, select: { module: true, canView: true, canCreate: true, canEdit: true, canDelete: true } })
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role as Role
        session.user.id = token.id as string
        session.user.permissions = (token.permissions || []) as { module: string; canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean }[]
      }
      return session
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







