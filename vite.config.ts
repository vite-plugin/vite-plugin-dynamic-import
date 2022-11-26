import path from 'path'
import { builtinModules } from 'module'
import { defineConfig } from 'vite'
import pkg from './package.json'

export default defineConfig({
  build: {
    minify: false,
    outDir: '',
    emptyOutDir: false,
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
