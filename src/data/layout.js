import { BOARD, KIND_SIZE } from '../constants.js'
import { rng, hashString } from './util.js'

/**
 * Pins every item to the cork exactly once, for the whole case — not per
 * visible year. If layout were recomputed as the year slider moves, evidence
 * would teleport around the board instead of fading in where it belongs.
 *
 * The arrangement is a size-aware dart throw with a soft column bias, so the
 * board reads the way a person would build it: press cuttings down the left,
 * cartography to the right, faces in the middle where you look first.
 */

const COLUMN_BIAS = {
  newspaper: -0.62,
  letter: -0.2,
  report: 0.18,
  map: 0.68,
  photo: 0,
  polaroid: 0.08,
  note: 0.3,
  tape: 0.52,
}

const ROW_BIAS = {
  newspaper: 0.1,
  map: 0.2,
  note: -0.45,
  tape: -0.55,
  report: -0.2,
  letter: -0.05,
  photo: 0.25,
  polaroid: 0.3,
}

export function layoutBoard(evidence, seedStr) {
  const rand = rng(hashString(seedStr))
  const halfW = BOARD.width / 2 - 1.6
  const halfH = BOARD.height / 2 - 1.4
  const placed = []

  // Chronological order means the oldest material naturally ends up nearest
  // the centre — the board grows outward the way an investigation does.
  const ordered = [...evidence].sort((a, b) => a.since - b.since)

  for (const item of ordered) {
    const [w, h] = KIND_SIZE[item.kind] || [1.6, 2]
    const sw = (w * (item.scale || 1)) / 2 + 0.24
    const sh = (h * (item.scale || 1)) / 2 + 0.24

    const cx = (COLUMN_BIAS[item.kind] ?? 0) * halfW
    const cy = (ROW_BIAS[item.kind] ?? 0) * halfH

    let best = null
    let bestScore = -Infinity

    // 90 candidate positions, keep the one furthest from its neighbours.
    for (let i = 0; i < 90; i++) {
      const spread = 0.35 + 0.65 * (i / 90) // widen the search if it's crowded
      const x = clamp(
        cx + (rand() * 2 - 1) * halfW * spread,
        -halfW + sw,
        halfW - sw,
      )
      const y = clamp(
        cy + (rand() * 2 - 1) * halfH * spread,
        -halfH + sh,
        halfH - sh,
      )

      let minGap = Infinity
      let overlaps = false
      for (const p of placed) {
        const dx = Math.abs(x - p.pos[0]) - (sw + p.half[0])
        const dy = Math.abs(y - p.pos[1]) - (sh + p.half[1])
        if (dx < 0 && dy < 0) {
          overlaps = true
          break
        }
        minGap = Math.min(minGap, Math.max(dx, dy))
      }
      if (overlaps) continue

      // Prefer snug-but-not-touching, and stay near the type's home column.
      const drift = Math.hypot(x - cx, y - cy) / halfW
      const score = -Math.abs(minGap - 0.5) - drift * 0.55
      if (score > bestScore) {
        bestScore = score
        best = [x, y]
      }
    }

    // Everything gets pinned somewhere, even on a full board.
    if (!best) {
      best = [
        clamp(cx + (rand() * 2 - 1) * halfW, -halfW + sw, halfW - sw),
        clamp(cy + (rand() * 2 - 1) * halfH, -halfH + sh, halfH - sh),
      ]
    }

    placed.push({
      ...item,
      pos: best,
      half: [sw, sh],
      // Nobody pins paper perfectly straight.
      rot: item.rot || (rand() * 2 - 1) * 0.09,
      // Layered depth so overlapping corners cast shadows on each other.
      depth: placed.length * 0.0016,
      seed: hashString(item.id),
    })
  }

  // Restore authoring order so ids resolve predictably elsewhere.
  const byId = new Map(placed.map((p) => [p.id, p]))
  return evidence.map((e) => byId.get(e.id))
}

function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v
}
