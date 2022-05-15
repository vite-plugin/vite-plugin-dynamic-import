import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'
import { createServer } from 'vite'
const dynamicImport = createRequire(import.meta.url)('../dist').default

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const server = await createServer({
  configFile: false,
  root: __dirname,
  plugins: [
    dynamicImport(),
    {
      name: 'vite-plugin-dynamic-import--test',
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

await server.listen()
const { address, port } = server.httpServer.address()
server.config.logger.info(`👉 dev server running at: http://${address}:${port}`, { timestamp: true })
