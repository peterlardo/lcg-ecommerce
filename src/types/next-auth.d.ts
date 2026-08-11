import { DefaultSession } from "next-auth"

type Role = "ADMIN" | "STOCK_MANAGER" | "DELIVERY_AGENT" | "CUSTOMER"
type SessionPermission = { module: string; canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean }

declare module "next-auth" {
  interface User {
    role?: Role
  }
  interface Session {
    user: {
      id: string
      role: Role
      permissions: SessionPermission[]
    } & DefaultSession["user"]
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: Role
    id: string
    permissions?: SessionPermission[]
  }
}
