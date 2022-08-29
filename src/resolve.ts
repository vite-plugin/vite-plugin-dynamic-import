import fs from 'fs'
import path from 'path'
import {
  type Alias,
  type ResolvedConfig,
  normalizePath,
} from 'vite'
import { relativeify } from './utils'

export interface Resolved {
  type: 'alias' | 'bare'
  alias: Omit<Alias, 'customResolver'> & {
    /** stringify of `Alias['find']` */
    findString: string
    /** relative path of `Alias['replacement']` */
    relative: string
  }
  import: {
    /** 
     * 1. what the user passes in is what it is
     * 2. always starts with alias or bare
     */
    importee: string
    importer: string
    /** always relative path */
    resolved: string
  }
}

/**
 * This is different from the resolve of Vite. Which only resolves `node_module` and `alias` into relative paths.  
 * 这和 Vite 的 resolve 并不一样，它只是将 node_modules、alias 解析成相对路径  
 */
export class Resolve {

  constructor(
    private config: ResolvedConfig,
    private resolve = config.createResolver(),
  ) { }

  /**
   * Resolve the relative path of alias or bare(module)  
   * 解析 alias 或 bare(裸模块) 的相对路径  
   */
  public async tryResolve(importee: string, importer: string): Promise<Resolved | undefined> {
    return await this.tryResolveAlias(importee, importer) || this.tryResolveBare(importee, importer)
  }

  private async tryResolveAlias(importee: string, importer: string): Promise<Resolved> {
    const { importee: ipte, importeeRaw = ipte } = this.parseImportee(importee)

    // It may not be elegant here, just to look consistent with the behavior of the Vite
    // Maybe this means support for `alias.customResolver`
    const resolvedId = await this.resolve(ipte, importer, true)
    if (!resolvedId) return

    const alias = this.config.resolve.alias.find(
      a => a.find instanceof RegExp
        ? a.find.test(ipte)
        // https://github.com/rollup/plugins/blob/8fadc64c679643569239509041a24a9516baf340/packages/alias/src/index.ts#L16
        : ipte.startsWith(a.find + /* 🚧-④ */'/')
    )
    if (!alias) return

    const findString = alias.find instanceof RegExp
      ? alias.find.exec(importee)[0]
      : alias.find
    const relativePath = alias.replacement.startsWith('.')
      ? alias.replacement
      : relativeify(path.posix.relative(path.dirname(importer), alias.replacement))
    const resolvedAlias: Resolved['alias'] = {
      ...alias,
      findString,
      relative: findString.endsWith('/')
        ? (relativePath.endsWith('/') ? relativePath : relativePath + '/')
        : relativePath,
    }

    return {
      type: 'alias',
      ...this.resolveAlias(importeeRaw, importer, resolvedAlias),
    }
  }

  private tryResolveBare(importee: string, importer: string): Resolved {
    const { importee: ipte, importeeRaw = ipte } = this.parseImportee(importee)

    // it's relative or absolute path
    if (/^[\.\/]/.test(ipte)) {
      return
    }

    const paths = ipte.split('/')
    const node_modules = path.join(this.config.root, 'node_modules')
    let level = ''
    let find: string, replacement: string

    // Find the last level of effective path step by step
    let p: string; while (p = paths.shift()) {
      level = path.posix.join(level, p)
      const fullPath = path.join(node_modules, level)
      if (fs.existsSync(fullPath)) {
        find = level
        const relativePath = relativeify(path.posix.relative(path.dirname(importer), node_modules))
        // Nearest path and node_modules sibling
        // e.g. `ui-lib/${theme}/style.css` -> `./node_modules/ui-lib/${theme}/style.css`
        replacement = `${relativePath}/${level}`
      }
    }
    if (!find) return

    // Fake the bare module of node_modules into alias, and `replacement` here is a relative path
    const alias: Resolved['alias'] = {
      find,
      replacement,
      findString: find,
      relative: replacement.startsWith('.')
        ? replacement
        : relativeify(path.posix.relative(path.dirname(importer), replacement)),
    }
    return {
      type: 'bare',
      ...this.resolveAlias(importeeRaw, importer, alias)
    }
  }

  private resolveAlias(
    importee: string,
    importer: string,
    alias: Resolved['alias'],
  ): Omit<Resolved, 'type'> {
    const { find, replacement } = alias
    let {
      importee: ipte,
      importeeRaw = ipte,
      startQuotation = '',
    } = this.parseImportee(importee)

    if (replacement.startsWith('.')) {
      // relative path
      ipte = ipte.replace(find, replacement)
    } else {
      // compatible with vite restrictions
      // https://github.com/vitejs/vite/blob/1e9615d8614458947a81e0d4753fe61f3a277cb3/packages/vite/src/node/plugins/importAnalysis.ts#L672
      const relativePath = relativeify(path.posix.relative(
        // Usually, the `replacement` we use is the directory path
        // So we also use the `path.dirname` path for calculation
        path.dirname(/* 🚧-① */importer),
        normalizePath(replacement),
      ))
      ipte = ipte.replace(find instanceof RegExp ? find : find + /* 🚧-④ */'/', '')
      ipte = `${relativePath}/${ipte}`
    }

    return {
      alias,
      import: {
        importee: importeeRaw,
        importer,
        resolved: startQuotation + ipte,
      },
    }
  }

  private parseImportee(importee: string) {
    const result: {
      importee: string
      importeeRaw?: string
      startQuotation?: string
    } = { importee }
    if (/^[`'"]/.test(importee)) {
      result.importee = importee.slice(1)
      result.importeeRaw = importee
      result.startQuotation = importee.slice(0, 1)
      // why not `endQuotation` ?
      // in fact, may be parse `endQuotation` is meaningless
      // e.g. `import('./foo/' + path)`
    }
    return result
  }
}
