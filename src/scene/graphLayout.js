import { rng, hashString } from '../data/util.js'

/**
 * Relationship mode.
 *
 * A plain 3D force-directed layout — repulsion between every pair, springs
 * along every link, and a weak pull to the origin so the graph doesn't drift
 * apart. It runs to convergence once per (case, year) and is cached, because
 * the layout must not reshuffle while you are looking at it.
 *
 * Node counts here are small enough that the naive O(n²) pass is the right
 * answer; a Barnes-Hut tree would cost more to build than it saves.
 */
const cache = new Map()

export function graphLayout(caseId, year, evidence, links) {
  const key = `${caseId}:${year}:${evidence.length}:${links.length}`
  if (cache.has(key)) return cache.get(key)

  const n = evidence.length
  const index = new Map(evidence.map((e, i) => [e.id, i]))
  const rand = rng(hashString(caseId))

  const px = new Float32Array(n)
  const py = new Float32Array(n)
  const pz = new Float32Array(n)
  const vx = new Float32Array(n)
  const vy = new Float32Array(n)
  const vz = new Float32Array(n)
  const degree = new Float32Array(n)

  for (let i = 0; i < n; i++) {
    // Seed on a sphere rather than in a cube — fewer coplanar starts, which
    // means fewer flat, unreadable layouts.
    const u = rand() * 2 - 1
    const theta = rand() * Math.PI * 2
    const r = Math.sqrt(1 - u * u) * 5
    px[i] = Math.cos(theta) * r
    py[i] = Math.sin(theta) * r
    pz[i] = u * 5
  }

  const edges = []
  for (const l of links) {
    const a = index.get(l.from)
    const b = index.get(l.to)
    if (a == null || b == null) continue
    edges.push([a, b, l.kind === 'speculative' ? 0.45 : 1])
    degree[a]++
    degree[b]++
  }

  const REPEL = 9.0
  const SPRING = 0.055
  const REST = 3.6
  const CENTRE = 0.0055
  const DAMP = 0.86

  for (let step = 0; step < 460; step++) {
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let dx = px[j] - px[i]
        let dy = py[j] - py[i]
        let dz = pz[j] - pz[i]
        let d2 = dx * dx + dy * dy + dz * dz
        if (d2 < 0.01) {
          dx = rand() - 0.5
          dy = rand() - 0.5
          dz = rand() - 0.5
          d2 = 0.01
        }
        const d = Math.sqrt(d2)
        // Hub nodes claim more space, which is what makes the shape readable.
        const f = (REPEL * (1 + degree[i] * 0.16) * (1 + degree[j] * 0.16)) / d2 / d
        vx[i] -= dx * f
        vy[i] -= dy * f
        vz[i] -= dz * f
        vx[j] += dx * f
        vy[j] += dy * f
        vz[j] += dz * f
      }
    }

    for (const [a, b, w] of edges) {
      const dx = px[b] - px[a]
      const dy = py[b] - py[a]
      const dz = pz[b] - pz[a]
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-4
      const f = ((d - REST) / d) * SPRING * w
      vx[a] += dx * f
      vy[a] += dy * f
      vz[a] += dz * f
      vx[b] -= dx * f
      vy[b] -= dy * f
      vz[b] -= dz * f
    }

    for (let i = 0; i < n; i++) {
      vx[i] = (vx[i] - px[i] * CENTRE) * DAMP
      vy[i] = (vy[i] - py[i] * CENTRE) * DAMP
      vz[i] = (vz[i] - pz[i] * CENTRE) * DAMP
      px[i] += vx[i]
      py[i] += vy[i]
      pz[i] += vz[i]
    }
  }

  // Normalise into a volume that reads well from the default camera distance.
  let maxR = 1e-4
  for (let i = 0; i < n; i++) {
    maxR = Math.max(maxR, Math.hypot(px[i], py[i], pz[i]))
  }
  const scale = 7.4 / maxR

  const out = new Map()
  for (let i = 0; i < n; i++) {
    out.set(evidence[i].id, [
      px[i] * scale,
      py[i] * scale,
      pz[i] * scale * 0.75 + 5.5, // float the whole graph off the cork
    ])
  }

  cache.set(key, out)
  if (cache.size > 40) cache.delete(cache.keys().next().value)
  return out
}
