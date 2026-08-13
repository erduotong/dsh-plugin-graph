/**
 * Plugin-graph settings section: a read-only force-directed relationship view
 * over the client plugin tree. Two edge families — inject dependencies (from
 * the boot manifest) and slot relations (declaredBy / registrants, from the
 * live slot ledger) — are assembled into one visual graph by the pure builder
 * in graph-model.ts and rendered by the self-contained ForceGraph canvas
 * (drag, pan, zoom, hover). The section owns no store and subscribes to
 * nothing: `build` is a synchronous snapshot the component re-reads on mount
 * and on the refresh affordance.
 */

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { PluginGraphKey } from './locales.ts'
import { buildVisualGraph, type PluginGraphModel } from './graph-model.ts'
import { ForceGraph, type ForceGraphNode, type ForceGraphEdge } from './ForceGraph.tsx'
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

/** Render the plugin-graph settings page. */
export function PluginGraphSection({ t, build }: PluginGraphSectionProps): ReactNode {
  const [graph, setGraph] = useState<PluginGraphModel | null>(null)
  const [refresh, setRefresh] = useState(0)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    setGraph(build())
  }, [build, refresh])

  // Esc closes the modal; lock page scroll while it is open.
  useEffect(() => {
    if (!expanded) return
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setExpanded(false)
    }
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [expanded])

  const header = (key: PluginGraphKey): string => t(key)

  const visual = useMemo(() => graph === null ? null : buildVisualGraph(graph), [graph])
  const nodes: ForceGraphNode[] = visual?.nodes ?? []
  const edges: ForceGraphEdge[] = visual?.edges ?? []

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

          {nodes.length === 0 ? <p className={css.status}>{header('empty')}</p> : (
            <>
              <ForceGraph
                nodes={nodes}
                edges={edges}
                onExpand={() => setExpanded(true)}
                expandLabel={header('expand')}
              />
              <ul className={css.legend}>
                <li><span className={`${css.swatch} ${css.swatchPlugin}`} aria-hidden="true" />{header('legendPlugin')}</li>
                <li><span className={`${css.swatch} ${css.swatchSlot}`} aria-hidden="true" />{header('legendSlot')}</li>
                <li><span className={css.swatchInject} aria-hidden="true" />{header('legendInject')}</li>
                <li><span className={css.swatchDeclares} aria-hidden="true" />{header('legendDeclares')}</li>
                <li><span className={css.swatchRegisters} aria-hidden="true" />{header('legendRegisters')}</li>
              </ul>
              <p className={css.hint}>{header('hint')}</p>
            </>
          )}
        </>
      )}

      {expanded && (
        <div
          className={css.modalBackdrop}
          onClick={event => { if (event.target === event.currentTarget) setExpanded(false) }}
        >
          <div className={css.modal} role="dialog" aria-modal="true" aria-label={header('title')}>
            <button type="button" className={css.modalClose} aria-label={header('close')} onClick={() => setExpanded(false)}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
            <ForceGraph nodes={nodes} edges={edges} height="100%" />
          </div>
        </div>
      )}
    </div>
  )
}
