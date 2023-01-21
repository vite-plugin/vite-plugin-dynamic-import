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

const root = path.join(__dirname, 'fixtures')
let server: ViteDevServer | null = null
const PORT = 4000

beforeAll(async () => {
  fs.rmSync(path.join(root, 'dist'), { recursive: true, force: true })
  server = await createServer({ configFile: path.join(root, 'vite.config.ts') })
  await server.listen(PORT)
})

describe('vite serve', async () => {
  it('__snapshots__', async () => {
    const mainTs = await (await fetch(`http://localhost:${PORT}/src/main.ts`)).text()
    const mainJs = fs.readFileSync(path.join(path.join(root, 'dist/main.js')), 'utf8')
    const mainJsSnap = fs.readFileSync(path.join(path.join(root, '__snapshots__/main.js')), 'utf8')

    expect(mainTs).string
    expect(mainJs).eq(mainJsSnap)
  })
})

afterAll(async () => {
  await server?.close()
  server = null
})
