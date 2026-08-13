# 

Web settings surface: an inter-plugin relationship graph. One settings section ("Plugin Graph" / 插件关系图谱) renders a **force-directed graph** (Koishi/Obsidian style):

- **Nodes** — one per client plugin (blue) and one per declared slot (amber diamond), sized by incident edge count.
- **Edges** — three color-coded families: inject dependencies (plugin → dependency, from the host-composed `window.__DSH_BOOT__` manifest), slot declarations (slot → declaring plugin), and slot registrations (slot → registrant, from the live `ctx.slots.snapshot()` ledger).
- **Interactions** — drag nodes (reheats the layout), drag the canvas to pan, scroll to zoom, hover to highlight a node and its neighbors. Purely presentational: no navigation behavior yet.

Data is assembled by the pure builder in `src/client/graph-model.ts` (boot wire + slot ledger → `PluginGraphModel` → `buildVisualGraph` → nodes/edges); the force layout and canvas live in the self-contained `src/client/ForceGraph.tsx` (no external layout library). The component owns no store and subscribes to nothing — the inject face exposes `build()` as a synchronous snapshot, re-read on mount and on the refresh affordance.

## Repository layout

The package is organized as a standalone npm package: `src/` holds the node half (empty apply + invariant companion), `src/client/` the browser half, `tests/` unit coverage for the pure builder, and the `dsh.client` manifest in package.json is the browser-roster admission. It currently sits under `third-party/` in the deepseek-harness checkout as a staging location only — it is not a workspace member, so the repository's gates do not scan it.

## Registration into a dsh web composition

The package contributes one entry into the `settings.section` list slot (`id: 'plugin-graph'`, `order: 30`, after Agent presets) and its own `settings.pluginGraph` locale namespace (zh + en). A composition that wants the surface adds three rows (the shipped `web-app` composition currently does not carry it):

1. a package dependency on `@deepseek-ai/dsh-client-ui-plugin-graph` (or the published name),
2. an `insert` row naming the package under the browser plugin roster in `cordis.patch.yml`,
3. a `tsconfig`/`references` entry where the composition type-checks client packages.

## Building and publishing standalone

- repoint `tsdown.config.ts` to a self-contained copy of the shared client bundle preset (`packages/client/tsdown.client.ts`), which this package currently imports by relative path;
- swap `workspace:^` dependency ranges for published versions;
- keep the `exports["./client"]` bundle contract and the `dsh.client` declaration — the host serves `/plugins/<id>/client.js` from them.

## Model Experience

None, as this package renders a read-only browser diagnostics view over the already-loaded boot manifest and slot ledger and registers nothing model-facing.

#### KV Cache effect

No direct invalidation: the plugin contributes no model-visible input.

## Known Limitations and Deferred Work

- **Snapshot-only surface** — the graph re-reads the boot manifest and slot ledger on mount and on the refresh affordance; it does not subscribe to `slots/changed`, so HMR-driven registration changes appear only after a manual refresh.
- **Boot entries cover only client plugins** — host-plane rows (webserver, storage, pickers) are absent from `window.__DSH_BOOT__`; they appear in the graph only when a slot declarer or registrant names them.
