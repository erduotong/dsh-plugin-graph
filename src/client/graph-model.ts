/**
 * Plugin-graph data assembly (pure, React-free). Two sources combine into one
 * graph model:
 *
 * - the client boot manifest (`window.__DSH_BOOT__`, host-composed): one node
 *   per client plugin with its package-level `inject` dependency edges;
 * - the live slot ledger (`ctx.slots.snapshot()`): the slot declaration tree
 *   with the registrant label stamped on each occupant, so a plugin's UI
 *   surface (which slot it registered into) is a second edge kind.
 *
 * Both reads are synchronous snapshots; the graph is a pure function of them.
 * Type-only imports only — the bundle purity gate forbids value imports of
 * non-platform packages, and the boot manifest is read raw off the window.
 */

import type { LiveSlotNode, LiveSlotOccupant } from '@deepseek-ai/dsh-client-ui-slots'

/** The window.__DSH_BOOT__ shape this package reads (a structural subset of the host-composed graph). */
export interface BootGraphEntry {
  /** Entry name == package name. */
  id: string
  /** Package-name dependency edges, informational. */
  inject?: string[]
  /** Stage-one prefetch mark. */
  immediately?: boolean
}

/** Raw window.__DSH_BOOT__ value (unvalidated at this boundary; the shell parsed it at boot). */
export interface BootGraphWire {
  rev?: string
  entries?: BootGraphEntry[]
}

/** One plugin node: identity plus both edge kinds resolved. */
export interface PluginGraphNode {
  /** Package name. */
  id: string
  /** Plugins this plugin declares an inject edge to (from the boot manifest). */
  dependencies: string[]
  /** Plugins declaring an inject edge to this one (reverse index, computed). */
  dependents: string[]
  /** Where the node came from: a boot entry, a slot registrant, or both. */
  source: 'boot' | 'slot' | 'both'
  /** Whether the boot entry carries the stage-one prefetch mark. */
  immediately: boolean
}

/** One slot row: declaration facts plus the plugins registered into it. */
export interface SlotGraphNode {
  /** Exact SlotMap key. */
  name: string
  /** Slot cardinality. */
  kind: string
  /** Runtime data scope. */
  scope: string
  /** Plugin that declared the slot (absent for the built-in 'root'). */
  declaredBy?: string
  /** Registrants currently occupying the slot (deduplicated, ledger order). */
  registrants: string[]
}

/** The complete rendered graph: plugin nodes, inject edges, and the slot tree. */
export interface PluginGraphModel {
  /** Plugin nodes, name-sorted. */
  plugins: PluginGraphNode[]
  /** Inject edges, sorted (from, to). */
  edges: Array<{ from: string; to: string }>
  /** Slot rows, declaration-tree order. */
  slots: SlotGraphNode[]
  /** Whether the boot manifest read produced entries (false = host absent the manifest). */
  hasBoot: boolean
}

/** One node in the force-directed visualization. */
export interface GraphVizNode {
  /** Full package name or slot key. */
  id: string
  /** Node family, drives shape and color. */
  kind: 'plugin' | 'slot'
  /** Short display label (package tail). */
  label: string
  /** Incident edge count, drives node radius. */
  degree: number
}

/** One edge in the force-directed visualization. */
export interface GraphVizEdge {
  /** Source node id. */
  source: string
  /** Target node id. */
  target: string
  /** Edge family, drives color: inject dependency / slot declaration / slot registration. */
  kind: 'inject' | 'declares' | 'registers'
}

/** The complete force-graph payload: nodes plus color-coded edges. */
export interface GraphViz {
  nodes: GraphVizNode[]
  edges: GraphVizEdge[]
}

/** Short display id for a slot registrant or declaredBy label (package-name tail). */
export function shortName(id: string): string {
  const unscoped = id.startsWith('@') ? id.slice(id.indexOf('/') + 1) : id
  return unscoped.replace(/^cordis:/, '')
}

/**
 * Build the force-directed graph payload from the assembled model: one node
 * per plugin and per slot, with inject edges (plugin → dependency), declares
 * edges (slot → declaring plugin), and registers edges (slot → registrant).
 * Pure and deterministic — the renderer owns no model logic.
 */
export function buildVisualGraph(model: PluginGraphModel): GraphViz {
  const nodes = new Map<string, GraphVizNode>()
  const ensure = (id: string, kind: GraphVizNode['kind']): GraphVizNode => {
    const existing = nodes.get(id)
    if (existing !== undefined) return existing
    const node: GraphVizNode = { id, kind, label: shortName(id), degree: 0 }
    nodes.set(id, node)
    return node
  }

  for (const plugin of model.plugins) ensure(plugin.id, 'plugin')
  for (const slot of model.slots) ensure(slot.name, 'slot')

  const edges: GraphVizEdge[] = []
  const seen = new Set<string>()
  const pushEdge = (source: string, target: string, kind: GraphVizEdge['kind']): void => {
    const key = `${kind}\u0000${source}\u0000${target}`
    if (seen.has(key)) return
    seen.add(key)
    edges.push({ source, target, kind })
    // All endpoints are pre-created above (plugins from the model, slots from
    // the slot rows), so ensure() only bumps degree on the existing node.
    ensure(source, 'plugin').degree += 1
    ensure(target, 'plugin').degree += 1
  }

  for (const edge of model.edges) pushEdge(edge.from, edge.to, 'inject')
  for (const slot of model.slots) {
    if (slot.declaredBy !== undefined) pushEdge(slot.name, slot.declaredBy, 'declares')
    for (const registrant of slot.registrants) pushEdge(slot.name, registrant, 'registers')
  }

  return { nodes: [...nodes.values()], edges }
}

/** Sort an id array for stable output. */
function sorted(ids: Iterable<string>): string[] {
  return [...new Set(ids)].sort()
}

/** Collect every slot node in declaration order, descending the children chains. */
function flattenSlots(roots: LiveSlotNode[]): SlotGraphNode[] {
  const rows: SlotGraphNode[] = []
  const visit = (node: LiveSlotNode): void => {
    const registrants = sorted(node.occupants.map(occupant => occupant.registrant).filter((value): value is string => value !== undefined))
    rows.push({
      name: node.name,
      kind: node.kind,
      scope: node.scope,
      ...node.declaredBy === undefined ? {} : { declaredBy: node.declaredBy },
      registrants,
    })
    for (const child of node.children) visit(child)
  }
  for (const node of roots) visit(node)
  return rows
}

/**
 * Assemble the plugin graph from the boot manifest and the slot ledger.
 * @param wire - the raw `window.__DSH_BOOT__` value (empty entries tolerated).
 * @param slotTree - the live slot declaration tree from `ctx.slots.snapshot()`.
 * @returns the sorted, deduplicated graph model.
 */
export function buildPluginGraph(wire: BootGraphWire | undefined, slotTree: LiveSlotNode[]): PluginGraphModel {
  const boot = wire?.entries ?? []
  const nodes = new Map<string, PluginGraphNode>()
  const ensure = (id: string, source: PluginGraphNode['source']): PluginGraphNode => {
    const existing = nodes.get(id)
    if (existing === undefined) {
      const node: PluginGraphNode = {
        id,
        dependencies: [],
        dependents: [],
        source,
        immediately: false,
      }
      nodes.set(id, node)
      return node
    }
    existing.source = existing.source === source ? existing.source : 'both'
    return existing
  }

  for (const entry of boot) {
    const node = ensure(entry.id, 'boot')
    node.immediately = entry.immediately === true
    node.dependencies = sorted(entry.inject ?? [])
  }

  const slots = flattenSlots(slotTree)
  for (const slot of slots) {
    if (slot.declaredBy !== undefined) ensure(slot.declaredBy, 'slot')
    for (const registrant of slot.registrants) ensure(registrant, 'slot')
  }

  for (const node of nodes.values()) {
    for (const dependency of node.dependencies) {
      ensure(dependency, 'slot').dependents.push(node.id)
    }
  }

  const edges: PluginGraphModel['edges'] = []
  for (const node of nodes.values()) {
    for (const to of node.dependencies) edges.push({ from: node.id, to })
  }
  edges.sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to))

  return {
    plugins: [...nodes.values()].sort((a, b) => a.id.localeCompare(b.id)),
    edges,
    slots,
    hasBoot: boot.length > 0,
  }
}

export type { LiveSlotNode, LiveSlotOccupant }
