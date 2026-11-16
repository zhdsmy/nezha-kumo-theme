import assert from "node:assert/strict"
import { readFileSync, statSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { gzipSync } from "node:zlib"

const dist = new URL("../dist/", import.meta.url)
const manifest = JSON.parse(readFileSync(new URL(".vite/manifest.json", dist), "utf8"))
const entries = Object.entries(manifest).filter(([, value]) => value.isEntry)
assert.equal(entries.length, 1, "Expected one frontend entry")
const files = new Set()
function visit(key) {
    const chunk = manifest[key]
    assert(chunk, `Missing manifest chunk ${key}`)
    if (files.has(chunk.file)) return
    files.add(chunk.file)
    for (const dependency of chunk.imports ?? []) visit(dependency)
}
visit(entries[0][0])
const chunks = [...files]
    .filter((file) => file.endsWith(".js"))
    .map((file) => {
        const content = readFileSync(new URL(file, dist))
        return { file, bytes: statSync(new URL(file, dist)).size, gzip: gzipSync(content).length }
    })
const gzip = chunks.reduce((sum, chunk) => sum + chunk.gzip, 0)
const result = { budget: 260_000, gzip, chunks }
writeFileSync(new URL("size-report.json", dist), JSON.stringify(result, null, 2) + "\n")
console.log(
    `Homepage JS: ${gzip} bytes gzip / ${result.budget} bytes (${(gzip / 1000).toFixed(2)} KB). ${chunks.length} static chunks.`,
)
assert(gzip <= result.budget, `Homepage JavaScript exceeds 260 KB gzip: ${gzip}`)
assert(
    chunks.every((chunk) =>
        fileURLToPath(new URL(chunk.file, dist)).startsWith(fileURLToPath(dist)),
    ),
    "Asset outside dist",
)
