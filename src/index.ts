import path from 'path'
import type { AcornNode as AcornNode2 } from 'rollup'
export type AcornNode<T = any> = AcornNode2 & Record<string, T>
import type { Plugin, ResolvedConfig } from 'vite'
import fastGlob from 'fast-glob'

import {
  JS_EXTENSIONS,
  KNOWN_SFC_EXTENSIONS,
  MagicString,
  cleanUrl,
  hasDynamicImport,
  normallyImporteeRE,
  simpleWalk,
  viteIgnoreRE,
  mappingPath,
  toLooseGlob,
  relativeify
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
  filter?: (id: string) => false | void
  /**
   * ```
   * 1. `true` - Match all possibilities as much as possible, more like `webpack`
   * see https://webpack.js.org/guides/dependency-management/#require-with-expression
   * 
   * 2. `false` - It behaves more like `@rollup/plugin-dynamic-import-vars`
   * see https://github.com/rollup/plugins/tree/master/packages/dynamic-import-vars#how-it-works
   * 
   * default true
   * ```
   */
  loose?: boolean
  /**
   * If you want to exclude some files  
   * e.g `type.d.ts`, `interface.ts`
   */
  onFiles?: (files: string[], id: string) => typeof files | void
  /**
   * It will add `@vite-ignore`  
   * `import(/*@vite-ignore* / 'import-path')`
   */
  viteIgnore?: (rawImportee: string, id: string) => true | void
}

const PLUGIN_NAME = 'vite-plugin-dynamic-import'

export default function dynamicImport(options: Options = {}): Plugin {
  const extensions = JS_EXTENSIONS.concat(KNOWN_SFC_EXTENSIONS)
  let globExtensions: string[]
  let config: ResolvedConfig
  let resolve: Resolve

  return {
    name: PLUGIN_NAME,
    configResolved(_config) {
      config = _config
      globExtensions = config.resolve?.extensions || extensions
      resolve = new Resolve(_config)
    },
    async transform(code, importer) {
      const pureId = cleanUrl(importer)

      if (/node_modules\/(?!\.vite\/)/.test(pureId)) return
      if (!extensions.includes(path.extname(pureId))) return
      if (!hasDynamicImport(code)) return
      if (options.filter?.(pureId) === false) return

      const ast = this.parse(code)
      const ms = new MagicString(code)
      let dynamicImportIndex = 0
      const runtimeFunctions: string[] = []

      await simpleWalk(ast, {
        async ImportExpression(node: AcornNode) {
          const importStatement = code.slice(node.start, node.end)
          const importeeRaw = code.slice(node.source.start, node.source.end)

          // skip @vite-ignore
          if (viteIgnoreRE.test(importStatement)) return

          // the user explicitly ignore this import
          if (options.viteIgnore?.(importeeRaw, pureId)) {
            ms.overwrite(node.source.start, node.source.start, '/*@vite-ignore*/') // append left
            return
          }

          if (node.source.type === 'Literal') {
            const importee = importeeRaw.slice(1, -1)
            // empty value
            if (!importee) return
            // normally importee
            if (normallyImporteeRE.test(importee)) return

            const rsld = await resolve.tryResolve(importee, importer)
            // alias or bare
            if (rsld && normallyImporteeRE.test(rsld.import.resolved)) {
              ms.overwrite(node.start, node.end, `import("${rsld.import.resolved}")`)
              return
            }
          }

          const globResult = await globFiles(
            node,
            code,
            importer,
            resolve,
            globExtensions,
            options.loose !== false,
          )
          if (!globResult) return

          let { files, resolved, normally } = globResult
          // skip itself
          files = files.filter(f => path.join(path.dirname(importer), f) !== importer)
          // execute the Options.onFiles
          options.onFiles && (files = options.onFiles(files, importer) || files)

          if (normally) {
            // normally importee (🚧-③ After `expressiontoglob()` processing)
            ms.overwrite(node.start, node.end, `import('${normally}')`)
          } else {
            if (!files?.length) return
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
            ms.overwrite(node.start, node.end, `${runtimeName}(${importeeRaw})`)
            runtimeFunctions.push(runtimeFn)
          }
        },
      })

      if (runtimeFunctions.length) {
        ms.append([
          '// ---- dynamic import runtime functions --S--',
          ...runtimeFunctions,
          '// ---- dynamic import runtime functions --E--',
        ].join('\n'))
      }

      const str = ms.toString()
      return str === code ? null : str
    },
  }
}

async function globFiles(
  /** ImportExpression */
  node: AcornNode,
  code: string,
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
}> {
  let files: string[]
  let resolved: Resolved
  let normally: string

  const PAHT_FILL = '####/'
  const EXT_FILL = '.extension'
  let glob: string
  let globRaw: string

  glob = await dynamicImportToGlob(
    node.source,
    code.slice(node.start, node.end),
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

  const globs = [].concat(loose ? toLooseGlob(glob) : glob)
    .map(g => {
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

  /*
  loose && (glob = toLooseGlob(glob))
  glob.includes(PAHT_FILL) && (glob = glob.replace(PAHT_FILL, ''))
  glob.endsWith(EXT_FILL) && (glob = glob.replace(EXT_FILL, ''))

  const fileGlob = path.extname(glob)
    ? glob
    // If not ext is not specified, fill necessary extensions
    // e.g.
    //   `./foo/*` -> `./foo/*.{js,ts,vue,...}`
    : glob + `.{${extensions.map(e => e.replace(/^\./, '')).join(',')}}`
  */

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
