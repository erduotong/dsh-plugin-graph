/**
 * Plugin-graph surface plugin, browser half: one settings section reading the
 * client plugin relationship graph. The inject face closes over the apply
 * ctx to read two live snapshots on demand — the boot manifest
 * (`window.__DSH_BOOT__`) and the slot ledger (`ctx.slots.snapshot()`) — so
 * the component stays pure props and the plugin owns no store, no events,
 * and no subscription machinery.
 */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: pulls the settings shell's SlotMap merge (the 'settings.section' entry).
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { PluginGraphSection, type PluginGraphSectionInjected } from './PluginGraphSection.tsx'
import { buildPluginGraph, type BootGraphWire } from './graph-model.ts'
import { en, zh, type PluginGraphKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The plugin-graph settings section copy. */
    'settings.pluginGraph': PluginGraphKey
  }
}

/** Dictionary namespace owned by this plugin. */
const NS = 'settings.pluginGraph'

/** Required services (cordis fiber inject). */
export const inject = ['slots', 'locale']

/** Read the raw boot graph off the window (unparsed at this boundary; absent in test fixtures). */
function readBootGraph(): BootGraphWire | undefined {
  const wire = (globalThis as { __DSH_BOOT__?: unknown }).__DSH_BOOT__
  return wire === undefined ? undefined : wire as BootGraphWire
}

/**
 * Mount the plugin-graph settings section.
 * @param ctx - the browser plugin context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-plugin-graph: section dictionaries')

  const injected = (): PluginGraphSectionInjected => ({
    build: () => buildPluginGraph(readBootGraph(), ctx.slots.snapshot()),
  })

  // Ordered after Agent presets: the graph is a diagnostics page, read after
  // the deployment-shaping sections.
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'plugin-graph',
    order: 30,
    label: () => ctx.locale.bind(NS)('nav'),
    locale: NS,
    inject: injected,
  }, PluginGraphSection))
}
