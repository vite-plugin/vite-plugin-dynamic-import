import path from 'path'
import type { AcornNode as AcornNode2 } from 'rollup'
export type AcornNode<T = any> = AcornNode2 & Record<string, T>

const example = 'For example: import(`./foo/${bar}.js`).'

function sanitizeString(str: string) {
  if (str.includes('*')) {
    throw new Error('A dynamic import cannot contain * characters.')
  }
  return str
}

function templateLiteralToGlob(node: AcornNode) {
  let glob = ''

  for (let i = 0; i < node.quasis.length; i += 1) {
    glob += sanitizeString(node.quasis[i].value.raw)
    if (node.expressions[i]) {
      glob += expressionToGlob(node.expressions[i])
    }
  }

  return glob
}

function callExpressionToGlob(node: AcornNode) {
  const { callee } = node
  if (
    callee.type === 'MemberExpression' &&
    callee.property.type === 'Identifier' &&
    callee.property.name === 'concat'
  ) {
    return `${expressionToGlob(callee.object)}${node.arguments.map(expressionToGlob).join('')}`
  }
  return '*'
}

function binaryExpressionToGlob(node: AcornNode) {
  if (node.operator !== '+') {
    throw new Error(`${node.operator} operator is not supported.`)
  }

  return `${expressionToGlob(node.left)}${expressionToGlob(node.right)}`
}

function expressionToGlob(node: AcornNode): string {
  switch (node.type) {
    case 'TemplateLiteral':
      // import(`./foo/${bar}`)
      return templateLiteralToGlob(node)
    case 'CallExpression':
      // import('./foo/'.concat(bar))
      return callExpressionToGlob(node)
    case 'BinaryExpression':
      // import('./foo/' + bar)
      return binaryExpressionToGlob(node)
    case 'Literal':
      // import('./foo/bar')
      return sanitizeString(node.value) // Recursive output
    default: 'Identifier'
      return '*'
  }
}

/**
 * This is slightly different from '@rollup/plugin-dynamic-import-vars', added a `resolver`  
 * 这与 '@rollup/plugin-dynamic-import-vars' 略有不同，增加了一个 resolver  
 * 
 * @see https://github.com/rollup/plugins/blob/master/packages/dynamic-import-vars/src/dynamic-import-to-glob.js  
 */
export async function dynamicImportToGlob(
  node: AcornNode,
  sourceString: string,
  /**
   * The `resolver` for processing alias or bare(node_modules), 
   * and try to add extension for compatible restrict of '@rollup/plugin-dynamic-import-vars'
   * 
   *```
   * e.g.
   * import(`@/foo/${bar}`)
   * ↓
   * import(`./foo/${bar}.extension`)
   * 
   * import(`@ant-design/icons/es/icons/${name}Outlined`)
   * ↓
   * import(`./node_modules/icons/es/icons/${name}Outlined.extension`)
   * ```
   */
  resolver?: (glob: string) => string | Promise<string>,
): Promise<string> {
  let glob = expressionToGlob(node)
  glob = await resolver(glob) ?? glob
  if (!glob.includes('*') || glob.startsWith('data:')) {
    return null
  }
  glob = glob.replace(/\*\*/g, '*')

  if (glob.startsWith('*')) {
    throw new Error(
      `invalid import "${sourceString}". It cannot be statically analyzed. Variable dynamic imports must start with ./ and be limited to a specific directory. ${example}`
    )
  }

  if (glob.startsWith('/')) {
    throw new Error(
      `invalid import "${sourceString}". Variable absolute imports are not supported, imports must start with ./ in the static part of the import. ${example}`
    )
  }

  if (!glob.startsWith('./') && !glob.startsWith('../')) {
    throw new Error(
      `invalid import "${sourceString}". Variable bare imports are not supported, imports must start with ./ in the static part of the import. ${example}`
    )
  }

  // Disallow ./*.ext
  const ownDirectoryStarExtension = /^\.\/\*\.[\w]+$/
  if (ownDirectoryStarExtension.test(glob)) {
    throw new Error(
      `invalid import "${sourceString}". Variable imports cannot import their own directory, place imports in a separate directory or make the import filename more specific. ${example}`
    )
  }

  if (path.extname(glob) === '') {
    throw new Error(
      `invalid import "${sourceString}". A file extension must be included in the static part of the import. ${example}`
    )
  }

  return glob
}
