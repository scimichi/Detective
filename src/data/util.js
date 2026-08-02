/**
 * Authoring helpers for the case archive.
 *
 * Every piece of evidence carries more text than you can read at any single
 * zoom level. That is deliberate: `headline` is legible from across the room,
 * `body` appears when you lean in, `margin` / `circled` / `detail` only resolve
 * when the camera is close enough to touch the paper.
 */

let seq = 0

export const ev = (o) => ({
  id: o.id || `e${++seq}`,
  rot: 0,
  since: 1800,
  until: null,
  tags: [],
  body: [],
  ...o,
})

export const link = (from, to, kind = 'corroborates', o = {}) => ({
  from,
  to,
  kind,
  since: null,
  until: null,
  ...o,
})

/** A timeline node. Children expand in place, without limit. */
export const t = (year, title, detail, children = []) => ({
  year,
  title,
  detail,
  children,
})

/** Deterministic PRNG so every board is identical between sessions. */
export function rng(seed) {
  let s = seed >>> 0 || 1
  return () => {
    s ^= s << 13
    s >>>= 0
    s ^= s >> 17
    s ^= s << 5
    s >>>= 0
    return s / 4294967296
  }
}

export function hashString(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
