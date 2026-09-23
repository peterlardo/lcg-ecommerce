import { DefaultSession } from "next-auth"

type Role = string
type SessionPermission = { module: string; canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean }

declare module "next-auth" {
  interface User {
    role?: Role
    sessionId?: string
  }
  interface Session {
    user: {
      id: string
      role: Role
      permissions: SessionPermission[]
      sessionId?: string
    } & DefaultSession["user"]
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: Role
    id: string
    permissions?: SessionPermission[]
    sessionId?: string
  }
}
