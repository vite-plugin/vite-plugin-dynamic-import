import path from 'path'
import type { Plugin, ResolvedConfig } from 'vite'
import fastGlob from 'fast-glob'
import {
  sortPlugin,
  OfficialPlugins,
  cleanUrl,
  JS_EXTENSIONS,
  KNOWN_SFC_EXTENSIONS,
} from 'vite-plugin-utils'
import {
  hasDynamicImport,
  normallyImporteeRE,
  viteIgnoreRE,
  extractImporteeRE,
  simpleWalk,
} from './utils'
import type { AcornNode } from './types'
import { AliasContext, AliasReplaced } from './alias'
import {
  DynamicImportVars,
  tryFixGlobExtension,
  tryFixGlobSlash,
  toDepthGlob,
} from './dynamic-import-vars'
import { DynamicImportRuntime, generateDynamicImportRuntime } from './dynamic-import-helper'

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
  let aliasContext: AliasContext
  let dynamicImport: DynamicImportVars

  const dyImpt: Plugin = {
    name: PLUGIN_NAME,
    configResolved(_config) {
      config = _config
      aliasContext = new AliasContext(_config)
      dynamicImport = new DynamicImportVars(aliasContext)
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
          // this is a normal path
          if (normallyImporteeRE.test(importee)) return

          const replaced = await aliasContext.replaceImportee(importee, id)
          // this is a normal path
          if (replaced && normallyImporteeRE.test(replaced.replacedImportee)) return

          const globResult = await globFiles(
            dynamicImport,
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
            // this is a normal path
            const { normally } = globResult as GlobNormally
            dynamicImportRecords.push({ ...dyRecord, normally })
          } else {
            const { glob, files, alias } = globResult as GlobHasFiles
            if (!files.length) return

            const importeeMappings = listImporteeMappings(
              glob,
              globExtensions,
              files,
              alias,
            )

            const importRuntime = generateDynamicImportRuntime(importeeMappings, dynamicImportIndex++)
            dynamicImportRecords.push({ ...dyRecord, importRuntime })
          }
        },
      })

      let dyImptRutimeBody = ''
      if (dynamicImportRecords.length) {
        for (let len = dynamicImportRecords.length, i = len - 1; i >= 0; i--) {
          const {
            node,
            importeeRaw,
            importRuntime,
            normally,
          } = dynamicImportRecords[i]

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
            dyImptRutimeBody = importRuntime.body + dyImptRutimeBody
          }

          code = code.slice(0, node.start) + placeholder + code.slice(node.end)
        }

        if (dyImptRutimeBody) {
          code += `\n// --------- ${PLUGIN_NAME} ---------\n` + dyImptRutimeBody
        }

        return {
          code,
          // TODO: sourcemap
          map: { mappings: '' },
        }
      }
    },
  }

  return sortPlugin({
    plugin: dyImpt,
    names: Object.values(OfficialPlugins).flat(),
    enforce: 'post',
  })
}

interface DynamicImportRecord {
  node: AcornNode
  importeeRaw: string
  importRuntime?: DynamicImportRuntime
  normally?: GlobNormally['normally']
}

type GlobHasFiles = {
  glob: string
  alias?: AliasReplaced & { files: string[] }
  files: string[]
}
type GlobNormally = {
  normally: {
    glob: string
    alias?: AliasReplaced
  }
}
type GlobFilesResult = GlobHasFiles | GlobNormally | null

async function globFiles(
  dynamicImport: DynamicImportVars,
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

  const { alias, glob: globObj } = await dynamicImport.dynamicImportToGlob(
    node.source,
    code.substring(node.start, node.end),
    pureId,
  )
  if (!globObj.valid) {
    if (normallyImporteeRE.test(globObj.glob)) {
      return { normally: { glob: globObj.glob, alias } }
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

  let aliasWithFiles: GlobHasFiles['alias']
  if (alias) {
    const static1 = alias.importee.slice(0, alias.importee.indexOf('*'))
    const static2 = alias.replacedImportee.slice(0, alias.replacedImportee.indexOf('*'))
    aliasWithFiles = {
      ...alias,
      files: files.map(file =>
        // Recovery alias `./views/*` -> `@/views/*`
        file.replace(static2, static1)
      ),
    }
  }

  return {
    glob,
    alias: aliasWithFiles,
    files,
  }
}

function listImporteeMappings(
  glob: string,
  extensions: string[],
  importeeList: string[],
  alias?: GlobHasFiles['alias'],
) {
  const hasExtension = extensions.some(ext => glob.endsWith(ext))
  return importeeList.reduce((memo, importee, idx) => {
    const realFilepath = importee
    importee = alias ? alias.files[idx] : importee
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
