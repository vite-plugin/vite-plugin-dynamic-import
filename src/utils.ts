import path from 'path'
import type { AcornNode as AcornNode2 } from 'rollup'
import {
  singlelineCommentsRE,
  multilineCommentsRE,
} from 'vite-plugin-utils/constant'
export type AcornNode<T = any> = AcornNode2 & Record<string, T>

// ------------------------------------------------- RegExp

export const dynamicImportRE = /\bimport[\s\r\n]*?\(/
// this is probably less accurate
export const normallyImporteeRE = /^\.{1,2}\/[.-/\w]+(\.\w+)$/
export const viteIgnoreRE = /\/\*\s*@vite-ignore\s*\*\//
export const bareImportRE = /^[\w@](?!.*:\/\/)/
export const deepImportRE = /^([^@][^/]*)\/|^(@[^/]+\/[^/]+)\//

// ------------------------------------------------- function

export function hasDynamicImport(code: string) {
  code = code
    .replace(singlelineCommentsRE, '')
    .replace(multilineCommentsRE, '')
  return dynamicImportRE.test(code)
}

/**
 * Unlimit depth match
 */
export function toLooseGlob(glob: string): string | string[] {
  if (glob.includes('**')) return glob

  const ext = path.extname(glob)
  if (ext) {
    glob = glob.replace(ext, '')
  }

  if (glob.endsWith('/*')) {
    // foo/* -> foo/**/*
    // foo/*.js -> foo/**/*.js
    return glob + '*/*' + ext
  }

  if (glob.endsWith('*')) {
    // foo* -> [foo*, foo*/**/*]
    // foo*.js -> [foo*.js, foo*/**/*.js]
    return [glob + ext, glob + '/**/*' + ext]
  }

  return glob + ext
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
    ].filter(Boolean)
  }

  return maps
}
