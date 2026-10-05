import { readFile } from 'node:fs/promises'
import { transform } from 'lightningcss'
import { basename, dirname, resolve as resolvePath } from 'node:path'

const ID = 'dsh-plugin-graph'   // 必须 === package.json name

/**
 * 浏览器模块表的基线清单：必须与 DSH 的
 * `packages/client/web/src/platform.ts`（PLATFORM_MODULES）逐字一致。
 * 这些名字留在 bundle 之外，由 loader 交给 factory 的 require 回答；其余依赖一律内联。
 * 已下线的名字（dsh-client-web-react / dsh-client-ui-attachment /
 * dsh-client-schema-form）若残留，产物会在运行时 require 到模块表里不存在的键并抛错；
 * 缺失的基线名字（react-dom / dsh-client-store / dsh-client-ui-dockkit）则会重复内联宿主已有的实例。
 */
const EXTERNALS = new Set([
    'react', 'react/jsx-runtime', 'react-dom', 'react-dom/client',
    '@deepseek-ai/cordis',
    '@deepseek-ai/dsh-client-store',
    '@deepseek-ai/dsh-client-ui-slots',
    '@deepseek-ai/dsh-client-ui-primitives',
    '@deepseek-ai/dsh-client-ui-dockkit',
])

const CSS_VIRTUAL_PREFIX = '\0dsh-css:'
const CSS_VIRTUAL_SUFFIX = '.mjs'

export default [
    // node 半部：ESM。fixedExtension:false 是必需的——tsdown 默认给 ESM 产出 .mjs，
    // 而 package.json 的 main/exports 指向 lib/index.js。
    { name: ID, entry: ['src/index.ts'],
        outDir: 'lib', format: ['esm'], platform: 'node', fixedExtension: false,
        dts: false, clean: false },
    // 浏览器半部：CJS 闭包工厂（window.__ModuleLoader__.load）
    { name: `${ID}/client`, entry: { client: 'src/client/index.ts' },
        outDir: 'lib', format: 'cjs', platform: 'browser', dts: false, clean: false,
        // deps.neverBundle / deps.alwaysBundle 取代了已废弃的 external / noExternal
        // （tsdown 会为后者打印 deprecated 警告，而 --fail-on-warn 默认开启）。
        deps: {
            neverBundle: (id: string) => EXTERNALS.has(id),
            alwaysBundle: (id: string) => !EXTERNALS.has(id),
        },
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
