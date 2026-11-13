// Bundles the OCR worker (PaddleOCR on ONNX Runtime, wasm) into a static module worker.
// Next's minifier cannot handle ONNX Runtime's `import.meta` inside worker chunks, so this is built separately.
import { build } from 'esbuild'
import { copyFileSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)
mkdirSync('public/ocr', { recursive: true })

await build({
  entryPoints: ['src/lib/ocrWorker.ts'],
  outfile: 'public/ocr/worker.js',
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  minify: true,
  // CPU build of ONNX Runtime: ~15 MB wasm instead of ~30 MB with WebGPU.
  alias: { 'onnxruntime-web': 'onnxruntime-web/wasm' },
  logLevel: 'warning',
})

// ONNX Runtime looks for its wasm next to the worker script.
const ortDist = dirname(require.resolve('onnxruntime-web/wasm'))
copyFileSync(join(ortDist, 'ort-wasm-simd-threaded.wasm'), 'public/ocr/ort-wasm-simd-threaded.wasm')
