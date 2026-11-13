// Serves pdf.js's worker as a static file; bundling it through webpack breaks minification.
import { copyFileSync, mkdirSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)
const pkgDir = dirname(require.resolve('pdfjs-dist/package.json'))
const from = join(pkgDir, 'build', 'pdf.worker.min.mjs')
if (!existsSync(from)) throw new Error(`pdf.js worker not found at ${from}`)
mkdirSync('public', { recursive: true })
copyFileSync(from, join('public', 'pdf.worker.min.mjs'))
