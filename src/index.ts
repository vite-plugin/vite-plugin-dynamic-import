import path from 'node:path'
import type { AcornNode as AcornNode2 } from 'rollup'
export type AcornNode<T = any> = AcornNode2 & Record<string, T>
import type { Plugin, ResolvedConfig } from 'vite'
import {
  type ImportSpecifier,
  init as initParseImports,
  parse as parseImports,
} from 'es-module-lexer'
import fastGlob from 'fast-glob'
import { DEFAULT_EXTENSIONS } from 'vite-plugin-utils/constant'
import { MagicString, relativeify } from 'vite-plugin-utils/function'

import {
  hasDynamicImport,
  normallyImporteeRE,
  viteIgnoreRE,
  mappingPath,
  toLooseGlob,
} from './utils'
import { type Resolved, Resolve } from './resolve'
import { dynamicImportToGlob } from './dynamic-import-to-glob'

// Public utils
export { dynamicImportToGlob } from './dynamic-import-to-glob'
export {
  type Resolved,
  Resolve,
} from './resolve'
export {
  toLooseGlob,
  mappingPath,
} from './utils'

export interface Options {
  filter?: (id: string) => boolean | void
  /**
   * ```
   * 1. `true` - Match all possibilities as much as possible, more like `webpack`
   * see https://webpack.js.org/guides/dependency-management/#require-with-expression
   * 
   * 2. `false` - It behaves more like `@rollup/plugin-dynamic-import-vars`
   * see https://github.com/rollup/plugins/tree/master/packages/dynamic-import-vars#how-it-works
   * ```
   * 
   * @defaultValue true
   */
  loose?: boolean
  /**
   * If you want to exclude some files  
   * e.g `type.d.ts`, `interface.ts`
   */
  onFiles?: (files: string[], id: string) => typeof files | void
  /**
   * Custom importee
   * 
   * e.g. - append `\/*@vite-ignore*\/` in front of importee to bypass to Vite
   */
  onResolve?: (rawImportee: string, id: string) => typeof rawImportee | void
}

const PLUGIN_NAME = 'vite-plugin-dynamic-import'

export default function dynamicImport(options: Options = {}): Plugin {
  let config: ResolvedConfig
  let resolve: Resolve
  let extensions = DEFAULT_EXTENSIONS

  return {
    name: PLUGIN_NAME,
    configResolved(_config) {
      config = _config
      resolve = new Resolve(_config)
      // https://github.com/vitejs/vite/blob/v4.3.0/packages/vite/src/node/config.ts#L498
      if (config.resolve?.extensions) extensions = config.resolve.extensions
    },
    async transform(code, id) {
      if (!hasDynamicImport(code)) return

      const userCondition = options.filter?.(id)
      if (userCondition === false) return
      // exclude `node_modules` by default
      // here can only get the files in `node_modules/.vite` and `node_modules/vite/dist/client`
      if (userCondition !== true && id.includes('node_modules')) return

      // https://github.com/vitejs/vite/blob/v4.3.0/packages/vite/src/node/plugins/dynamicImportVars.ts#L179
      await initParseImports

      let imports: readonly ImportSpecifier[] = []
      try {
        imports = parseImports(code)[0]
      } catch (e: any) {
        // ignore as it might not be a JS file, the subsequent plugins will catch the error
        return null
      }

      if (!imports.length) {
        return null
      }

      const ms = new MagicString(code)
      let dynamicImportIndex = 0
      const runtimeFunctions: string[] = []

      for (let index = 0; index < imports.length; index++) {
        const {
          s: start,
          e: end,
          ss: expStart,
          se: expEnd,
          d: dynamicIndex,
        } = imports[index]

        if (dynamicIndex === -1) continue

        const importExpression = code.slice(expStart, expEnd)
        let rawImportee = code.slice(start, end)

        // user custom importee
        const userImportee = options.onResolve?.(rawImportee, id)
        if (userImportee) {
          rawImportee = userImportee
        }

        // skip @vite-ignore
        // https://github.com/vitejs/vite/blob/v4.3.0/packages/vite/src/node/plugins/importAnalysis.ts#L663
        if (viteIgnoreRE.test(importExpression)) continue

        // @ts-ignore
        const importExpressionAst: AcornNode = this.parse(importExpression).body[0]./* ImportExpression */expression

        // maybe `import.meta`
        if (importExpressionAst.type !== 'ImportExpression') continue

        if (importExpressionAst.source.type === 'Literal') {
          const importee = rawImportee.slice(1, -1)
          // normally importee
          if (normallyImporteeRE.test(importee)) continue

          const rsld = await resolve.tryResolve(importee, id)
          // alias or bare-module - 2.x
          if (rsld && normallyImporteeRE.test(rsld.import.resolved)) {
            ms.overwrite(expStart, expEnd, `import("${rsld.import.resolved}")`)
            continue
          }
        }

        const globResult = await globFiles(
          importExpressionAst,
          importExpression,
          id,
          resolve,
          extensions,
          options.loose !== false,
        )
        if (!globResult) continue

        let { files, resolved, normally } = globResult
        // skip itself
        files = files!.filter(f => path.posix.join(path.dirname(id), f) !== id)
        // execute the Options.onFiles
        options.onFiles && (files = options.onFiles(files, id) || files)

        if (normally) {
          // normally importee (🚧-③ After `expressiontoglob()` processing)
          ms.overwrite(expStart, expEnd, `import('${normally}')`)
        } else {
          if (!files?.length) continue
          const mapAlias = resolved
            ? { [resolved.alias.relative]: resolved.alias.findString }
            : undefined

          const maps = mappingPath(files, mapAlias)
          const runtimeName = `__variableDynamicImportRuntime${dynamicImportIndex++}__`
          const runtimeFn = generateDynamicImportRuntime(maps, runtimeName)

          // extension should be removed, because if the "index" file is in the directory, an error will occur
          //
          // e.g. 
          // ├─┬ views
          // │ ├─┬ foo
          // │ │ └── index.js
          // │ └── bar.js
          //
          // the './views/*.js' should be matched ['./views/foo/index.js', './views/bar.js'], this may not be rigorous
          ms.overwrite(expStart, expEnd, `${runtimeName}(${rawImportee})`)
          runtimeFunctions.push(runtimeFn)
        }
      }

      if (runtimeFunctions.length) {
        ms.append([
          '// [vite-plugin-dynamic-import] runtime -S-',
          ...runtimeFunctions,
          '// [vite-plugin-dynamic-import] runtime -E-',
        ].join('\n'))
      }

      const str = ms.toString()
      return str === code ? null : str
    },
  }
}

async function globFiles(
  /** ImportExpression */
  importExpressionAst: AcornNode,
  importExpression: string,
  importer: string,
  resolve: Resolve,
  extensions: string[],
  loose = true,
): Promise<{
  files?: string[]
  resolved?: Resolved
  /**
   * 🚧-③ After `expressiontoglob()` processing, it may become a normal path  
   * 
   * In v2.9.9 Vite has handled internally(2022-06-09) ????  
   * import('@/views/' + 'foo.js')
   * ↓
   * import('@/viewsfoo.js')
   */
  normally?: string
} | undefined> {
  let files: string[]
  let resolved: Resolved | undefined
  let normally: string

  const PAHT_FILL = '####/'
  const EXT_FILL = '.extension'
  let glob: string | null
  let globRaw!: string

  glob = await dynamicImportToGlob(
    importExpressionAst.source,
    importExpression,
    async (raw) => {
      globRaw = raw
      resolved = await resolve.tryResolve(raw, importer)
      if (resolved) {
        raw = resolved.import.resolved
      }
      if (!path.extname(raw)) {
        // Bypass extension restrict
        raw = raw + EXT_FILL
      }
      if (/^\.\/\*\.\w+$/.test(raw)) {
        // Bypass ownDirectoryStarExtension (./*.ext)
        raw = raw.replace('./*', `./${PAHT_FILL}*`)
      }
      return raw
    },
  )
  if (!glob) {
    if (normallyImporteeRE.test(globRaw)) {
      normally = globRaw
      return { normally }
    }
    return
  }

  // @ts-ignore
  const globs = [].concat(loose ? toLooseGlob(glob) : glob)
    .map((g: any) => {
      g.includes(PAHT_FILL) && (g = g.replace(PAHT_FILL, ''))
      g.endsWith(EXT_FILL) && (g = g.replace(EXT_FILL, ''))
      return g
    })
  const fileGlobs = globs
    .map(g => path.extname(g)
      ? g
      // If not ext is not specified, fill necessary extensions
      // e.g.
      //   `./foo/*` -> `./foo/*.{js,ts,vue,...}`
      : g + `.{${extensions.map(e => e.replace(/^\./, '')).join(',')}}`
    )

  files = fastGlob
    .sync(fileGlobs, { cwd: /* 🚧-① */path.dirname(importer) })
    .map(file => relativeify(file))

  return { files, resolved }
}

function generateDynamicImportRuntime(
  maps: Record<string, string[]>,
  name: string,
) {
  const groups = Object
    .entries(maps)
    .map(([localFile, importeeList]) => importeeList
      .map(importee => `    case '${importee}':`)
      .concat(`      return import('${localFile}');`)
    )

  return `function ${name}(path) {
  switch (path) {
${groups.flat().join('\n')}
    default: return new Promise(function(resolve, reject) {
      (typeof queueMicrotask === 'function' ? queueMicrotask : setTimeout)(
        reject.bind(null, new Error("Unknown variable dynamic import: " + path))
      );
    })
  }
}`
}
