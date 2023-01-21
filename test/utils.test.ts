import {
  describe,
  expect,
  it,
} from 'vitest'
import {
  toLooseGlob,
  mappingPath,
} from '../src/utils'

describe('src/resolve.ts', async () => {
  it('toLooseGlob', async () => {
    const list: [string, string | string[]][] = [
      [
        'foo/*',
        'foo/**/*',
      ],
      [
        'foo/*.js',
        'foo/**/*.js',
      ],
      // ---- string[] ----
      [
        'foo*',
        ['foo*', 'foo*/**/*'],
      ],
      [
        'foo*.js',
        ['foo*.js', 'foo*/**/*.js'],
      ],
      [
        'foo*bar.js',
        ['foo*bar.js', 'foo*/**/*bar.js'],
      ],
      [
        'foo*/bar.js',
        ['foo*/bar.js', 'foo*/**/bar.js'],
      ],
    ]

    for (const [form, to] of list) {
      const glob = toLooseGlob(form)
      expect(glob).toEqual(to)
    }
  })

  it('mappingPath', async () => {
    const path1 = {
      './foo/index.js': [
        './foo',
        './foo/index',
        './foo/index.js',
      ],
    }
    const path2 = {
      './foo/index.js': [
        '@/foo',
        '@/foo/index',
        '@/foo/index.js',
      ],
    }

    expect(mappingPath(Object.keys(path1))).toEqual(path1)
    expect(mappingPath(Object.keys(path2), { '.': '@' })).toEqual(path2)
  })
})
