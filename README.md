# vite-plugin-dynamic-import

Enhance Vite builtin dynamic import

[![NPM version](https://img.shields.io/npm/v/vite-plugin-dynamic-import.svg)](https://npmjs.org/package/vite-plugin-dynamic-import)
[![NPM Downloads](https://img.shields.io/npm/dm/vite-plugin-dynamic-import.svg?style=flat)](https://npmjs.org/package/vite-plugin-dynamic-import)
[![awesome-vite](https://awesome.re/badge.svg)](https://github.com/vitejs/awesome-vite)

English | [简体中文](https://github.com/vite-plugin/vite-plugin-dynamic-import/blob/main/README.zh-CN.md)

✅ alias  
✅ bare module(node_modules)  
✅ compatible `@rollup/plugin-dynamic-import-vars` restrictions  

## Install

```bash
npm i vite-plugin-dynamic-import -D
```

## Usage

```javascript
import dynamicImport from 'vite-plugin-dynamic-import'

export default {
  plugins: [
    dynamicImport(/* options */)
  ]
}
```

cases 👉 [vite-plugin-dynamic-import/test](https://github.com/vite-plugin/vite-plugin-dynamic-import/blob/main/test)

## API

dynamicImport([options])

```ts
export interface Options {
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
```

## How and why?

*We assume that the project structure is as follows*

```tree
├─┬ src
│ ├─┬ views
│ │ ├─┬ foo
│ │ │ └── index.js
│ │ └── bar.js
│ └── router.js
└── vite.config.js
```

```js
// vite.config.js
export default {
  resolve: {
    alias: {
      // "@" -> "/User/project-root/src/views"
      '@': path.join(__dirname, 'src/views'),
    },
  },
}
```

*Dynamic import is not well supported in Vite, such as*

- Alias are not supported

```js
// router.js
❌ import(`@/views/${variable}.js`)
```

- Must be relative

```js
// router.js
❌ import(`/User/project-root/src/views/${variable}.js`)
```

- Must have extension

```js
// router.js
❌ import(`./views/${variable}`)
```

*We try to fix these problems*

For the alias in `import()`, we can calculate the relative path according to `UserConfig.root`

```js
// router.js
✅ import(`./views/${variable}.js`)
```

If the import path has no suffix, we use **[glob](https://www.npmjs.com/package/fast-glob)** to find the file according to `UserConfig.resolve.extensions` and supplement the suffix of the import path.  
So we need to list all the possibilities

1. transpire dynamic import variable, yout can see [@rollup/plugin-dynamic-import-vars](https://github.com/rollup/plugins/tree/master/packages/dynamic-import-vars#how-it-works)

`./views/${variable}` -> `./views/*`

2. generate runtime code

```diff
- // import(`./views/${variable}`)
+ __variableDynamicImportRuntime(`./views/${variable}`)

+ function __variableDynamicImportRuntime(path) {
+   switch (path) {
+     case 'foo':
+     case 'foo/index':
+     case 'foo/index.js':
+       return import('./views/foo/index.js');
+ 
+     case 'bar':
+     case 'bar.js':
+       return import('./views/bar.js');
+ }
```
