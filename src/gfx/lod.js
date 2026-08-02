import * as THREE from 'three'
import { renderEvidence, renderHidden } from './generators.js'
import { LOD, KIND_SIZE } from '../constants.js'

/**
 * Asset streaming.
 *
 * Nothing is preloaded except 64px thumbnails. Higher levels are generated
 * only when the camera earns them, one job per idle slice so the frame never
 * stalls on a 2560px canvas. Detail levels are evicted least-recently-used —
 * without that, walking along a board would climb to a gigabyte of VRAM.
 */

const idle =
  typeof requestIdleCallback === 'function'
    ? requestIdleCallback
    : (cb) => setTimeout(() => cb({ timeRemaining: () => 8, didTimeout: false }), 16)

class LODManager {
  constructor() {
    /** @type {Map<string, {tex: THREE.Texture, level: number, used: number, bytes: number}>} */
    this.cache = new Map()
    this.hiddenCache = new Map()
    this.queue = []
    this.pending = new Set()
    this.running = false
    this.clock = 0
    this.onStreamChange = null
  }

  key(id, level) {
    return `${id}@${level}`
  }

  dims(item, level) {
    const [kw, kh] = KIND_SIZE[item.kind] || [1.6, 2]
    const long = LOD.sizes[level]
    const aspect = kw / kh
    return aspect >= 1
      ? [Math.round(long), Math.round(long / aspect)]
      : [Math.round(long * aspect), Math.round(long)]
  }

  /**
   * Returns the best texture available right now for `item` at or below
   * `level`, and schedules the exact level if it is missing. Callers always
   * get something to draw — a blurry 64px stand-in is the point.
   */
  request(item, level) {
    const want = Math.max(0, Math.min(LOD.sizes.length - 1, level))
    let best = null
    let bestLevel = -1

    for (let l = want; l >= 0; l--) {
      const entry = this.cache.get(this.key(item.id, l))
      if (entry) {
        entry.used = ++this.clock
        best = entry.tex
        bestLevel = l
        break
      }
    }

    if (bestLevel < want) this.enqueue(item, want)
    // Level 0 is so cheap it is never worth waiting for.
    if (bestLevel < 0) this.generate(item, 0)

    if (bestLevel < 0) {
      const entry = this.cache.get(this.key(item.id, 0))
      return entry ? entry.tex : null
    }
    return best
  }

  hidden(item) {
    if (!item.hidden) return null
    const cached = this.hiddenCache.get(item.id)
    if (cached) return cached
    const [w, h] = this.dims(item, 1)
    const tex = this.toTexture(renderHidden(item, w, h))
    this.hiddenCache.set(item.id, tex)
    return tex
  }

  enqueue(item, level) {
    const key = this.key(item.id, level)
    if (this.cache.has(key) || this.pending.has(key)) return
    this.pending.add(key)
    // Highest level first: whatever the camera is closest to matters most.
    this.queue.push({ item, level, key })
    this.queue.sort((a, b) => b.level - a.level)
    this.notify()
    this.pump()
  }

  pump() {
    if (this.running) return
    this.running = true
    idle((deadline) => {
      this.running = false
      let budget = 1
      // Thumbnails are cheap enough to batch.
      while (this.queue.length && budget > 0) {
        const job = this.queue.shift()
        if (this.cache.has(job.key)) {
          this.pending.delete(job.key)
          continue
        }
        this.generate(job.item, job.level)
        this.pending.delete(job.key)
        budget -= job.level <= 1 ? 0.2 : 1
        if (typeof deadline?.timeRemaining === 'function' && deadline.timeRemaining() <= 1) break
      }
      this.notify()
      if (this.queue.length) this.pump()
    })
  }

  generate(item, level) {
    const key = this.key(item.id, level)
    if (this.cache.has(key)) return this.cache.get(key).tex
    const [w, h] = this.dims(item, level)
    const canvas = renderEvidence(item, level, w, h)
    const tex = this.toTexture(canvas)
    this.cache.set(key, { tex, level, used: ++this.clock, bytes: w * h * 4, id: item.id })
    this.evict()
    return tex
  }

  toTexture(canvas) {
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 8
    tex.generateMipmaps = true
    tex.minFilter = THREE.LinearMipmapLinearFilter
    tex.magFilter = THREE.LinearFilter
    tex.needsUpdate = true
    return tex
  }

  evict() {
    for (const [level, budget] of [
      [3, LOD.residentDetail],
      [2, LOD.residentFull],
    ]) {
      const entries = [...this.cache.entries()].filter(([, v]) => v.level === level)
      if (entries.length <= budget) continue
      entries.sort((a, b) => a[1].used - b[1].used)
      for (let i = 0; i < entries.length - budget; i++) {
        const [key, value] = entries[i]
        value.tex.dispose()
        this.cache.delete(key)
      }
    }
  }

  notify() {
    this.onStreamChange?.(this.queue.length + this.pending.size)
  }

  /** Preload the thumbnail tier for a whole case, so nothing pops in blank. */
  warm(evidence) {
    for (const item of evidence) this.enqueue(item, 0)
  }

  disposeAll() {
    for (const { tex } of this.cache.values()) tex.dispose()
    for (const tex of this.hiddenCache.values()) tex.dispose()
    this.cache.clear()
    this.hiddenCache.clear()
    this.queue.length = 0
    this.pending.clear()
    this.notify()
  }

  stats() {
    let bytes = 0
    for (const v of this.cache.values()) bytes += v.bytes
    return { textures: this.cache.size, mb: bytes / 1048576, queued: this.queue.length }
  }
}

export const lod = new LODManager()

/** Distance → LOD level. The thresholds are the whole zoom experience. */
export function levelForDistance(d) {
  if (d < 1.15) return 3
  if (d < 3.2) return 2
  if (d < 9.0) return 1
  return 0
}
