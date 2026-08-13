/**
 * Self-contained force-directed graph renderer (SVG). No external layout
 * library: the physics is a compact Fruchterman-Reingold-style loop — pair
 * repulsion, edge springs, weak centering, velocity damping with alpha decay —
 * kept entirely in this file. Interactions: drag nodes (reheats the
 * simulation), drag the canvas to pan, wheel to zoom around the cursor, and
 * Obsidian-style hover highlighting of a node and its incident edges. Purely
 * presentational: nodes carry no navigation behavior.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import css from './ForceGraph.module.css'

/** One input node: identity plus the visual facts the renderer needs. */
export interface ForceGraphNode {
  /** Full package name or slot key. */
  id: string
  /** Node family, drives shape and color. */
  kind: 'plugin' | 'slot'
  /** Short display label (package tail). */
  label: string
  /** Incident edge count, drives node radius. */
  degree: number
}

/** One input edge: endpoint ids plus the family that drives its color. */
export interface ForceGraphEdge {
  source: string
  target: string
  kind: 'inject' | 'declares' | 'registers'
}

/** Mutable simulation node: input facts plus position/velocity state. */
interface SimNode extends ForceGraphNode {
  x: number
  y: number
  vx: number
  vy: number
  /** Visual radius in world units. */
  r: number
}

/** Simulation edge: node indices plus the input edge kind. */
interface SimEdge {
  source: number
  target: number
  kind: ForceGraphEdge['kind']
}

/** Props for the force-graph canvas. */
export interface ForceGraphProps {
  nodes: ForceGraphNode[]
  edges: ForceGraphEdge[]
  /** Canvas height in px; width fills the section. */
  height?: number
}

const REPULSION = 6500
const SPRING = 0.008
const REST_LENGTH = 190
const CENTER = 0.008
const DAMPING = 0.78
const MAX_SPEED = 12
const ALPHA_DECAY = 0.975
const MIN_ALPHA = 0.04
const SUBSTEPS = 1
const MIN_ZOOM = 0.25
const MAX_ZOOM = 3

/** Edge-kind → CSS module class (flat CSS-modules exports, so a lookup map). */
const EDGE_CLASS: Record<ForceGraphEdge['kind'], string> = {
  inject: 'edgeInject',
  declares: 'edgeDeclares',
  registers: 'edgeRegisters',
}

/** Node radius by incident degree, clamped. */
function radiusOf(degree: number): number {
  return 4 + Math.min(8, degree * 1.2)
}

/** One physics step: repulsion, springs, centering, damping, integration. */
function tickSim(sim: SimNode[], edges: SimEdge[], alpha: number, w: number, h: number): void {
  const n = sim.length
  for (let i = 0; i < n; i++) {
    const a = sim[i]
    for (let j = i + 1; j < n; j++) {
      const b = sim[j]
      let dx = a.x - b.x
      let dy = a.y - b.y
      let d2 = dx * dx + dy * dy
      if (d2 < 0.01) {
        dx = (Math.random() - 0.5) * 0.5
        dy = (Math.random() - 0.5) * 0.5
        d2 = dx * dx + dy * dy
      }
      const d = Math.sqrt(d2)
      const f = (REPULSION * alpha) / d2
      const fx = (dx / d) * f
      const fy = (dy / d) * f
      a.vx += fx
      a.vy += fy
      b.vx -= fx
      b.vy -= fy
    }
  }

  for (const edge of edges) {
    const a = sim[edge.source]
    const b = sim[edge.target]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const d = Math.max(1, Math.sqrt(dx * dx + dy * dy))
    const f = (d - REST_LENGTH) * SPRING * alpha
    const fx = (dx / d) * f
    const fy = (dy / d) * f
    a.vx += fx
    a.vy += fy
    b.vx -= fx
    b.vy -= fy
  }

  for (const a of sim) {
    a.vx += (w / 2 - a.x) * CENTER * alpha
    a.vy += (h / 2 - a.y) * CENTER * alpha
    a.vx *= DAMPING
    a.vy *= DAMPING
    const speed = Math.hypot(a.vx, a.vy)
    if (speed > MAX_SPEED) {
      a.vx = (a.vx / speed) * MAX_SPEED
      a.vy = (a.vy / speed) * MAX_SPEED
    }
    a.x += a.vx
    a.y += a.vy
  }
}

/** Clamp a zoom factor into the allowed range. */
function clampZoom(k: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, k))
}

/** Render the force-directed graph canvas. */
export function ForceGraph({ nodes, edges, height = 520 }: ForceGraphProps): ReactNode {
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const sizeRef = useRef(size)
  sizeRef.current = size

  const [view, setView] = useState({ x: 0, y: 0, k: 1 })
  const viewRef = useRef(view)
  viewRef.current = view

  const simRef = useRef<SimNode[]>([])
  const edgeRef = useRef<SimEdge[]>([])
  const alphaRef = useRef(1)
  const rafRef = useRef(0)
  const runningRef = useRef(false)
  const dragRef = useRef<{ index: number; mode: 'node' | 'pan'; startX: number; startY: number; viewX: number; viewY: number } | null>(null)
  const [hover, setHover] = useState<string | null>(null)
  const [, setFrame] = useState(0)

  /** Start (or resume) the rAF simulation loop until alpha decays. */
  const startSim = useCallback((): void => {
    if (runningRef.current) return
    runningRef.current = true
    const loop = (): void => {
      const alpha = alphaRef.current
      if (alpha < MIN_ALPHA || simRef.current.length === 0) {
        runningRef.current = false
        return
      }
      const { w, h } = sizeRef.current
      for (let i = 0; i < SUBSTEPS; i++) tickSim(simRef.current, edgeRef.current, alpha, w, h)
      alphaRef.current = alpha * ALPHA_DECAY
      setFrame(frame => frame + 1)
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
  }, [])

  /** Track the canvas size so the viewBox tracks the rendered box. */
  useEffect(() => {
    const el = wrapRef.current
    if (el === null) return
    const measure = (): void => {
      const rect = el.getBoundingClientRect()
      setSize(prev =>
        prev.w === rect.width && prev.h === rect.height ? prev : { w: Math.max(1, rect.width), h: Math.max(1, rect.height) })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  /** Rebuild the simulation whenever the graph or the canvas size changes. */
  useEffect(() => {
    if (size.w === 0 || size.h === 0) return
    const index = new Map(nodes.map((node, i) => [node.id, i]))
    const sim: SimNode[] = nodes.map((node, i) => {
      const angle = (i / Math.max(1, nodes.length)) * Math.PI * 2
      const radius = Math.min(size.w, size.h) * 0.35
      return {
        ...node,
        x: size.w / 2 + Math.cos(angle) * radius,
        y: size.h / 2 + Math.sin(angle) * radius,
        vx: 0,
        vy: 0,
        r: radiusOf(node.degree),
      }
    })
    const simEdges: SimEdge[] = []
    for (const edge of edges) {
      const source = index.get(edge.source)
      const target = index.get(edge.target)
      if (source === undefined || target === undefined) continue
      simEdges.push({ source, target, kind: edge.kind })
    }
    simRef.current = sim
    edgeRef.current = simEdges
    alphaRef.current = 1
    setView({ x: 0, y: 0, k: 1 })
    setHover(null)
    startSim()
  }, [nodes, edges, size.w, size.h, startSim])

  useEffect(() => () => cancelAnimationFrame(rafRef.current), [])

  /** Pointer → world coordinates (undo pan/zoom), plus raw screen coords. */
  const toWorld = useCallback((event: PointerEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect()
    const { w, h } = sizeRef.current
    if (rect === undefined || w === 0 || h === 0) return { x: 0, y: 0, sx: 0, sy: 0 }
    const sx = (event.clientX - rect.left) * (w / rect.width)
    const sy = (event.clientY - rect.top) * (h / rect.height)
    const v = viewRef.current
    return { x: (sx - v.x) / v.k, y: (sy - v.y) / v.k, sx, sy }
  }, [])

  const handlePointerDown = (event: PointerEvent<SVGSVGElement>): void => {
    if (event.button !== 0) return
    const { x, y, sx, sy } = toWorld(event)
    const v = viewRef.current
    const margin = Math.max(10, 14 / v.k)
    const sim = simRef.current
    let hit = -1
    for (let i = sim.length - 1; i >= 0; i--) {
      const node = sim[i]
      const dx = node.x - x
      const dy = node.y - y
      if (dx * dx + dy * dy <= (node.r + margin) * (node.r + margin)) {
        hit = i
        break
      }
    }
    if (hit >= 0) {
      dragRef.current = { index: hit, mode: 'node', startX: sx, startY: sy, viewX: v.x, viewY: v.y }
      alphaRef.current = Math.max(alphaRef.current, 0.65)
      startSim()
    } else {
      dragRef.current = { index: -1, mode: 'pan', startX: sx, startY: sy, viewX: v.x, viewY: v.y }
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    setHover(null)
  }

  const handlePointerMove = (event: PointerEvent<SVGSVGElement>): void => {
    const drag = dragRef.current
    if (drag === null) return
    const { x, y, sx, sy } = toWorld(event)
    if (drag.mode === 'node') {
      const node = simRef.current[drag.index]
      if (node !== undefined) {
        node.x = x
        node.y = y
        node.vx = 0
        node.vy = 0
        alphaRef.current = Math.max(alphaRef.current, 0.65)
        startSim()
        setFrame(frame => frame + 1)
      }
    } else {
      setView({ x: drag.viewX + (sx - drag.startX), y: drag.viewY + (sy - drag.startY), k: viewRef.current.k })
    }
  }

  const handlePointerUp = (): void => {
    dragRef.current = null
  }

  /** Non-passive wheel zoom around the cursor (React's onWheel is passive). */
  useEffect(() => {
    const svg = svgRef.current
    if (svg === null) return
    const onWheel = (event: globalThis.WheelEvent): void => {
      event.preventDefault()
      const rect = svg.getBoundingClientRect()
      const { w, h } = sizeRef.current
      if (w === 0 || h === 0) return
      const sx = (event.clientX - rect.left) * (w / rect.width)
      const sy = (event.clientY - rect.top) * (h / rect.height)
      const v = viewRef.current
      const k = clampZoom(v.k * Math.exp(-event.deltaY * 0.0015))
      setView({ k, x: sx - (sx - v.x) * (k / v.k), y: sy - (sy - v.y) * (k / v.k) })
    }
    svg.addEventListener('wheel', onWheel, { passive: false })
    return () => svg.removeEventListener('wheel', onWheel)
  }, [])

  /** Adjacency map for hover highlighting (id → neighbor ids). */
  const adjacency = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const edge of edges) {
      let from = map.get(edge.source)
      if (from === undefined) map.set(edge.source, from = new Set())
      from.add(edge.target)
      let to = map.get(edge.target)
      if (to === undefined) map.set(edge.target, to = new Set())
      to.add(edge.source)
    }
    return map
  }, [edges])

  const hoverNeighbors = hover === null ? null : adjacency.get(hover)
  const isRelated = (id: string): boolean => hover === null || id === hover || hoverNeighbors?.has(id) === true

  if (nodes.length === 0) return <p className={css.empty}>—</p>

  const sim = simRef.current
  const v = viewRef.current
  const showLabels = v.k >= 0.55

  return (
    <div ref={wrapRef} className={css.canvas} style={{ height }}>
      <svg
        ref={svgRef}
        className={css.svg}
        viewBox={`0 0 ${size.w} ${size.h}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        role="img"
        aria-label="plugin relationship graph"
      >
        <g transform={`translate(${v.x} ${v.y}) scale(${v.k})`}>
          {edgeRef.current.map((edge, i) => {
            const a = sim[edge.source]
            const b = sim[edge.target]
            if (a === undefined || b === undefined) return null
            const dimmed = hover !== null && !isRelated(a.id) && !isRelated(b.id)
            const active = hover !== null && (a.id === hover || b.id === hover)
            return (
              <line
                key={i}
                className={css[EDGE_CLASS[edge.kind]]}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                strokeWidth={active ? 2 : 1.1}
                opacity={dimmed ? 0.06 : active ? 0.95 : 0.5}
              />
            )
          })}
          {sim.map(node => {
            const dimmed = hover !== null && !isRelated(node.id)
            const active = hover === node.id
            const shape = node.kind === 'slot' ? (
              <rect
                x={-node.r}
                y={-node.r}
                width={node.r * 2}
                height={node.r * 2}
                transform={`rotate(45)`}
                className={css.nodeSlot}
              />
            ) : (
              <circle r={node.r} className={css.nodePlugin} />
            )
            return (
              <g
                key={node.id}
                transform={`translate(${node.x} ${node.y})`}
                opacity={dimmed ? 0.15 : 1}
                onPointerEnter={() => setHover(node.id)}
                onPointerLeave={() => setHover(current => current === node.id ? null : current)}
              >
                <title>{node.id}</title>
                {shape}
                {(showLabels || active) && (
                  <text className={css.label} y={node.r + 11} textAnchor="middle">{node.label}</text>
                )}
              </g>
            )
          })}
        </g>
      </svg>
    </div>
  )
}
