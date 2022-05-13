import path from 'path'
import type { AliasContext, AliasReplaced } from './alias'
import type { AcornNode } from './types'

export interface ImporteeGlob {
  glob: {
    glob: string
    valid: boolean
  }
  alias?: AliasReplaced
}

export class DynamicImportVars {
  constructor(
    private aliasContext: AliasContext
  ) { }

  public async dynamicImportToGlob(
    node: AcornNode,
    sourceString: string,
    id: string,
  ): Promise<ImporteeGlob> {
    const result: Partial<ImporteeGlob> = {}

    const aliasReplacer = async (globImportee: string) => {
      const replaced = await this.aliasContext.replaceImportee(globImportee, id)
      result.alias = replaced as typeof result.alias
      return replaced ? replaced.replacedImportee : globImportee
    }
    result.glob = await dynamicImportToGlob(node, sourceString, aliasReplacer)

    return result as ImporteeGlob
  }
}

// The following part is the `@rollup/plugin-dynamic-import-vars` source code
// https://github.com/rollup/plugins/blob/master/packages/dynamic-import-vars/src/dynamic-import-to-glob.js
class VariableDynamicImportError extends Error { }

/* eslint-disable-next-line no-template-curly-in-string */
const example = 'For example: import(`./foo/${bar}.js`).';

function sanitizeString(str) {
  if (str.includes('*')) {
    throw new VariableDynamicImportError('A dynamic import cannot contain * characters.');
  }
  return str;
}

function templateLiteralToGlob(node) {
  let glob = '';

  for (let i = 0; i < node.quasis.length; i += 1) {
    glob += sanitizeString(node.quasis[i].value.raw);
    if (node.expressions[i]) { // quasis 永远比 expressions 长一位
      glob += expressionToGlob(node.expressions[i]);
    }
  }

  return glob;
}

function callExpressionToGlob(node) {
  const { callee } = node;
  if (
    callee.type === 'MemberExpression' &&
    callee.property.type === 'Identifier' &&
    callee.property.name === 'concat'
  ) {
    return `${expressionToGlob(callee.object)}${node.arguments.map(expressionToGlob).join('')}`;
  }
  return '*';
}

function binaryExpressionToGlob(node) {
  if (node.operator !== '+') {
    throw new VariableDynamicImportError(`${node.operator} operator is not supported.`);
  }

  return `${expressionToGlob(node.left)}${expressionToGlob(node.right)}`;
}

function expressionToGlob(node) {
  switch (node.type) {
    case 'TemplateLiteral':
      // import(`@/pages/${path}`)
      return templateLiteralToGlob(node);
    case 'CallExpression':
      // import('@/pages/'.concat(path))
      return callExpressionToGlob(node);
    case 'BinaryExpression':
      // import('@/pages/' + path)
      return binaryExpressionToGlob(node);
    case 'Literal': {
      // import('@/pages/path')
      return sanitizeString(node.value);
    }
    default:
      return '*';
  }
}

async function dynamicImportToGlob(node, sourceString, aliasReplacer) {
  let glob = expressionToGlob(node);
  glob = await aliasReplacer(glob);
  if (!glob.includes('*') || glob.startsWith('data:')) {
    // After `expressiontoglob` processing, it may become a normal path
    return { glob, valid: false };
  }
  glob = glob.replace(/\*\*/g, '*');

  if (glob.startsWith('*')) {
    throw new VariableDynamicImportError(
      `invalid import "${sourceString}". It cannot be statically analyzed. Variable dynamic imports must start with ./ and be limited to a specific directory. ${example}`
    );
  }

  if (glob.startsWith('/')) {
    throw new VariableDynamicImportError(
      `invalid import "${sourceString}". Variable absolute imports are not supported, imports must start with ./ in the static part of the import. ${example}`
    );
  }

  if (!glob.startsWith('./') && !glob.startsWith('../')) {
    throw new VariableDynamicImportError(
      `invalid import "${sourceString}". Variable bare imports are not supported, imports must start with ./ in the static part of the import. ${example}`
    );
  }

  // Disallow ./*.ext
  const ownDirectoryStarExtension = /^\.\/\*\.[\w]+$/;
  if (ownDirectoryStarExtension.test(glob)) {
    throw new VariableDynamicImportError(
      `${`invalid import "${sourceString}". Variable imports cannot import their own directory, ` +
      'place imports in a separate directory or make the import filename more specific. '
      }${example}`
    );
  }

  // 🚧-② This will be handled using `tryFixGlobExtension()`
  // if (path.extname(glob) === '') {
  //   throw new VariableDynamicImportError(
  //     `invalid import "${sourceString}". A file extension must be included in the static part of the import. ${example}`
  //   );
  // }

  return { glob, valid: true };
}

/**
 * ```
 * In some cases, glob may not be available  
 * e.g. fill necessary slash  
 * `./views*` -> `./views/*`
 * `./views*.js` -> `./views/*.js`
 * ```
 */
export function tryFixGlobSlash(glob: string, depth = true): string | void {
  const extname = path.extname(glob)
  // It could be `./views*.js`, which needs to be repaired to `./views/*.js`
  glob = glob.replace(extname, '')

  // #20
  const [, importPath] = glob.match(/(.*\/?)\*/)
  if (!importPath.endsWith('/')) {
    // fill necessary slash
    // `./views*` -> `./views/*`
    let fixedGlob = glob.replace(importPath, importPath + '/')

    fixedGlob = depth ? toDepthGlob(fixedGlob) : fixedGlob

    // if it has a '.js' extension
    // `./views/*` -> `./views/*.js`
    fixedGlob += extname

    return fixedGlob
  }
}

/**
 * ```
 * 🚧-② If not extension is not specified, fill necessary extensions  
 * e.g.
 * `./views/*`
 *   -> `./views/*.{js,ts,vue ...}`
 *   -> `./views/*` + `/index.{js,ts,vue ...}`
 * ```
 */
export function tryFixGlobExtension(glob: string, extensions: string[]): { globWithIndex?: string; glob: string } | void {
  if (!extensions.includes(path.extname(glob))) {
    const bareExts = extensions.map(ext => ext.slice(1))
    return {
      globWithIndex: glob.includes('**')
        // `**` including `*/index`
        ? undefined
        : glob + '/index.' + `{${bareExts.join(',')}}`,
      glob: glob + `.{${bareExts.join(',')}}`,
    }
  }
}

// Match as far as possible
// `./views/*` -> `./views/**/*`
export function toDepthGlob(glob: string): string {
  const extname = path.extname(glob)

  return glob
    .replace(extname, '')
    .replace(/^(.*)(?<!\*\*)\/\*$/, '$1/**/*') + extname
}
