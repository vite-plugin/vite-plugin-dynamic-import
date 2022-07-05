## [2022-05-31] v0.9.6

- 🐞 [issues/4](https://github.com/vite-plugin/vite-plugin-dynamic-import/issues/4)
- 🌱 Support `import(node_modules/xxx)`

## [2022-06-03] v0.9.7

- refactor: remove vite-plugin-utils
- refactor: merge alias.ts into resolve.ts
- refactor: use resolve only
- refactor: migration alias to resolve

## [2022-06-09] v0.9.7-beta2

- 8c7a026 backup(v0.9.7): remove files
- 9d61af8 test(v0.9.7-beta2): UPD main-output.js
- d070477 backup(v0.9.7): rename files
- d0c6147 refactor(v0.9.7-beta2): better logic
- ca85c88 feat: `tryFixGlobSlash()`, `toDepthGlob()`, `mappingPath()`
- 1e9b102 chore: optimize code
- 6748dab feat: dynamic-import-to-glob.ts
- 065d945 chore: test based on vite.config.ts
- bd6a933 chore: optimize code

## [2022-06-09] v0.9.8

- 5807515 feat: `resolve.parseImportee()`
- 0054f4a chore: remove `extractImporteeRE`, `isRaw()`, `parseImportee()`
- cb39a4a fix: use `String.slice()` instead of `parseImportee()`
- 603a256 fix: use `String.slice()` instead of `RegExp`

## [2022-06-13] v0.9.9

- 84eda9b test: v0.9.9
- c7f0799 docs: v0.9.9
- e9f65e9 fix(🐞): skip itself from glob
- 2b38f0f test: optimize code
- 809d818 docs: update
- ec9036d remove types.ts
- 23af7ee chore: AcornNode
- 8adc6fe Merge pull request #9 from vite-plugin/dev
- bd74200 chore: comments

## [2022-07-04] v1.0.0

- 71af433 docs: v1.0.0
- 45eace4 chore:more exact match `.vite/`
- ebd993c 🚨:use `options.loose` instead of `options.depth`
