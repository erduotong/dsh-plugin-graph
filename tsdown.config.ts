import { readFile } from 'node:fs/promises'
import { transform } from 'lightningcss'
import { basename, dirname, resolve as resolvePath } from 'node:path'

const ID = 'dsh-plugin-graph'   // 必须 === package.json name
// 平台模块：浏览器 require 由 loader 模块表回答，不能打进 bundle
const EXTERNALS = ['react', 'react/jsx-runtime', '@deepseek-ai/cordis',
    '@deepseek-ai/dsh-client-ui-slots', '@deepseek-ai/dsh-client-web-react',
    '@deepseek-ai/dsh-client-ui-primitives', '@deepseek-ai/dsh-client-ui-attachment',
    '@deepseek-ai/dsh-client-schema-form']

const CSS_VIRTUAL_PREFIX = '\0dsh-css:'
const CSS_VIRTUAL_SUFFIX = '.mjs'

export default [
    // node 半部：ESM
    { name: ID, entry: ['lib/types/index.js', 'lib/types/invariant.js'],
        outDir: 'lib', format: ['esm'], platform: 'node', dts: false, clean: false },
    // 浏览器半部：CJS 闭包工厂
    { name: `${ID}/client`, entry: { client: 'src/client/index.ts' },
        outDir: 'lib', format: 'cjs', platform: 'browser', dts: false, clean: false,
        external: EXTERNALS, noExternal: id => (EXTERNALS.includes(id) ? undefined : true),
        plugins: [{
            name: 'dsh-css-modules-inline',
            resolveId(source: string, importer: string | undefined) {
                if (!source.endsWith('.module.css')) return null
                // Windows 路径必须用 path.resolve，不能过 URL.pathname（会加前导 / 导致 D:\D:\ 双盘符）
                const abs = importer !== undefined ? resolvePath(dirname(importer), source) : source
                return CSS_VIRTUAL_PREFIX + abs + CSS_VIRTUAL_SUFFIX
            },
            async load(virtualId: string) {
                if (!virtualId.startsWith(CSS_VIRTUAL_PREFIX)) return null
                const fileId = virtualId.slice(CSS_VIRTUAL_PREFIX.length, -CSS_VIRTUAL_SUFFIX.length)
                this.addWatchFile(fileId)
                const source = await readFile(fileId)
                const { code, exports: cssExports } = transform({
                    filename: fileId, code: source,
                    cssModules: { pattern: '[hash]_[local]' }, minify: true,
                })
                const classMap: Record<string, string> = {}
                for (const [local, exp] of Object.entries(cssExports ?? {})) classMap[local] = exp.name
                const tagId = `${ID}/${basename(fileId)}`
                return [
                    `const css = ${JSON.stringify(code.toString())};`,
                    `const tagId = ${JSON.stringify(tagId)};`,
                    "if (typeof document !== 'undefined' && document.querySelector('style[data-plugin-css=' + JSON.stringify(tagId) + ']') === null) {",
                    `  const tag = document.createElement('style');`,
                    `  tag.dataset.plugin = ${JSON.stringify(ID)};`,
                    '  tag.dataset.pluginCss = tagId;',
                    '  tag.textContent = css;',
                    '  document.head.appendChild(tag);',
                    '}',
                    `export default ${JSON.stringify(classMap)};`,
                ].join('\n')
            },
        }],
        outputOptions: {
            entryFileNames: 'client.js',
            banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(ID)}, factory: (require) => {`,
            footer: 'return module.exports; } });',
            intro: 'var module = { exports: {} }; var exports = module.exports;',
        } }
]