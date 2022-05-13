export interface DynamicImportRuntime {
  name: string
  body: string
}

export function generateDynamicImportRuntime(
  // localFilename: Array<possible importee>
  entries: Record<string, string[]>,
  dynamicImportIndex: number | string,
): DynamicImportRuntime {
  const name = `__variableDynamicImportRuntime${dynamicImportIndex}__`
  const cases = Object.entries(entries).map(([localFile, importeeList]) => {
    const c = importeeList.map(importee => `    case '${importee}':`)
    return `${c.join('\n')}
      return import('${localFile}');
`
  })
  const body = `
function ${name}(path) {
  switch (path) {
${cases.join('\n')}
    default: return new Promise(function(resolve, reject) {
      (typeof queueMicrotask === 'function' ? queueMicrotask : setTimeout)(
        reject.bind(null, new Error("Unknown variable dynamic import: " + path))
      );
    })
  }
}
`

  return { name, body }
}
