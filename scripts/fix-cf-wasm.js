/**
 * Post-build fix for Prisma WASM on Cloudflare Workers.
 *
 * Problem: Prisma 7.9.1's generated client compiles its query-compiler WASM
 * at runtime via WebAssembly.compile() / new WebAssembly.Module(). workerd
 * (Cloudflare Workers runtime) disallows ALL runtime wasm code generation.
 *
 * The ONLY supported way to use wasm in a Worker is a static/dynamic
 * string-literal `import` of the `.wasm` file: wrangler bundles it as a
 * CompiledWasm module and workerd provides it pre-compiled (default export
 * = WebAssembly.Module).
 *
 * This script runs AFTER `opennextjs-cloudflare build`:
 *   1. Copies query_compiler_fast_bg.wasm next to handler.mjs
 *   2. Patches handler.mjs:
 *      - prepends `import <id> from "./query_compiler_fast_bg.wasm"`
 *      - replaces `return await WebAssembly.compile(queryCompilerWasmFileBytes)`
 *        with `return <id>`
 */
const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')
const serverDir = path.join(root, '.open-next', 'server-functions', 'default')
const handlerPath = path.join(serverDir, 'handler.mjs')
const srcWasm = path.join(root, 'node_modules', '.prisma', 'client', 'query_compiler_fast_bg.wasm')
const destWasm = path.join(serverDir, 'query_compiler_fast_bg.wasm')

if (!fs.existsSync(handlerPath)) {
  console.log('fix-cf-wasm: handler.mjs not found, skipping (run opennextjs-cloudflare build first)')
  process.exit(0)
}

// 1. Copy the .wasm binary next to handler.mjs so wrangler can bundle it
if (fs.existsSync(srcWasm)) {
  fs.copyFileSync(srcWasm, destWasm)
  console.log('fix-cf-wasm: copied query_compiler_fast_bg.wasm ->', path.relative(root, destWasm))
} else if (!fs.existsSync(destWasm)) {
  console.warn('fix-cf-wasm: WARNING - no .wasm found at', srcWasm)
}

// 2. Patch handler.mjs
let content = fs.readFileSync(handlerPath, 'utf8')

const IMPORT_ID = '__prisma_query_compiler_wasm'
const importLine = `import ${IMPORT_ID} from "./query_compiler_fast_bg.wasm";\n`

const compileCall = 'return await WebAssembly.compile(queryCompilerWasmFileBytes)'
const replacement = `return ${IMPORT_ID}`

let changed = false

if (!content.includes(importLine)) {
  content = importLine + content
  changed = true
}

if (content.includes(compileCall)) {
  // Replace ALL occurrences (defensive) of the blocked runtime compilation
  while (content.includes(compileCall)) {
    content = content.replace(compileCall, replacement)
  }
  changed = true
}

if (changed) {
  fs.writeFileSync(handlerPath, content, 'utf8')
  console.log('fix-cf-wasm: patched handler.mjs -> static wasm import instead of WebAssembly.compile()')
} else {
  console.log('fix-cf-wasm: handler.mjs already patched')
}
