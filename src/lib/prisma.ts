import { PrismaClient } from "@/generated/prisma/client"

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient(): PrismaClient {
  try {
    const { Pool } = require("pg")
    const { PrismaPg } = require("@prisma/adapter-pg")
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5, connectionTimeoutMillis: 30000, idleTimeoutMillis: 30000, keepAlive: true })
    const adapter = new PrismaPg(pool)
    return new PrismaClient({ adapter, transactionOptions: { timeout: 20000 } } as any)
  } catch {
    return new PrismaClient({ transactionOptions: { timeout: 20000 } } as any)
  }
}

const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma

export { prisma }

