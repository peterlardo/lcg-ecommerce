import { cache } from "react"
import { PrismaClient } from "@prisma/client"
import { PrismaNeon } from "@prisma/adapter-neon"
import { neonConfig } from "@neondatabase/serverless"
import { getCloudflareContext } from "@opennextjs/cloudflare"

// Node (local dev): TCP driver via @prisma/adapter-pg — persistent connection
// pool, far lower latency per query than the Neon HTTP driver.
// Workers (production): Hyperdrive + @prisma/adapter-pg — Hyperdrive proxies
// Postgres over TCP (Cloudflare-edge sockets), avoiding outbound WebSockets to
// external hosts (blocked on the edge) AND retaining interactive transactions.
// Falls back to Neon HTTP mode (poolQueryViaFetch) without the binding.
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

function createPgClient(connectionString: string): PrismaClient {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Pool } = require("pg") as typeof import("pg")
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaPg } = require("@prisma/adapter-pg") as typeof import("@prisma/adapter-pg")
  const pool = new Pool({
    connectionString,
    max: 10,
    ssl: { rejectUnauthorized: false },
  })
  const adapter = new PrismaPg(pool)
  return new PrismaClient({ adapter, transactionOptions: { maxWait: 5000, timeout: 15000 } })
}

function createHyperdriveClient(): PrismaClient {
  const { env } = getCloudflareContext()
  const binding = (env as { HYPERDRIVE?: { connectionString: string } }).HYPERDRIVE
  if (!binding?.connectionString) {
    return createNeonClient()
  }
  return createPgClient(binding.connectionString)
}

function createNeonClient(): PrismaClient {
  // Works only via HTTP on Cloudflare Workers (WS outbound unsupported).
  neonConfig.poolQueryViaFetch = true
  const adapter = new PrismaNeon({ connectionString: pooledUrl() })
  return new PrismaClient({ adapter, transactionOptions: { maxWait: 5000, timeout: 15000 } })
}

function createNodeClient(): PrismaClient {
  return createPgClient(directUrl())
}

function isNodeRuntime(): boolean {
  // nodejs_compat in Workerd also defines process.versions.node, so detect the
  // Cloudflare context symbol (defined only in the Workers entrypoint init.js).
  const cfContext = typeof globalThis !== "undefined"
    && Object.getOwnPropertyDescriptor(globalThis, Symbol.for("__cloudflare-context__")) !== undefined
  if (cfContext) {
    return false
  }
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
  : cache(() => createHyperdriveClient())