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
          const { dir, name } = path.parse(id)
          const __snapshots__ = dir.replace('src', '__snapshots__')
          !fs.existsSync(__snapshots__) && fs.mkdirSync(__snapshots__, { recursive: true })
          // Write transformed code to __snapshots__
          fs.writeFileSync(path.join(__snapshots__, `${name}.js`), code)
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
