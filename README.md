# dsh-plugin-graph

DeepSeek Harness（DSH）Web 设置页插件：以**力导向图**（Koishi / Obsidian 风格）可视化客户端插件之间的关系。

> Tip: 这是一个dsh自己写的项目，还在快速完善中
> 如有好的想法，欢迎提出Issue~
## 功能

- **力导向图画布**：节点自动物理布局，节点按度数缩放。
- **两类节点**：
  - 插件节点（蓝色圆点）—— 来自启动清单 `window.__DSH_BOOT__` 与插槽注册表；
  - 插槽节点（琥珀色菱形）—— 来自实时插槽注册表 `ctx.slots.snapshot()`。
- **三类彩色边**：
  - 蓝色 `inject` —— 插件对其它包的依赖；
  - 绿色 `declares` —— 插槽声明者；
  - 琥珀色 `registers` —— 注册到插槽的插件。
- **交互**：拖拽节点（重新加热布局）、拖拽空白平移、滚轮缩放、悬停高亮相邻节点并弹出信息框（显示依赖/被依赖、声明者/注册者）。
- **放大查看**：画布右上角展开按钮，打开全屏模态框，支持 Esc / 遮罩 / × 关闭。
- **只读快照**：不订阅任何事件，挂载与手动刷新时重建图。

## 快速上手

### 1. 前置条件

- 已安装 DeepSeek Harness，并至少启动过一次 Web 界面（会生成 `~/.dsh/profiles/web`）。

### 2. 安装插件

二选一：



**方式 A：从 npm registry 安装（推荐一般用户使用）**

```bash
dsh plugin --profile web add dsh-plugin-graph
```

**方式 B：从本地源码目录安装（开发 / 未发布时）**

```bash
dsh plugin --profile web add /path/to/dsh-plugin-graph
```

> `dsh plugin add` 会把包装进 profile 的 `package.json` 依赖并链接到 `~/.dsh/profiles/web/node_modules`。请**不要**用裸 `npm i dsh-plugin-graph` 安装——那只会装进当前目录的 `node_modules`，dsh 并不知道它。

本包自带 `dsh.bundle` 声明（`cordis.patch.yml` 配置层），`dsh plugin add` 后会自动追加到 profile 的 `dsh.profile.bundles` 层叠，启动时由包自带的 patch 挂载 `ui-plugin-graph` 行——**无需手动编辑 `cordis.patch.yml`**。

> 升级提示：如果在旧版本（无 `dsh.bundle`）时手动往 `cordis.patch.yml` 加过 `insert: - id: ui-plugin-graph`，请删除该条目，避免与 bundle 自带的挂载重复。

### 3. 重启并打开

1. **重启 dsh Web 进程**（配置变更和 loader 条目都需要重启才生效）。
2. 打开设置页（侧边栏底部「设置」）→ 找到 **「插件关系图谱」** 入口（位于 Agent 预设之后）。
3. 点击进入，即看到力导向图。

### 4. 使用画布

| 操作 | 效果 |
|---|---|
| 拖拽节点 | 钉住该节点，重新加热布局 |
| 拖拽空白处 | 平移画布 |
| 滚轮 | 缩放 |
| 悬停节点 | 高亮相邻节点，弹出信息框（依赖/被依赖、声明者/注册者） |
| 点击右上角 ⤢ | 打开全屏模态框（Esc / 遮罩 / × 关闭） |
| 点击 ↻ | 手动刷新（重新读取启动清单与插槽注册表） |

### 5. 卸载

```bash
dsh plugin --profile web remove dsh-plugin-graph
```

`dsh` 会同时移除依赖与 `dsh.profile.bundles` 里的层条目；如果旧版本手动加过 `cordis.patch.yml` 的 `insert`，也一并删除，最后重启 dsh。

### 6. 常见问题

- **设置页没有「插件关系图谱」入口**：确认 `dsh plugin add` 后 profile 的 `package.json` 中 `dsh.profile.bundles` 包含 `dsh-plugin-graph`（`cat ~/.dsh/profiles/web/package.json`）；确认重启过 dsh；确认 `node_modules` 里链接存在（`ls ~/.dsh/profiles/web/node_modules/dsh-plugin-graph`）。
- **安装时报 `declares no dsh.bundle` 警告**：说明安装的版本过旧（< 0.2.0，尚无 bundle 声明），升级后重新 `dsh plugin add` 即可自动成为 profile 层。
- **安装时 pnpm 报 peer 依赖缺失（`missing peer @deepseek-ai/cordis / react ...`）**：这是预期提示。profile 模板固定 `autoInstallPeers: false` + hoisted linker，缺失 peer 会回退到安装级 `profiles/node_modules`，运行时由宿主提供，功能不受影响（harness 内部 client 插件同样声明这些 peer）。若升级 dsh 后版本不匹配，同步升级本包。
- **图谱里看不到宿主插件**：本图只覆盖客户端插件（`__DSH_BOOT__` 内的 `dsh.client` 行）；宿主平面行（webserver、storage 等）仅在被插槽声明/注册时出现。见「已知限制」。

## 构建与测试

```bash
pnpm install
pnpm build      # tsc 声明 + tsdown 打包（lib/client.js 为浏览器 bundle）
pnpm test       # vitest 单元测试（--pool=threads）
```

构建产物约定：`exports["./client"]` 指向 `lib/client.js`，宿主经 `/plugins/<id>/client.js` 提供；`dsh.client` 声明是浏览器名册准入。


## 设计说明

- **数据流**：`build()` 同步读取 `window.__DSH_BOOT__` 与 `ctx.slots.snapshot()`，由 `buildPluginGraph` 组装成模型，再由 `buildVisualGraph` 转为图节点/边（纯函数、可单测）。
- **力模拟**：`ForceGraph.tsx` 内置斥力 + 弹簧 + 向心力 + 阻尼 + alpha 衰减，`requestAnimationFrame` 驱动，收敛后自动停止；拖拽节点时将其钉住（不参与积分），邻居仍对其受力。
- **主题**：全部使用 DSH 设计 token（`--dsw-static-*` / `--dsw-alias-*`），自动适配亮/暗主题。

## 已知限制

- **快照视图**：不订阅 `slots/changed`，HMR 注册变化需手动刷新（画布右上角 ↻）。
- **仅客户端插件**：宿主平面行（webserver、storage 等）不在 `__DSH_BOOT__` 中，仅当被插槽声明/注册时才会出现。
- 内嵌图与模态框图为两个独立模拟实例（各自演算布局，互不共享拖拽位置）。

## License

[MIT](./LICENSE)
