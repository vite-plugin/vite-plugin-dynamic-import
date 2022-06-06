import fs from 'fs'
import path from 'path'
import {
  type Alias,
  type ResolvedConfig,
  normalizePath,
} from 'vite'
import { parseImportee } from './utils'

export interface Resolved {
  type: 'alias' | 'bare'
  alias: Alias
  import: {
    importee: string
    resolved: string
  }
}

export class Resolve {

  constructor(
    private config: ResolvedConfig,
    private resolve = config.createResolver(),
  ) { }

  public async tryResolve(importee: string, id: string): Promise<Resolved | void> {
    return await this.tryResolveAlias(importee, id) || this.tryResolveBare(importee, id)
  }

  private async tryResolveAlias(importee: string, id: string): Promise<Resolved | void> {
    const [, impt] = parseImportee(importee)

    // It may not be elegant here, just to look consistent with the behavior of the Vite
    // Maybe this means support for `alias.customResolver`
    const resolvedId = await this.resolve(impt, id, true)
    if (!resolvedId) return

    const alias = this.config.resolve.alias.find(
      alias => alias.find instanceof RegExp
        ? alias.find.test(impt)
        // https://github.com/rollup/plugins/blob/8fadc64c679643569239509041a24a9516baf340/packages/alias/src/index.ts#L16
        : impt.startsWith(alias.find + '/')
    )
    if (!alias) return

    return {
      type: 'alias',
      ...this.resolveAlias(importee, id, alias),
    }
  }

  private tryResolveBare(importee: string, id: string): Resolved | void {
    const [, impt] = parseImportee(importee)

    // It's relative or absolute path
    if (/^[\.\/]/.test(impt)) {
      return
    }

    const paths = impt.split('/')
    const node_modules = path.join(this.config.root, 'node_modules')
    let level = ''
    let find: string, replacement: string

    // Find the last level of effective path step by step
    let p: string; while (p = paths.shift()) {
      level = path.join(level, p)
      const fullPath = path.join(node_modules, level)
      if (fs.existsSync(fullPath)) {
        find = level
        const normalId = normalizePath(id)
        let relp = path.relative(path.dirname(normalId), node_modules)
        if (relp === '') {
          relp = '.'
        }
        replacement = relp + '/' + level
      }
    }
    if (!find) return

    // Fake the bare module of node_modules into alias, and `replacement` here is a relative path
    const alias: Alias = { find, replacement }
    return {
      type: 'bare',
      ...this.resolveAlias(importee, id, alias)
    }
  }

  private resolveAlias(
    importee: string,
    id: string,
    alias: Alias,
  ): Omit<Resolved, 'type'> {
    let [startQuotation, impt] = parseImportee(importee)
    const { find, replacement } = alias

    if (replacement.startsWith('.')) {
      // Relative path
      impt = impt.replace(find, replacement)
    } else {
      const normalId = normalizePath(id)
      const normalReplacement = normalizePath(replacement)

      // Compatible with vite restrictions
      // https://github.com/vitejs/vite/blob/1e9615d8614458947a81e0d4753fe61f3a277cb3/packages/vite/src/node/plugins/importAnalysis.ts#L672
      let relativePath = path.relative(
        // Usually, the `replacement` we use is the directory path
        // So we also use the `path.dirname` path for calculation
        path.dirname(/* 🚧-① */normalId),
        normalReplacement,
      )
      if (relativePath === '') {
        relativePath = /* 🚧-③ */'.'
      }
      const relativeImportee = relativePath + '/' + impt
        .replace(find, '')
        // Remove the beginning /
        .replace(/^\//, '')
      impt = relativeImportee
    }

    return {
      alias,
      import: {
        importee,
        resolved: startQuotation + impt,
      },
    }
  }
}