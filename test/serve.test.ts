import fs from 'node:fs'
import path from 'node:path'
import {
  type ViteDevServer,
  createServer,
} from 'vite'
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
} from 'vitest'
import fetch from 'node-fetch'
import fastGlob from 'fast-glob'

const root = path.join(__dirname, 'fixtures')
let server: ViteDevServer | null = null
let port = 4000

beforeAll(async () => {
  fs.rmSync(path.join(root, 'dist'), { recursive: true, force: true })
  server = await createServer({ configFile: path.join(root, 'vite.config.ts') })
  await server.listen(port)
  // @ts-ignore
  port = server.httpServer?.address().port
})

describe('vite serve', async () => {
  it('__snapshots__', async () => {
    const files = fastGlob.sync('__snapshots__/**/*', { cwd: root })
    for (const file of files) {
      const response = await (await fetch(`http://localhost:${port}/${file.replace('__snapshots__', 'src')}`)).text()
      const distFile = fs.readFileSync(path.join(root, file.replace('__snapshots__', 'dist')), 'utf8')
      const snapFile = fs.readFileSync(path.join(root, file), 'utf8')

      expect(response).string
      expect(distFile).eq(snapFile)
    }
  })
})

afterAll(async () => {
  await server?.close()
  server = null
})
