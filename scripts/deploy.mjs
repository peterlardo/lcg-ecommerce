/**
 * Cross-platform `npm run deploy`.
 *
 * On Windows, `wrangler deploy` starts an OpenNext platform proxy (miniflare) to
 * resolve bindings and refuses to run without a Hyperdrive local connection
 * string:
 *   UserError: no local hyperdrive connection string
 *
 * Derive it from DATABASE_URL in .env (direct endpoint, `-pooler.` removed) and
 * export it for the child processes, so the URL never has to be committed in
 * wrangler.jsonc.
 */
import { spawnSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const isWindows = process.platform === "win32"

function databaseUrl() {
  const envPath = path.join(root, ".env")
  if (!existsSync(envPath)) return null
  const line = readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .map((entry) => entry.match(/^\s*DATABASE_URL\s*=\s*(.+?)\s*$/))
    .find(Boolean)
  if (!line) return null
  return line[1].replace(/^["']|["']$/g, "")
}

const connectionString = databaseUrl()
if (connectionString) {
  process.env.CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE =
    connectionString.replace("-pooler.", ".")
  console.log("deploy: CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE defini depuis .env")
} else {
  console.warn("deploy: WARNING - DATABASE_URL introuvable dans .env")
}

const steps = [
  ["prisma", ["generate"]],
  ["node", ["scripts/patch-prisma-wasm.js"]],
  ["npx", ["opennextjs-cloudflare", "build"]],
  ["node", ["scripts/fix-cf-wasm.js"]],
  ["npx", ["wrangler", "deploy", "--minify"]],
]

for (const [command, args] of steps) {
  const label = `${command} ${args.join(" ")}`
  console.log(`\n> ${label}`)
  const binary = isWindows && (command === "prisma" || command === "npx") ? `${command}.cmd` : command
  const result = spawnSync(binary, args, {
    cwd: root,
    stdio: "inherit",
    env: process.env,
    shell: isWindows,
  })
  if (result.status !== 0) {
    console.error(`deploy: ECHEC sur "${label}"`)
    process.exit(result.status ?? 1)
  }
}

console.log("deploy: OK")
