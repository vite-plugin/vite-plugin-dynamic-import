import path from 'node:path'
import { resolveConfig } from 'vite'
import {
  describe,
  expect,
  it,
} from 'vitest'
import { Resolve } from '../src/resolve'

const root = path.join(__dirname, 'fixtures')
const importer = path.join(root, 'src/main.ts')

function raw(importeeRaw: string) {
  return importeeRaw.slice(1, -1)
}

describe('src/resolve.ts', async () => {
  const config = await resolveConfig({ configFile: path.join(root, 'vite.config.ts'), }, 'build')
  const resolve = new Resolve(config)

  it('tryResolveAlias', async () => {
    const list: [string, string | undefined][] = [
      [
        "`@/views/${id}.js`",
        './views/${id}.js',
      ],
      [
        "`src/views/${id}.mjs`",
        './views/${id}.mjs',
      ],
      [
        "`/root/src/views/${id}`",
        './views/${id}',
      ],
      [
        "`./views${id}`", // without alias
        undefined,
      ],
      [
        "`./views${id}.tsx`",
        undefined,
      ],
      [
        "'@/views/' + 'foo.js'",
        "./views/' + 'foo.js",
      ],
      [
        "`@/${id}`",
        './${id}',
      ],
    ]

    for (const [form, to] of list) {
      const resolved = await resolve.tryResolve(raw(form), importer)
      expect(resolved?.import.resolved).eq(to)
    }
  })

  it('tryResolveBare', async () => {
    const resolved = await resolve.tryResolve("@ant-design/icons-svg/es/`${filename}", importer)
    const value = '../../../node_modules/@ant-design/icons-svg/es/`${filename}'
    expect(resolved?.import.resolved).eq(value)
  })
})
