/** `settings.pluginGraph` namespace dictionaries. */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'nav': '插件关系图谱',
  'title': '插件关系图谱',
  'intro': '客户端插件之间的依赖关系，以及各插件注册的界面插槽。数据来自启动清单与插槽注册表，均为只读快照。',
  'pluginCount': '个插件',
  'dependencyTitle': '依赖关系',
  'dependencyIntro': '每个客户端插件声明了对其它包的依赖边（inject 拓扑）。',
  'slotTitle': '插槽注册',
  'slotIntro': '每个插槽由声明者声明，其它插件向其中注册界面条目。',
  'plugin': '插件',
  'dependencies': '依赖',
  'dependents': '被依赖',
  'noDependencies': '无依赖',
  'noDependents': '未被依赖',
  'declaredBy': '声明者',
  'registrants': '注册者',
  'noRegistrants': '暂无注册',
  'rootSlot': '内置',
  'empty': '暂无数据',
  'notInBoot': '未在启动清单中',
} satisfies Record<string, string>

/** The plugin-graph namespace key union. */
export type PluginGraphKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'nav': 'Plugin Graph',
  'title': 'Plugin Graph',
  'intro': 'Dependencies between client plugins and the slots each plugin registers into. Read-only snapshots of the boot manifest and the slot ledger.',
  'pluginCount': 'plugins',
  'dependencyTitle': 'Dependencies',
  'dependencyIntro': 'Each client plugin declares dependency edges (inject topology) to other packages.',
  'slotTitle': 'Slot registrations',
  'slotIntro': 'Each slot is declared by one plugin; others register UI entries into it.',
  'plugin': 'Plugin',
  'dependencies': 'Depends on',
  'dependents': 'Depended by',
  'noDependencies': 'No dependencies',
  'noDependents': 'Not depended on',
  'declaredBy': 'Declared by',
  'registrants': 'Registrants',
  'noRegistrants': 'No registrants',
  'rootSlot': 'built-in',
  'empty': 'No data',
  'notInBoot': 'not in boot manifest',
} satisfies Record<PluginGraphKey, string>
