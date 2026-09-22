import { cache } from "react"
import { PrismaClient } from "@prisma/client"
import { PrismaNeon } from "@prisma/adapter-neon"

// Node (local dev): TCP driver via @prisma/adapter-pg — persistent connection
// pool, far lower latency per query than the Neon HTTP driver.
// Workers (production): HTTP driver — no persistent sockets, immune to
// dead-connection hangs on Workers. Pooled endpoint (-pooler) required for
// interactive transactions over HTTP.
function pooledUrl(): string {
  const url = new URL(process.env.DATABASE_URL!)
  url.hostname = url.hostname.replace(/^(ep-[^.]+)\./, "$1-pooler.")
  return url.toString()
}

function directUrl(): string {
  const url = new URL(process.env.DATABASE_URL!)
  url.hostname = url.hostname.replace(/-pooler\./, ".")
  return url.toString()
}

function createNeonClient(): PrismaClient {
  const adapter = new PrismaNeon({ connectionString: pooledUrl() })
  return new PrismaClient({ adapter, transactionOptions: { maxWait: 5000, timeout: 15000 } })
}

function createNodeClient(): PrismaClient {
  // Lazy require (Node only): keeps pg out of the Workers bundle.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaPg } = require("@prisma/adapter-pg") as typeof import("@prisma/adapter-pg")
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Pool } = require("pg") as typeof import("pg")
  const pool = new Pool({
    connectionString: directUrl(),
    max: 10,
    ssl: { rejectUnauthorized: false },
  })
  const adapter = new PrismaPg(pool)
  return new PrismaClient({ adapter, transactionOptions: { maxWait: 5000, timeout: 15000 } })
}

function isNodeRuntime(): boolean {
  return typeof process !== "undefined" && typeof process.versions?.node === "string"
}

const nodeGlobal = globalThis as unknown as { lcgPrisma?: PrismaClient }

export const getPrisma = isNodeRuntime()
  ? () => {
      if (!nodeGlobal.lcgPrisma) {
        nodeGlobal.lcgPrisma = createNodeClient()
      }
      return nodeGlobal.lcgPrisma
    }
  : cache(() => createNeonClient())