import { cache } from "react"
import { PrismaClient } from "@prisma/client"
import { PrismaNeon } from "@prisma/adapter-neon"

// HTTP driver: no persistent sockets, immune to dead-connection hangs on Workers.
// Pooled endpoint (-pooler) required for interactive transactions over HTTP.
function pooledUrl(): string {
  const url = new URL(process.env.DATABASE_URL!)
  url.hostname = url.hostname.replace(/^(ep-[^.]+)\./, "$1-pooler.")
  return url.toString()
}

function createClient(): PrismaClient {
  const adapter = new PrismaNeon({ connectionString: pooledUrl() })
  return new PrismaClient({ adapter, transactionOptions: { maxWait: 5000, timeout: 15000 } })
}

// Per-request client — REQUIRED on Cloudflare Workers: sharing one client across
// requests triggers "Cannot perform I/O on behalf of a different request".
export const getPrisma = cache(() => createClient())
