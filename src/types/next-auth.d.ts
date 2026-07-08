import { DefaultSession, DefaultUser } from "next-auth"

type Role = "ADMIN" | "STOCK_MANAGER" | "DELIVERY_AGENT" | "CUSTOMER"

declare module "next-auth" {
  interface User {
    role?: Role
  }
  interface Session {
    user: {
      id: string
      role: Role
    } & DefaultSession["user"]
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: Role
    id: string
  }
}
