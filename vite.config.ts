import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { builtinModules } from 'node:module'
import { defineConfig } from 'vite'
import pkg from './package.json'

export default defineConfig({
  build: {
    emptyOutDir: false,
    minify: false,
    outDir: '',
    target: 'node14',
    lib: {
      entry: path.join(__dirname, 'src/index.ts'),
      formats: ['es', 'cjs'],
      fileName: format => format === 'cjs' ? '[name].cjs' : '[name].js',
    },
    rollupOptions: {
      external: [
        ...builtinModules
          .filter(m => !m.startsWith('_'))
          .map(m => [m, `node:${m}`])
          .flat(),
        ...Object.keys(pkg.dependencies),
      ],
      output: {
        exports: 'named',
      },
    },
  },
})

function generateTypes() {
  return new Promise(resolve => {
    const cp = spawn(
      process.platform === 'win32' ? 'npm.cmd' : 'npm',
      ['run', 'types'],
      { stdio: 'inherit' },
    )
    cp.on('exit', code => {
      !code && console.log('[types]', 'declaration generated')
      resolve(code)
    })
    cp.on('error', process.exit)
  })
}

if (process.env.NODE_ENV !== 'test') {
  fs.rmSync('types', { recursive: true, force: true })
  generateTypes()
}
