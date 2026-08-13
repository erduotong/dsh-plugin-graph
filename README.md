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

## 安装与接入

本包以 `dsh.client` 清单声明浏览器插件。要把它接入一个 dsh web 组合（例如 `~/.dsh/profiles/web`）：

1. 安装依赖：

```bash
dsh plugin add /path/to/dsh-plugin-graph
```

2. 在 profile 的 `cordis.patch.yml` 中挂载：

```yaml
- insert:
   - id: ui-plugin-graph
     name: dsh-plugin-graph
```

3. 重启 dsh 后，设置页会出现「插件关系图谱」入口。

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
