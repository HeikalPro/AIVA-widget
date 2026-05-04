import * as esbuild from 'esbuild'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

const watch = process.argv.includes('--watch')

const external = ['electron', 'keytar']

const buildOpts = {
  bundle: true,
  platform: 'node',
  target: 'node18',
  sourcemap: true,
  external,
  logLevel: 'info',
}

async function build() {
  await esbuild.build({
    ...buildOpts,
    entryPoints: [path.join(root, 'src/electron/main.ts')],
    outfile: path.join(root, 'dist-electron/main.cjs'),
    format: 'cjs',
  })

  await esbuild.build({
    ...buildOpts,
    entryPoints: [path.join(root, 'src/electron/preload.ts')],
    outfile: path.join(root, 'dist-electron/preload.cjs'),
    format: 'cjs',
  })
}

if (watch) {
  const ctxMain = await esbuild.context({
    ...buildOpts,
    entryPoints: [path.join(root, 'src/electron/main.ts')],
    outfile: path.join(root, 'dist-electron/main.cjs'),
    format: 'cjs',
  })
  const ctxPreload = await esbuild.context({
    ...buildOpts,
    entryPoints: [path.join(root, 'src/electron/preload.ts')],
    outfile: path.join(root, 'dist-electron/preload.cjs'),
    format: 'cjs',
  })
  await Promise.all([ctxMain.watch(), ctxPreload.watch()])
  console.log('[electron] watching main + preload')
} else {
  await build()
}
