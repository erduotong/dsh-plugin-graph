/**
 * Plugin-graph settings section: a read-only relationship view over the
 * client plugin tree. Two blocks — inject dependencies (from the boot
 * manifest) and slot registrations (from the live slot ledger) — assembled
 * into one graph model by the pure builder in graph-model.ts. The section
 * owns no store and subscribes to nothing: `build` is a synchronous snapshot
 * the component re-reads on mount and on the refresh affordance.
 */

import { useEffect, useState, type ReactNode } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { PluginGraphKey } from './locales.ts'
import { shortName, type PluginGraphModel, type PluginGraphNode, type SlotGraphNode } from './graph-model.ts'
import css from './PluginGraphSection.module.css'

/** Registration-side business face for the section. */
export interface PluginGraphSectionInjected {
  /** Build a fresh graph snapshot from the boot manifest and the slot ledger. */
  build: () => PluginGraphModel
}

/** Props the renderer binds for the section. */
export type PluginGraphSectionProps =
  PropsRuntime<'settings.section'>
  & PropsLocale<'settings.pluginGraph'>
  & InjectFace<PluginGraphSectionInjected>

/** One dependency cell: the plugin id plus its edge list, with an empty-state label. */
function EdgeList({ values, emptyKey, t }: {
  values: string[]
  emptyKey: PluginGraphKey
  t: PluginGraphSectionProps['t']
}): ReactNode {
  return values.length === 0
    ? <span className={css.emptyEdge}>{t(emptyKey)}</span>
    : (
      <ul className={css.edgeList}>
        {values.map(id => <li key={id}><code className={css.edgeChip}>{shortName(id)}</code></li>)}
      </ul>
    )
}

/** One plugin row: id, its dependencies, and its dependents. */
function PluginRow({ node, t }: { node: PluginGraphNode; t: PluginGraphSectionProps['t'] }): ReactNode {
  return (
    <li className={css.pluginRow} data-plugin={node.id}>
      <code className={css.pluginId} title={node.id}>{shortName(node.id)}</code>
      <span className={css.cell}><EdgeList values={node.dependencies} emptyKey="noDependencies" t={t} /></span>
      <span className={css.cell}><EdgeList values={node.dependents} emptyKey="noDependents" t={t} /></span>
    </li>
  )
}

/** One slot row: declaration facts plus the registrant list. */
function SlotRow({ slot, t }: { slot: SlotGraphNode; t: PluginGraphSectionProps['t'] }): ReactNode {
  return (
    <li className={css.slotRow} data-slot={slot.name}>
      <code className={css.slotName} title={slot.name}>{shortName(slot.name)}</code>
      <span className={css.cell}>
        {slot.declaredBy === undefined
          ? <span className={css.emptyEdge}>{t('rootSlot')}</span>
          : <code className={css.edgeChip} title={slot.declaredBy}>{shortName(slot.declaredBy)}</code>}
      </span>
      <span className={css.cell}>
        {slot.registrants.length === 0
          ? <span className={css.emptyEdge}>{t('noRegistrants')}</span>
          : (
            <ul className={css.edgeList}>
              {slot.registrants.map(id => <li key={id}><code className={css.edgeChip} title={id}>{shortName(id)}</code></li>)}
            </ul>
          )}
      </span>
    </li>
  )
}

/** Render the plugin-graph settings page. */
export function PluginGraphSection({ t, build }: PluginGraphSectionProps): ReactNode {
  const [graph, setGraph] = useState<PluginGraphModel | null>(null)
  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    setGraph(build())
  }, [build, refresh])

  const header = (key: PluginGraphKey): string => t(key)
  return (
    <div className={css.section}>
      <h2 className={css.heading}>{header('title')}</h2>
      <p className={css.intro}>{header('intro')}</p>
      {graph === null ? <p className={css.status}>{header('empty')}</p> : (
        <>
          <div className={css.countLine}>
            <span data-plugin-count={graph.plugins.length}>{graph.plugins.length} {header('pluginCount')}</span>
            <button type="button" className={css.refresh} onClick={() => { setRefresh(value => value + 1) }}>↻</button>
          </div>

          <section className={css.block} aria-labelledby="plugin-graph-deps">
            <h3 id="plugin-graph-deps">{header('dependencyTitle')}</h3>
            <p className={css.blockIntro}>{header('dependencyIntro')}</p>
            {graph.plugins.length === 0 ? <p className={css.status}>{header('empty')}</p> : (
              <ul className={css.table} data-role="dependencies">
                <li className={css.headRow} aria-hidden="true">
                  <span className={css.headCell}>{header('plugin')}</span>
                  <span className={css.headCell}>{header('dependencies')}</span>
                  <span className={css.headCell}>{header('dependents')}</span>
                </li>
                {graph.plugins.map(node => <PluginRow key={node.id} node={node} t={t} />)}
              </ul>
            )}
          </section>

          <section className={css.block} aria-labelledby="plugin-graph-slots">
            <h3 id="plugin-graph-slots">{header('slotTitle')}</h3>
            <p className={css.blockIntro}>{header('slotIntro')}</p>
            {graph.slots.length === 0 ? <p className={css.status}>{header('empty')}</p> : (
              <ul className={css.table} data-role="slots">
                <li className={css.headRow} aria-hidden="true">
                  <span className={css.headCell}>{header('plugin')}</span>
                  <span className={css.headCell}>{header('declaredBy')}</span>
                  <span className={css.headCell}>{header('registrants')}</span>
                </li>
                {graph.slots.map(slot => <SlotRow key={slot.name} slot={slot} t={t} />)}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  )
}
