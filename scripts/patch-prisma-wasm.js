/**
 * Patches Prisma's generated client to use async WebAssembly.compile()
 * instead of synchronous new WebAssembly.Module() which fails on
 * Cloudflare Workers (workerd).
 *
 * Run after `prisma generate`: node scripts/patch-prisma-wasm.js
 */
const fs = require('fs')
const path = require('path')

const target = path.join(__dirname, '..', 'node_modules', '.prisma', 'client', 'index.js')

if (!fs.existsSync(target)) {
  console.log('Patch skipped: .prisma/client/index.js not found')
  process.exit(0)
}

let content = fs.readFileSync(target, 'utf8')

const oldSnippet = 'return new WebAssembly.Module(queryCompilerWasmFileBytes)'
const newSnippet = 'return await WebAssembly.compile(queryCompilerWasmFileBytes)'

if (content.includes(oldSnippet)) {
  content = content.replace(oldSnippet, newSnippet)
  fs.writeFileSync(target, content, 'utf8')
  console.log('Patched Prisma WASM: new WebAssembly.Module() → await WebAssembly.compile()')
} else if (content.includes(newSnippet)) {
  console.log('Prisma WASM already patched')
} else {
  console.warn('Patch target not found in .prisma/client/index.js — manual review needed')
}
