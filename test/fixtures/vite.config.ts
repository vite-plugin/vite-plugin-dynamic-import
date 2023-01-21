import fs from 'fs'
import path from 'path'
import { defineConfig } from 'vite'
import dynamicImport from '../..'

export default defineConfig({
  root: __dirname,
  plugins: [
    dynamicImport(),
    {
      name: 'vite-plugin-dynamic-import:test',
      transform(code, id) {
        if (/src\/main\.ts$/.test(id)) {
          const { dir, name } = path.parse(id)
          const dist = dir.replace('src', 'dist')
          !fs.existsSync(dist) && fs.mkdirSync(dist, { recursive: true })
          // Write transformed code to dist
          fs.writeFileSync(path.join(dist, `${name}.js`), code)
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
