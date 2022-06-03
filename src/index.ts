import path from 'path'
import type { Plugin, ResolvedConfig } from 'vite'
import fastGlob from 'fast-glob'

import {
  JS_EXTENSIONS,
  KNOWN_SFC_EXTENSIONS,
  MagicString,
  cleanUrl,
  extractImporteeRE,
  hasDynamicImport,
  normallyImporteeRE,
  simpleWalk,
  viteIgnoreRE,
} from './utils'
import type { AcornNode } from './types'
import {
  type Resolved,
  Resolve,
} from './resolve'
import {
  DynamicImportVars,
  tryFixGlobExtension,
  tryFixGlobSlash,
  toDepthGlob,
} from './dynamic-import-vars'
import {
  type DynamicImportRuntime,
  generateDynamicImportRuntime,
} from './dynamic-import-helper'

export interface DynamicImportOptions {
  filter?: (id: string) => false | void
  /**
   * This option will change `./*` to `./** /*`
   * @default true
   */
  depth?: boolean
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

export default function dynamicImport(options: DynamicImportOptions = {}): Plugin {
  let config: ResolvedConfig
  let resolve: Resolve
  let dynamicImportVars: DynamicImportVars

  const dyImpt: Plugin = {
    name: PLUGIN_NAME,
    configResolved(_config) {
      config = _config
      resolve = new Resolve(_config)
      dynamicImportVars = new DynamicImportVars(resolve)
    },
    async transform(code, id, opts) {
      const pureId = cleanUrl(id)
      const extensions = JS_EXTENSIONS.concat(KNOWN_SFC_EXTENSIONS)
      const globExtensions = config.resolve?.extensions || extensions
      const { ext } = path.parse(pureId)

      if (/node_modules/.test(pureId) && !pureId.includes('.vite')) return
      if (!extensions.includes(ext)) return
      if (!hasDynamicImport(code)) return
      if (options.filter?.(pureId) === false) return

      const ast = this.parse(code)
      let dynamicImportIndex = 0
      const dynamicImportRecords: DynamicImportRecord[] = []

      await simpleWalk(ast, {
        async ImportExpression(node: AcornNode) {
          const importStatement = code.slice(node.start, node.end)
          const importeeRaw = code.slice(node.source.start, node.source.end)

          // skip @vite-ignore
          if (viteIgnoreRE.test(importStatement)) return

          // the user explicitly ignore this import
          if (options.viteIgnore?.(importeeRaw, pureId)) {
            dynamicImportRecords.push({
              node,
              importeeRaw: '/*@vite-ignore*/' + importeeRaw,
              // TODO: this may not be `importRuntime`
              importRuntime: { name: 'import', body: '' },
            })
            return
          }

          const matched = importeeRaw.match(extractImporteeRE)
          // currently, only importee in string format is supported
          if (!matched) return

          const [, startQuotation, importee] = matched
          // normally importee
          if (normallyImporteeRE.test(importee)) return

          const resolved = await resolve.tryResolve(importee, id)
          // normally importee
          if (resolved && normallyImporteeRE.test(resolved.import.resolved)) return

          const globResult = await globFiles(
            dynamicImportVars,
            node,
            code,
            id,
            globExtensions,
            options,
          )
          if (!globResult) return

          const dyRecord = {
            node: {
              type: node.type,
              start: node.start,
              end: node.end,
            },
            importeeRaw,
          }

          if (globResult['normally']) {
            // normally importee
            const { normally } = globResult as GlobNormally
            dynamicImportRecords.push({ ...dyRecord, normally })
          } else {
            const { glob, files, resolved } = globResult as GlobHasFiles
            if (!files.length) return

            const importeeMappings = listImporteeMappings(
              glob,
              globExtensions,
              files,
              resolved,
            )

            const importRuntime = generateDynamicImportRuntime(importeeMappings, dynamicImportIndex++)
            dynamicImportRecords.push({ ...dyRecord, importRuntime })
          }
        },
      })

      let dyImptRutimeBody = ''
      const ms = new MagicString(code)
      if (dynamicImportRecords.length) {
        for (const dyImptRecord of dynamicImportRecords) {
          const {
            node,
            importeeRaw,
            importRuntime,
            normally,
          } = dyImptRecord

          let placeholder: string
          if (normally) {
            placeholder = `import("${normally.glob}")`
          } else {
            /**
             * this is equivalent to a non rigorous model
             * 
             // extension should be removed, because if the "index" file is in the directory, an error will occur
             //
             // e.g. 
             // ├─┬ views
             // │ ├─┬ foo
             // │ │ └── index.js
             // │ └── bar.js
             //
             // when we use `./views/*.js`, we want it to match `./views/foo/index.js`, `./views/bar.js`
             * 
             // const starts = importeeRaw.slice(0, -1)
             // const ends = importeeRaw.slice(-1)
             // const withOutExtImporteeRaw = starts.replace(path.extname(starts), '') + ends
             // placeholder = `${importRuntime.name}(${withOutExtImporteeRaw})`
             */

            placeholder = `${importRuntime.name}(${importeeRaw})`
            dyImptRutimeBody += importRuntime.body
          }

          ms.overwrite(node.start, node.end, placeholder)
        }

        if (dyImptRutimeBody) {
          ms.append(`\n// --------- ${PLUGIN_NAME} ---------\n` + dyImptRutimeBody)
        }

        return ms.toString()
      }
    },
  }

  return  dyImpt
}

interface DynamicImportRecord {
  node: AcornNode
  importeeRaw: string
  importRuntime?: DynamicImportRuntime
  normally?: GlobNormally['normally']
}

type GlobHasFiles = {
  glob: string
  resolved?: Resolved & { files: string[] }
  files: string[]
}
type GlobNormally = {
  normally: {
    glob: string
    resolved?: Resolved
  }
}
type GlobFilesResult = GlobHasFiles | GlobNormally | null

async function globFiles(
  dynamicImportVars: DynamicImportVars,
  ImportExpressionNode: AcornNode,
  sourceString: string,
  id: string,
  extensions: string[],
  options: DynamicImportOptions,
): Promise<GlobFilesResult> {
  const { depth = true, onFiles } = options
  const node = ImportExpressionNode
  const code = sourceString
  const pureId = cleanUrl(id)

  const { resolved, glob: globObj } = await dynamicImportVars.dynamicImportToGlob(
    node.source,
    code.substring(node.start, node.end),
    pureId,
  )
  if (!globObj.valid) {
    if (normallyImporteeRE.test(globObj.glob)) {
      return { normally: { glob: globObj.glob, resolved } }
    }
    // this was not a variable dynamic import
    return null
  }
  let { glob } = globObj
  let globWithIndex: string

  glob = tryFixGlobSlash(glob) || glob
  depth && (glob = toDepthGlob(glob))
  const tmp = tryFixGlobExtension(glob, extensions)
  if (tmp) {
    glob = tmp.glob
    globWithIndex = tmp.globWithIndex
  }

  const parsed = path.parse(pureId)
  let files = fastGlob.sync(
    globWithIndex ? [glob, globWithIndex] : glob,
    { cwd: parsed./* 🚧-① */dir },
  )
  files = files.map(file => !file.startsWith('.') ? /* 🚧-③ */'./' + file : file)
  onFiles && (files = onFiles(files, pureId) || files)

  let resolvedWithFiles: GlobHasFiles['resolved']
  if (resolved) {
    const static1 = resolved.import.importee.slice(0, resolved.import.importee.indexOf('*'))
    const static2 = resolved.import.resolved.slice(0, resolved.import.resolved.indexOf('*'))
    resolvedWithFiles = {
      ...resolved,
      files: files.map(file =>
        // Recovery alias `./views/*` -> `@/views/*`
        file.replace(static2, static1)
      ),
    }
  }

  return {
    glob,
    resolved: resolvedWithFiles,
    files,
  }
}

function listImporteeMappings(
  glob: string,
  extensions: string[],
  importeeList: string[],
  resolved?: GlobHasFiles['resolved'],
) {
  const hasExtension = extensions.some(ext => glob.endsWith(ext))
  return importeeList.reduce((memo, importee, idx) => {
    const realFilepath = importee
    importee = resolved ? resolved.files[idx] : importee
    if (hasExtension) {
      return Object.assign(memo, { [realFilepath]: [importee] })
    }

    const ext = extensions.find(ext => importee.endsWith(ext))
    const list = [
      // foo/index
      importee.replace(ext, ''),
      // foo/index.js
      importee,
    ]
    if (importee.endsWith('index' + ext)) {
      // foo
      list.unshift(importee.replace('/index' + ext, ''))
    }
    return Object.assign(memo, { [realFilepath]: list })
  }, {} as Record</* localFilename */string, /* Array<possible importee> */string[]>)
}
