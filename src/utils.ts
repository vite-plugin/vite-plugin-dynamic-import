import path from 'node:path'

// ------------------------------------------------- RegExp

export const dynamicImportRE = /\bimport[\s\r\n]*?\(/
// this is probably less accurate
export const normallyImporteeRE = /^\.{1,2}\/[.-/\w]+(\.\w+)$/
export const viteIgnoreRE = /\/\*\s*@vite-ignore\s*\*\//
export const bareImportRE = /^[\w@](?!.*:\/\/)/
export const deepImportRE = /^([^@][^/]*)\/|^(@[^/]+\/[^/]+)\//

// ------------------------------------------------- function

/**
 * @param {string} code - The code to check for dynamic imports.
 * @returns bool
 * @description Determines whether a string containing javascript code may contain dynamic imports. It should be noted this is a naive check 
 * and may produce false positives, especially when import statements may appear in comments or strings. However, removing comments in their
 * entirety would require parsing the full AST to do so correctly.
 */
export function hasDynamicImport(code: string) {
  return dynamicImportRE.test(code)
}

/**
 * Unlimit depth match
 * @todo Use RegExp refactor
 */
export function toLooseGlob(glob: string): string | string[] {
  if (glob.includes('**')) return glob

  const lastIndex = glob.lastIndexOf('*')
  let tail = ''

  if (lastIndex > -1) {
    // foo*.js     -> glob=foo*  | tail=.js
    // foo/*.js    -> glob=foo/* | tail=.js
    // foo*bar.js  -> glob=foo*  | tail=bar.js
    // foo*/bar.js -> glob=foo*  | tail=/bar.js
    tail = glob.slice(lastIndex + 1)
    glob = glob.slice(0, lastIndex + 1)
  }

  if (glob.endsWith('/*')) {
    // foo/*    -> foo/**/*
    // foo/*.js -> foo/**/*.js
    return glob + '*/*' + tail
  }

  if (glob.endsWith('*')) {
    // foo*        -> [foo*, foo*/**/*]
    // foo*.js     -> [foo*.js, foo*/**/*.js]
    // foo*bar.js  -> [foo*bar.js, foo*/**/*bar.js]
    // foo*/bar.js -> [foo*/bar.js, foo*/**/bar.js]
    return [
      glob + tail, // original
      glob + '/**' + (tail.startsWith('/') ? tail : '/*' + tail), // 🚨 not strict
    ]
  }

  return glob + tail
}

/**
 * e.g. `src/foo/index.js` and has alias(@)
 * 
 * ```
 * const maps = {
 *   './foo/index.js': [
 *     '@/foo',
 *     '@/foo/index',
 *     '@/foo/index.js',
 *   ],
 * }
 * ```
 */
export function mappingPath(paths: string[], alias?: Record<string, string>) {
  const maps: Record<string, string[]> = {}
  for (const p of paths) {
    let importee = p
    if (alias) {
      const [find, replacement] = Object.entries(alias)[0]
      // Recovery alias `./views/*` -> `@/views/*`
      importee = p.replace(find, replacement)
    }
    const ext = path.extname(importee)

    maps[p] = [
      // @/foo
      importee.endsWith(`/index${ext}`) && importee.replace(`/index${ext}`, ''),
      // @/foo/index
      importee.replace(ext, ''),
      // @/foo/index.js
      importee,
    ].filter(Boolean) as string[]
  }

  return maps
}
