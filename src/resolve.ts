import fs from 'fs'
import path from 'path'
import {
  type Alias,
  type ResolvedConfig,
  normalizePath,
} from 'vite'
import { extractImporteeRE } from './utils'

// TODO: Consider integrating `AliasContext` into `Resolve`

export class Resolve {

  constructor(
    private config: ResolvedConfig,
  ) { }

  public node_modules(importee: string, id: string): Alias | void {
    let ipte = importee 
    
    if (/^[`'"]/.test(ipte)) {
      const matched = ipte.match(extractImporteeRE)
      if (matched) {
        [, , ipte] = matched
      }
    }

    // It's relative or absolute path
    if (/^[\.\/]/.test(ipte)) {
      return
    }

    const paths = ipte.split('/')
    const rootDir = path.join(this.config.root, 'node_modules')
    let tmp = ''
    let p: string
    let find: string, replacement: string
    // Find the last level of effective path step by step
    while (p = paths.shift()) {
      tmp = path.join(tmp, p)
      const fullPath = path.join(rootDir, tmp)
      if (fs.existsSync(fullPath)) {
        find = tmp
        const normalId = normalizePath(id)
        let relp = path.relative(path.dirname(normalId), rootDir)
        if (relp === '') {
          relp = '.'
        }
        replacement = relp + '/' + tmp
      }
    }
    if (find) {
      // Fake the bare module of node_modules into alias
      // `replacement` here is a relative path !!!!
      return { find, replacement }
    }
  }
}