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
          // write transformed code to dist/
          const filename = id.replace('src', 'dist')
          const dirname = path.dirname(filename)
          if (!fs.existsSync(dirname)) fs.mkdirSync(dirname)
          fs.writeFileSync(filename, code)
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
