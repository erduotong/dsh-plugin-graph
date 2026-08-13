/** `settings.pluginGraph` namespace dictionaries. */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'nav': '插件关系图谱',
  'title': '插件关系图谱',
  'intro': '客户端插件之间的依赖关系，以及各插件注册的界面插槽，以力导向图呈现。数据来自启动清单与插槽注册表，均为只读快照。',
  'pluginCount': '个插件',
  'legendPlugin': '插件',
  'legendSlot': '插槽',
  'legendInject': '依赖 (inject)',
  'legendDeclares': '声明插槽',
  'legendRegisters': '注册到插槽',
  'hint': '拖拽节点调整布局 · 拖拽空白处平移画布 · 滚轮缩放 · 悬停高亮相邻关系',
  'expand': '放大查看',
  'close': '关闭',
  'infoPlugin': '插件',
  'infoSlot': '插槽',
  'infoDependencies': '依赖',
  'infoDependents': '被依赖',
  'infoDeclaredBy': '声明者',
  'infoRegistrants': '注册者',
  'infoNone': '无',
  'empty': '暂无数据',
} satisfies Record<string, string>

/** The plugin-graph namespace key union. */
export type PluginGraphKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'nav': 'Plugin Graph',
  'title': 'Plugin Graph',
  'intro': 'Dependencies between client plugins and the slots each plugin registers into, rendered as a force-directed graph. Read-only snapshots of the boot manifest and the slot ledger.',
  'pluginCount': 'plugins',
  'legendPlugin': 'Plugin',
  'legendSlot': 'Slot',
  'legendInject': 'Dependency (inject)',
  'legendDeclares': 'Declares slot',
  'legendRegisters': 'Registered into slot',
  'hint': 'Drag nodes to rearrange · drag the canvas to pan · scroll to zoom · hover to highlight neighbors',
  'expand': 'Expand',
  'close': 'Close',
  'infoPlugin': 'Plugin',
  'infoSlot': 'Slot',
  'infoDependencies': 'Dependencies',
  'infoDependents': 'Depended by',
  'infoDeclaredBy': 'Declared by',
  'infoRegistrants': 'Registrants',
  'infoNone': 'None',
  'empty': 'No data',
} satisfies Record<PluginGraphKey, string>
