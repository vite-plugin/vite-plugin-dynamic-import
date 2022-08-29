import path from 'path'
import type { AcornNode as AcornNode2 } from 'rollup'
export type AcornNode<T = any> = AcornNode2 & Record<string, T>

// ------------------------------------------------- RegExp

export const dynamicImportRE = /\bimport[\s\r\n]*?\(/
// this is probably less accurate
export const normallyImporteeRE = /^\.{1,2}\/[.-/\w]+(\.\w+)$/
export const viteIgnoreRE = /\/\*\s*@vite-ignore\s*\*\//
export const multilineCommentsRE = /\/\*(.|[\r\n])*?\*\//g
export const singlelineCommentsRE = /\/\/.*/g
export const queryRE = /\?.*$/s
export const hashRE = /#.*$/s
export const bareImportRE = /^[\w@](?!.*:\/\/)/
export const deepImportRE = /^([^@][^/]*)\/|^(@[^/]+\/[^/]+)\//

// ------------------------------------------------- const

export const JS_EXTENSIONS = [
  '.mjs',
  '.js',
  '.ts',
  '.jsx',
  '.tsx',
  '.cjs'
]
export const KNOWN_SFC_EXTENSIONS = [
  '.vue',
  '.svelte',
]

// ------------------------------------------------- function

export function cleanUrl(url: string): string {
  return url.replace(hashRE, '').replace(queryRE, '')
}

export function hasDynamicImport(code: string) {
  code = code
    .replace(singlelineCommentsRE, '')
    .replace(multilineCommentsRE, '')
  return dynamicImportRE.test(code)
}

export async function simpleWalk(
  ast: AcornNode,
  visitors: {
    [type: string]: (node: AcornNode) => void | Promise<void>,
  }) {
  if (!ast) return;

  if (Array.isArray(ast)) {
    for (const element of ast as AcornNode[]) {
      await simpleWalk(element, visitors)
    }
  } else {
    for (const key of Object.keys(ast)) {
      await (typeof ast[key] === 'object' && simpleWalk(ast[key], visitors))
    }
  }

  await visitors[ast.type]?.(ast)
}

export class MagicString {
  private overwrites: { loc: [number, number]; content: string }[]
  private starts = ''
  private ends = ''

  constructor(
    public str: string
  ) { }

  public append(content: string) {
    this.ends += content
    return this
  }

  public prepend(content: string) {
    this.starts = content + this.starts
    return this
  }

  public overwrite(start: number, end: number, content: string) {
    if (end < start) {
      throw new Error(`"end" con't be less than "start".`)
    }
    if (!this.overwrites) {
      this.overwrites = []
    }
    this.overwrites.push({ loc: [start, end], content })
    return this
  }

  public toString() {
    let str = this.str
    if (this.overwrites) {
      const arr = [...this.overwrites].sort((a, b) => b.loc[0] - a.loc[0])
      for (const { loc: [start, end], content } of arr) {
        // TODO: check start or end overlap
        str = str.slice(0, start) + content + str.slice(end)
      }
    }
    return this.starts + str + this.ends
  }
}

/**
 * @deprecated
 */
// In some cases, glob may not be available
// e.g. (fill necessary slash)
//   foo* -> foo/*
//   foo*.js -> foo/*.js
export function tryFixGlobSlash(glob: string): string {
  return glob.replace(/(?<![\*\/])(\*)/g, '/$1')
}

/**
 * @deprecated
 */
// Match as far as possible
// e.g.
//   foo/* -> foo/**/*
//   foo/*.js -> foo/**/*.js
export function toDepthGlob(glob: string): string {
  return glob.replace(/^(.*)\/\*(?!\*)/, '$1/**/*')
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

/**
 * 🚧-②
 */
 export function relativeify(relative: string) {
  if (relative === '') {
    return '.'
  }
  if (!relative.startsWith('.')) {
    return './' + relative
  }
  return relative
}
