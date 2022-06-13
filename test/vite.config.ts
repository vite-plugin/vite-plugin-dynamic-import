import fs from 'fs'
import path from 'path'
import { defineConfig } from 'vite'
import dynamicImport from '..'

export default defineConfig({
  root: __dirname,
  plugins: [
    dynamicImport({
      onFiles: files => files.filter(f => !f.includes('main-output.js')),
    }),
    {
      name: 'vite-plugin-dynamic-import:test',
      transform(code, id) {
        if (/src\/main\.ts$/.test(id)) {
          // Write transformed code to main-output.js
          fs.writeFileSync(path.join(path.dirname(id), 'main-output.js'), code)
        }
      },
    },
  ],
  resolve: {
    alias: [
      { find: '@', replacement: path.join(__dirname, 'src') },
      { find: /^src\//, replacement: path.join(__dirname, 'src/') },
      { find: '/root/src', replacement: path.join(__dirname, 'src') },
    ],
  },
  build: {
    minify: false,
  },
})
