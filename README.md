# dsh-plugin-graph

DeepSeek Harness（DSH）Web 设置页插件：以**力导向图**（Koishi / Obsidian 风格）可视化客户端插件之间的关系。

> Tip: 这是一个dsh自己写的项目，还在快速完善中
> 如有好的想法，欢迎提出Issue~

## 功能

- **力导向图画布**：节点自动物理布局，节点按度数缩放。
- **两类节点**：
  - 插件节点（蓝色圆点）—— 来自启动清单 `window.__DSH_BOOT__` 与插槽注册表；
  - 插槽节点（琥珀色菱形）—— 来自实时插槽组成拓扑 `ctx.slots.snapshot()`。
- **三类彩色边**：
  - 蓝色 `inject` —— 插件对其它包的依赖；
  - 绿色 `declares` —— 插槽声明者；
  - 琥珀色 `registers` —— 注册到插槽的插件。
- **交互**：拖拽节点（重新加热布局）、拖拽空白平移、滚轮缩放、悬停高亮相邻节点并弹出信息框（显示依赖/被依赖、声明者/注册者）。
- **放大查看**：画布右上角展开按钮，打开全屏模态框，支持 Esc / 遮罩 / × 关闭。
- **只读快照**：不订阅任何事件，挂载与手动刷新时重建图。

## 快速上手

### 1. 前置条件

- 已安装 DeepSeek Harness，并至少启动过一次你打算测试的那个界面（首次启动会创建对应的 profile 目录）。

### 2. 先确认装到哪个 profile

插件装在哪个 profile，就只在那个界面里生效——两个 profile 的包、启用选择和锁文件互相独立：

| 目标客户端 | profile | 用什么装 |
|---|---|---|
| 浏览器里的 Web GUI（`dsh web`） | `web` | 任意 dsh 命令行 |
| Electron 桌面应用 | `desktop` | 只能用桌面应用自带的 dsh 命令，且应用需先退出 |

桌面应用独占 `$DSH_HOME/profiles/desktop`（Electron 进程单实例锁 + 应用内置的 dsh 运行时），普通 npm 安装的 `dsh` 不能改它——对普通 dsh 执行 `--profile desktop` 会直接报错 `profile "desktop" is managed exclusively by the Electron application`。  
桌面应用请在应用内的插件管理入口安装，或退出应用后用**应用自带的**命令行执行 `dsh plugin --profile desktop add …`。

> `$DSH_HOME` 默认是 `~/.dsh`。

### 3. 安装插件

**方式 A：从 npm registry 安装（推荐一般用户使用）**

```bash
dsh plugin --profile web add dsh-plugin-graph
```

**方式 B：从本地源码目录安装（开发 / 未发布时）**

```bash
dsh plugin --profile web add /path/to/dsh-plugin-graph
```

（桌面应用把上面的 `web` 换成 `desktop`，并用应用自带的 dsh。）

> `dsh plugin add` 会把包装进 profile 的 `package.json` 依赖并链接到 `$DSH_HOME/profiles/<profile>/node_modules`。请**不要**用裸 `npm i dsh-plugin-graph` 安装——那只会装进当前目录的 `node_modules`，dsh 并不知道它。

也可以在 Web 界面里走 **设置 → 插件 → 添加插件**（接受 npm 包名、git 地址、tarball、本地绝对路径），效果与命令行一致。

本包自带 `dsh.bundle` 声明（`cordis.patch.yml` 配置层），`dsh plugin add` 后会自动追加到 profile 的 `dsh.profile.bundles` 层叠，启动时由包自带的 patch 挂载 `dsh-plugin-graph` 行——**无需手动编辑 `cordis.patch.yml`**。该行的 `name` 必须是裸包名，客户端模块系统才会把浏览器半侧挂到这一行上。

> 升级提示：如果在更早的版本（无 `dsh.bundle`）时手动往 `cordis.patch.yml` 加过 `insert: - id: ui-plugin-graph`，请删除该条目，避免与 bundle 自带的挂载重复。

安装前可用 `dsh --profile web --dump-config` 检查配置层是否已挂上。

### 4. 重启并打开

1. **重启 dsh Web 进程**（配置变更和 loader 条目都需要重启才生效）。
2. 打开设置页（侧边栏底部「设置」）→ 找到 **「插件关系图谱」** 入口（位于 Agent 预设之后）。
3. 点击进入，即看到力导向图。

### 5. 使用画布

| 操作 | 效果 |
|---|---|
| 拖拽节点 | 钉住该节点，重新加热布局 |
| 拖拽空白处 | 平移画布 |
| 滚轮 | 缩放 |
| 悬停节点 | 高亮相邻节点，弹出信息框（依赖/被依赖、声明者/注册者） |
| 点击右上角 ⤢ | 打开全屏模态框（Esc / 遮罩 / × 关闭） |
| 点击 ↻ | 手动刷新（重新读取启动清单与插槽拓扑） |

### 6. 卸载

```bash
dsh plugin --profile web remove dsh-plugin-graph
```

`dsh` 会同时移除依赖与 `dsh.profile.bundles` 里的层条目；如果更早的版本手动加过 `cordis.patch.yml` 的 `insert`，也一并删除，最后重启 dsh。

### 7. 常见问题

- **设置页没有「插件关系图谱」入口**：确认 `dsh plugin add` 后 profile 的 `package.json` 中 `dsh.profile.bundles` 包含 `dsh-plugin-graph`（`cat $DSH_HOME/profiles/<profile>/package.json`）；确认重启过 dsh；确认 `node_modules` 里链接存在（`ls $DSH_HOME/profiles/<profile>/node_modules/dsh-plugin-graph`）。
- **安装被拒（`Plugin ... is incompatible with dsh ...`）**：装的是 0.3.0 之前的版本，其 `@deepseek-ai/dsh-*` peer 与当前运行时版本不匹配。升级到 0.3.0 即可；`dsh plugin allow-version` 只能绕过检查，旧版浏览器半侧在新版 DSH 里仍会失败。
- **安装时报 `declares no dsh.bundle` 警告**：说明安装的版本过旧（< 0.2.0，尚无 bundle 声明），升级后重新 `dsh plugin add` 即可自动成为 profile 层。
- **页面白屏，控制台报 `client-modules: bundle ... loaded without registering "dsh-plugin-graph"`**：浏览器产物不是模块表要求的懒加载工厂格式（`window.__ModuleLoader__.load({ id, factory })`），或 `id` 与包名不一致。用本仓库的 `pnpm build` 重新构建即可。
- **控制台报 `require("<spec>") missed the module table`**：浏览器 bundle 里残留了模块表不认识的依赖名——通常是外部名清单与 DSH 的 `PLATFORM_MODULES` 不一致（例如仍写着已下线的 `@deepseek-ai/dsh-client-web-react`），或引入了一个未走 `dsh.client.external` 声明的非基线包。重新构建；确实需要额外模块时，按 DSH 规则在 `dsh.client.external` 里逐字声明。
- **安装时 pnpm 报 peer 依赖缺失**：0.3.0 起 `peerDependencies` 只声明 `@deepseek-ai/cordis`，这类提示应基本消失。若仍有，属预期提示——浏览器半侧的 React / cordis / ui-slots 由宿主模块表在运行时提供，功能不受影响。
- **图谱里看不到宿主插件**：本图只覆盖客户端插件（`__DSH_BOOT__` 内的 `dsh.client` 行）；宿主平面行（webserver、storage 等）仅在被插槽声明/注册时出现。见「已知限制」。

## 构建与测试

```bash
pnpm install
pnpm build      # tsc 产出声明（lib/types）+ tsdown 打包（lib/index.js 与 lib/client.js）
pnpm test       # vitest 单元测试（--pool=threads）
```

## 设计说明

- **数据流**：`build()` 同步读取 `window.__DSH_BOOT__` 与 `ctx.slots.snapshot()`，由 `buildPluginGraph` 组装成模型，再由 `buildVisualGraph` 转为图节点/边（纯函数、可单测）。
- **力模拟**：`ForceGraph.tsx` 内置斥力 + 弹簧 + 向心力 + 阻尼 + alpha 衰减，`requestAnimationFrame` 驱动，收敛后自动停止；拖拽节点时将其钉住（不参与积分），邻居仍对其受力。
- **主题**：全部使用 DSH 设计 token（`--dsw-static-*` / `--dsw-alias-*`），自动适配亮/暗主题。

## 已知限制

- **快照视图**：不订阅 `slots/changed`，HMR 注册变化需手动刷新（画布右上角 ↻）。
- **仅客户端插件**：宿主平面行（webserver、storage 等）不在 `__DSH_BOOT__` 中，仅当被插槽声明/注册时才会出现。
- **Factory 定义不成节点**：`snapshot()` 里的 `factory:<name>` 定义只被下钻以收集其子插槽，本身不显示为节点（它没有插槽基数，混进节点集会与普通插槽的语义混淆）。
- 内嵌图与模态框图为两个独立模拟实例（各自演算布局，互不共享拖拽位置）。

## License

[MIT](./LICENSE)
