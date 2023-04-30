# vite-plugin-dynamic-import

增强 Vite 内置的 dynamic import

[![NPM version](https://img.shields.io/npm/v/vite-plugin-dynamic-import.svg)](https://npmjs.org/package/vite-plugin-dynamic-import)
[![NPM Downloads](https://img.shields.io/npm/dm/vite-plugin-dynamic-import.svg?style=flat)](https://npmjs.org/package/vite-plugin-dynamic-import)
[![awesome-vite](https://awesome.re/badge.svg)](https://github.com/vitejs/awesome-vite)

[English](https://github.com/vite-plugin/vite-plugin-dynamic-import#readme) | 简体中文

✅ Alias  
✅ Bare module(node_modules)  
✅ 兼容 `@rollup/plugin-dynamic-import-vars` [限制](https://github.com/rollup/plugins/tree/master/packages/dynamic-import-vars#limitations)  
✅ 更像 Webpack  

## 安装

```bash
npm i vite-plugin-dynamic-import -D
```

## 使用

```javascript
import dynamicImport from 'vite-plugin-dynamic-import'

export default {
  plugins: [
    dynamicImport(/* options */)
  ]
}
```

案例 👉 [vite-plugin-dynamic-import/test](https://github.com/vite-plugin/vite-plugin-dynamic-import/blob/main/test)

#### node_modules

```js
dynamicImport({
  filter(id) {
    // 默认会排除 `node_modules`，所以必须显式的包含它
    // https://github.com/vite-plugin/vite-plugin-dynamic-import/blob/v1.3.0/src/index.ts#L133-L135
    if (id.includes('/node_modules/foo')) {
      return true
    }
  }
})
```

## API

dynamicImport([options])

```ts
export interface Options {
  filter?: (id: string) => boolean | void
  /**
   * ```
   * 1. `true` - 尽量匹配所有可能场景, 功能更像 `webpack`
   * 链接 https://webpack.js.org/guides/dependency-management/#require-with-expression
   * 
   * 2. `false` - 功能更像rollup的 `@rollup/plugin-dynamic-import-vars`插件
   * 链接 https://github.com/rollup/plugins/tree/master/packages/dynamic-import-vars#how-it-works
   * 
   * default true
   * ```
   */
  loose?: boolean
  /**
   * 如果你想排除一些文件  
   * 举俩🌰 `type.d.ts`, `interface.ts`
   */
  onFiles?: (files: string[], id: string) => typeof files | void
  /**
   * 自定义 importee
   * 
   * e.g. - 在 importee 前面插入 `\/*@vite-ignore*\/` 绕过 Vite
   */
  onResolve?: (rawImportee: string, id: string) => typeof rawImportee | void
}
```

## 作此为甚？

*假如有如下项目结构*

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

*动态导入在 Vite 中支持的不甚友好, 举几个 🌰*

- 用不了别名

```js
// router.js
❌ import(`@/views/${variable}.js`)
```

- 必须相对路径

```js
// router.js
❌ import(`/User/project-root/src/views/${variable}.js`)
```

- 必须含文件尾缀

```js
// router.js
❌ import(`./views/${variable}`)
```

*我们尝试与这个糟糕的世界怼一怼*

要想在 `import()` 直接使用别名那肯定是不行哒；既要使用别名，还要根据别名计算相对路径

```js
// router.js
✅ import(`./views/${variable}.js`)
```

导入路径没有尾缀的情况, 我们需要使用 **[glob](https://www.npmjs.com/package/fast-glob)** 根据 `UserConfig.resolve.extensions` 找到文件并且补全路径。    
所以嘛，得列出所有的可能性才行的就是说

1. 先把路径转换成 `glob` 形式，抄自 [@rollup/plugin-dynamic-import-vars](https://github.com/rollup/plugins/tree/master/packages/dynamic-import-vars#how-it-works)

`./views/${variable}` -> `./views/*`

2. 然后生成运行时代码

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
