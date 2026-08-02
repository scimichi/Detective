/**
 * Paper primitives.
 *
 * There are no image assets in this project. Every scan, stain, ridge and
 * ink-bleed is drawn procedurally at the resolution the camera currently
 * needs, which is what makes unbounded zoom affordable: the "full-resolution
 * scan" doesn't exist until you lean in far enough to deserve it.
 *
 * Every function is deterministic given the item's seed, so the coffee ring
 * on a particular report is in the same place forever.
 */

export function mulberry(seed) {
  let a = (seed >>> 0) || 1
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function makeCanvas(w, h) {
  const c =
    typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(w, h)
      : Object.assign(document.createElement('canvas'), { width: w, height: h })
  c.width = w
  c.height = h
  return c
}

const rgba = (r, g, b, a) => `rgba(${r|0},${g|0},${b|0},${a})`

// ── Substrate ──────────────────────────────────────────────────────────────

const STOCKS = {
  newsprint: { base: [214, 203, 178], warm: [186, 165, 128], grain: 0.055 },
  bond: { base: [231, 223, 205], warm: [200, 184, 152], grain: 0.038 },
  onionskin: { base: [236, 231, 214], warm: [206, 197, 168], grain: 0.03 },
  card: { base: [223, 214, 196], warm: [190, 176, 148], grain: 0.045 },
  photo: { base: [206, 203, 197], warm: [150, 146, 138], grain: 0.05 },
  chart: { base: [227, 222, 206], warm: [188, 186, 164], grain: 0.032 },
}

/**
 * Aged paper: a warm base, uneven bleaching, fibres, and darkening that
 * creeps in from the edges the way real stored paper yellows.
 */
export function paperBase(ctx, w, h, stockName, rand, age = 0.5) {
  const stock = STOCKS[stockName] || STOCKS.bond
  const [br, bg, bb] = stock.base
  const [wr, wg, wb] = stock.warm

  ctx.fillStyle = rgba(br, bg, bb, 1)
  ctx.fillRect(0, 0, w, h)

  // Large-scale blotching — paper does not age evenly.
  const blobs = 14
  for (let i = 0; i < blobs; i++) {
    const x = rand() * w
    const y = rand() * h
    const r = (0.25 + rand() * 0.6) * Math.max(w, h)
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    const a = 0.05 + rand() * 0.09 * age
    g.addColorStop(0, rgba(wr, wg, wb, a))
    g.addColorStop(1, rgba(wr, wg, wb, 0))
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
  }

  // Edge darkening.
  const edge = ctx.createLinearGradient(0, 0, 0, h)
  edge.addColorStop(0, rgba(wr * 0.8, wg * 0.8, wb * 0.8, 0.22 * age))
  edge.addColorStop(0.14, rgba(wr, wg, wb, 0))
  edge.addColorStop(0.86, rgba(wr, wg, wb, 0))
  edge.addColorStop(1, rgba(wr * 0.8, wg * 0.8, wb * 0.8, 0.26 * age))
  ctx.fillStyle = edge
  ctx.fillRect(0, 0, w, h)

  const edge2 = ctx.createLinearGradient(0, 0, w, 0)
  edge2.addColorStop(0, rgba(wr * 0.8, wg * 0.8, wb * 0.8, 0.2 * age))
  edge2.addColorStop(0.12, rgba(wr, wg, wb, 0))
  edge2.addColorStop(0.88, rgba(wr, wg, wb, 0))
  edge2.addColorStop(1, rgba(wr * 0.8, wg * 0.8, wb * 0.8, 0.24 * age))
  ctx.fillStyle = edge2
  ctx.fillRect(0, 0, w, h)

  return stock
}

/** Per-pixel fibre and grain. Only worth paying for at close range. */
export function paperFibres(ctx, w, h, rand, amount = 1) {
  const n = Math.floor(w * h * 0.0016 * amount)
  ctx.save()
  for (let i = 0; i < n; i++) {
    const x = rand() * w
    const y = rand() * h
    const len = 1 + rand() * 5
    const a = rand() * 0.05
    ctx.strokeStyle = rand() > 0.5 ? rgba(255, 253, 245, a * 1.6) : rgba(90, 78, 58, a)
    ctx.lineWidth = 0.6 + rand() * 0.7
    ctx.beginPath()
    ctx.moveTo(x, y)
    const ang = rand() * Math.PI
    ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len)
    ctx.stroke()
  }
  ctx.restore()
}

/** Foxing — the small rust-coloured age spots on stored paper. */
export function foxing(ctx, w, h, rand, count = 30) {
  ctx.save()
  for (let i = 0; i < count; i++) {
    const x = rand() * w
    const y = rand() * h
    const r = (0.004 + rand() * 0.016) * Math.max(w, h)
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, rgba(148, 108, 62, 0.16 + rand() * 0.16))
    g.addColorStop(0.6, rgba(148, 108, 62, 0.05))
    g.addColorStop(1, rgba(148, 108, 62, 0))
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

/** A dried coffee ring: dark at the rim where the solids collected. */
export function coffeeRing(ctx, cx, cy, r, rand, strength = 1) {
  ctx.save()
  const steps = 96
  ctx.globalCompositeOperation = 'multiply'

  const fill = ctx.createRadialGradient(cx, cy, r * 0.1, cx, cy, r)
  fill.addColorStop(0, rgba(150, 112, 62, 0.05 * strength))
  fill.addColorStop(0.82, rgba(140, 100, 54, 0.09 * strength))
  fill.addColorStop(1, rgba(120, 84, 44, 0.02 * strength))
  ctx.fillStyle = fill
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()

  // The rim, drawn as many short arcs of varying weight so it never closes
  // into a perfect circle.
  ctx.lineCap = 'round'
  for (let i = 0; i < steps; i++) {
    const a0 = (i / steps) * Math.PI * 2
    const a1 = ((i + 1.4) / steps) * Math.PI * 2
    const wob = 1 + (rand() - 0.5) * 0.045
    ctx.strokeStyle = rgba(122, 86, 44, (0.12 + rand() * 0.3) * strength)
    ctx.lineWidth = r * (0.012 + rand() * 0.03)
    ctx.beginPath()
    ctx.arc(cx, cy, r * wob, a0, a1)
    ctx.stroke()
  }
  ctx.restore()
}

/** Latent fingerprint: warped concentric ridges with a core and a delta. */
export function fingerprint(ctx, cx, cy, r, rot, rand, alpha = 0.16, tint = [40, 34, 28]) {
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(rot)
  ctx.lineWidth = Math.max(0.7, r * 0.016)
  ctx.lineCap = 'round'

  const rings = Math.floor(16 + r * 0.09)
  for (let i = 1; i <= rings; i++) {
    const f = i / rings
    const rx = r * f * (0.62 + 0.38 * f)
    const ry = r * f * 1.18
    const jitterSeed = rand() * 6.283
    ctx.strokeStyle = rgba(tint[0], tint[1], tint[2], alpha * (0.55 + 0.45 * (1 - f)))
    ctx.beginPath()
    let started = false
    // Ridges break — a continuous ellipse reads as a target, not a print.
    for (let a = -0.35; a < Math.PI * 2 - 0.35; a += 0.06) {
      const warp =
        1 +
        0.09 * Math.sin(a * 3 + jitterSeed) +
        0.05 * Math.sin(a * 7 - jitterSeed * 2)
      const x = Math.cos(a) * rx * warp
      const y = Math.sin(a) * ry * warp - r * 0.18 * f
      const gap = Math.sin(a * 11 + i * 2.3) > 0.93
      if (gap) {
        started = false
        continue
      }
      if (!started) {
        ctx.moveTo(x, y)
        started = true
      } else ctx.lineTo(x, y)
    }
    ctx.stroke()
  }
  ctx.restore()
}

/** Fold marks: a bright crest with a shadow on one side. */
export function foldMarks(ctx, w, h, rand, count = 2) {
  ctx.save()
  for (let i = 0; i < count; i++) {
    const horizontal = rand() > 0.45
    const p = 0.25 + rand() * 0.5
    if (horizontal) {
      const y = h * p
      const g = ctx.createLinearGradient(0, y - h * 0.014, 0, y + h * 0.014)
      g.addColorStop(0, rgba(90, 76, 54, 0))
      g.addColorStop(0.42, rgba(90, 76, 54, 0.14))
      g.addColorStop(0.5, rgba(255, 252, 240, 0.2))
      g.addColorStop(0.58, rgba(90, 76, 54, 0.1))
      g.addColorStop(1, rgba(90, 76, 54, 0))
      ctx.fillStyle = g
      ctx.fillRect(0, y - h * 0.014, w, h * 0.028)
      // Cracking along the crease where the fibres have failed.
      ctx.strokeStyle = rgba(70, 58, 40, 0.2)
      ctx.lineWidth = Math.max(0.6, h * 0.0012)
      ctx.beginPath()
      for (let x = 0; x < w; x += 6) {
        const yy = y + (rand() - 0.5) * h * 0.004
        if (rand() > 0.55) ctx.moveTo(x, yy)
        else ctx.lineTo(x, yy)
      }
      ctx.stroke()
    } else {
      const x = w * p
      const g = ctx.createLinearGradient(x - w * 0.012, 0, x + w * 0.012, 0)
      g.addColorStop(0, rgba(90, 76, 54, 0))
      g.addColorStop(0.42, rgba(90, 76, 54, 0.13))
      g.addColorStop(0.5, rgba(255, 252, 240, 0.18))
      g.addColorStop(0.58, rgba(90, 76, 54, 0.09))
      g.addColorStop(1, rgba(90, 76, 54, 0))
      ctx.fillStyle = g
      ctx.fillRect(x - w * 0.012, 0, w * 0.024, h)
    }
  }
  ctx.restore()
}

/** Torn / softened edge, drawn by knocking pixels out of the border. */
export function distressEdges(ctx, w, h, rand, amount = 1) {
  ctx.save()
  ctx.globalCompositeOperation = 'destination-out'
  const bites = Math.floor(90 * amount)
  for (let i = 0; i < bites; i++) {
    const side = Math.floor(rand() * 4)
    const t = rand()
    let x, y
    if (side === 0) [x, y] = [t * w, 0]
    else if (side === 1) [x, y] = [w, t * h]
    else if (side === 2) [x, y] = [t * w, h]
    else [x, y] = [0, t * h]
    const r = (0.002 + rand() * 0.01) * Math.max(w, h)
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

// ── Ink ────────────────────────────────────────────────────────────────────

/**
 * Handwriting. Real glyphs in a script face, then broken up per character:
 * baseline drift, rotation, size variance and a soft bleed pass underneath.
 * Legible — because a margin note you can't read is just a smudge — but
 * unmistakably written by a hand.
 */
export function handwrite(ctx, text, x, y, opts = {}) {
  const {
    size = 28,
    maxWidth = 1e9,
    color = [26, 34, 82],
    alpha = 0.85,
    slant = -0.04,
    jitter = 1,
    bleed = 0.5,
    rand = Math.random,
    lineHeight = 1.35,
  } = opts

  const font = `italic ${size}px "Segoe Script", "Bradley Hand", "Snell Roundhand", "Apple Chancery", "Comic Sans MS", cursive`
  ctx.save()
  ctx.font = font
  ctx.textBaseline = 'alphabetic'

  // Greedy wrap using the real measured widths.
  const words = String(text).split(/\s+/)
  const lines = []
  let line = ''
  for (const word of words) {
    const test = line ? line + ' ' + word : word
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = word
    } else line = test
  }
  if (line) lines.push(line)

  const drawPass = (dx, dy, a, blur) => {
    ctx.save()
    if (blur) ctx.filter = `blur(${blur}px)`
    ctx.fillStyle = rgba(color[0], color[1], color[2], a)
    let cy = y
    for (const ln of lines) {
      let cx = x
      // Each line drifts off horizontal slightly, like unruled writing.
      const drift = (rand() - 0.5) * size * 0.12 * jitter
      for (let i = 0; i < ln.length; i++) {
        const ch = ln[i]
        const w = ctx.measureText(ch).width
        ctx.save()
        ctx.translate(cx + dx, cy + dy + drift * (i / Math.max(1, ln.length)))
        ctx.rotate(slant + (rand() - 0.5) * 0.07 * jitter)
        const s = 1 + (rand() - 0.5) * 0.11 * jitter
        ctx.scale(s, 1 + (rand() - 0.5) * 0.07 * jitter)
        ctx.fillText(ch, 0, (rand() - 0.5) * size * 0.06 * jitter)
        ctx.restore()
        // Cursive letters crowd together.
        cx += w * 0.93
      }
      cy += size * lineHeight
    }
    ctx.restore()
  }

  // Ink soaks into the fibres before it dries on top of them.
  if (bleed > 0) drawPass(0, 0, alpha * 0.3 * bleed, Math.max(1, size * 0.06))
  drawPass(0, 0, alpha, 0)

  ctx.restore()
  return lines.length * size * lineHeight
}

/** Typewriter text: uneven inking and characters that sit slightly off-line. */
export function typewrite(ctx, text, x, y, opts = {}) {
  const {
    size = 16,
    maxWidth = 1e9,
    color = [38, 32, 26],
    alpha = 0.82,
    rand = Math.random,
    lineHeight = 1.62,
    tracking = 0.02,
  } = opts

  ctx.save()
  ctx.font = `${size}px "Courier New", "Nimbus Mono PS", monospace`
  ctx.textBaseline = 'alphabetic'

  const words = String(text).split(/\s+/)
  const lines = []
  let line = ''
  for (const word of words) {
    const test = line ? line + ' ' + word : word
    if (ctx.measureText(test).width * (1 + tracking) > maxWidth && line) {
      lines.push(line)
      line = word
    } else line = test
  }
  if (line) lines.push(line)

  let cy = y
  for (const ln of lines) {
    let cx = x
    for (const ch of ln) {
      const w = ctx.measureText(ch).width
      // Some keys strike harder than others, and the ribbon is unevenly wet.
      const strike = 0.55 + rand() * 0.62
      ctx.fillStyle = rgba(color[0], color[1], color[2], Math.min(1, alpha * strike))
      ctx.fillText(ch, cx, cy + (rand() - 0.5) * size * 0.09)
      cx += w * (1 + tracking)
    }
    cy += size * lineHeight
  }
  ctx.restore()
  return lines.length * size * lineHeight
}

/** Body copy in a serif face, wrapped, with a very slight ink spread. */
export function setText(ctx, text, x, y, opts = {}) {
  const {
    size = 15,
    maxWidth = 400,
    color = [32, 28, 24],
    alpha = 0.88,
    lineHeight = 1.42,
    font = 'Georgia, "Times New Roman", serif',
    weight = '',
    align = 'left',
    maxLines = Infinity,
  } = opts

  ctx.save()
  ctx.font = `${weight} ${size}px ${font}`.trim()
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = rgba(color[0], color[1], color[2], alpha)

  const words = String(text).split(/\s+/)
  const lines = []
  let line = ''
  for (const word of words) {
    const test = line ? line + ' ' + word : word
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = word
      if (lines.length >= maxLines) break
    } else line = test
  }
  if (line && lines.length < maxLines) lines.push(line)

  let cy = y
  for (const ln of lines) {
    const lw = ctx.measureText(ln).width
    const lx = align === 'center' ? x - lw / 2 : align === 'right' ? x - lw : x
    ctx.fillText(ln, lx, cy)
    cy += size * lineHeight
  }
  ctx.restore()
  return { height: lines.length * size * lineHeight, lines: lines.length, y: cy }
}

/**
 * Illegible body copy. Below a certain scale real glyphs are a waste of fill
 * rate — grey bars carry the same information to the eye at a fraction of
 * the cost, and they are what a 512px scan actually looks like.
 */
export function greekText(ctx, x, y, w, lines, opts = {}) {
  const { size = 6, color = [46, 40, 34], alpha = 0.5, rand = Math.random, lineHeight = 1.7 } = opts
  ctx.save()
  ctx.fillStyle = rgba(color[0], color[1], color[2], alpha)
  let cy = y
  for (let i = 0; i < lines; i++) {
    const isLast = i === lines - 1
    const lw = w * (isLast ? 0.35 + rand() * 0.4 : 0.9 + rand() * 0.1)
    ctx.fillRect(x, cy, lw, Math.max(1, size * 0.52))
    cy += size * lineHeight
  }
  ctx.restore()
  return cy - y
}

/** The circle someone drew around a sentence, in ink that has since faded. */
export function circleAnnotation(ctx, x, y, w, h, rand, color = [178, 40, 34], alpha = 0.5) {
  ctx.save()
  ctx.strokeStyle = rgba(color[0], color[1], color[2], alpha)
  ctx.lineWidth = Math.max(1.2, h * 0.09)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  // Two overlapping passes; nobody draws a closed loop in one go.
  for (let pass = 0; pass < 2; pass++) {
    ctx.globalAlpha = pass === 0 ? 1 : 0.45
    ctx.beginPath()
    const cx = x + w / 2
    const cy = y + h / 2
    const rx = w / 2
    const ry = h / 2
    const start = -0.6 + pass * 0.4
    const end = start + Math.PI * 2 + 0.5 + rand() * 0.4
    for (let a = start; a <= end; a += 0.12) {
      const wob = 1 + 0.055 * Math.sin(a * 3.1 + pass) + (rand() - 0.5) * 0.02
      const px = cx + Math.cos(a) * rx * wob
      const py = cy + Math.sin(a) * ry * wob * 1.05
      if (a === start) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.stroke()
  }
  ctx.restore()
}

/** Rubber stamp: rotated, uneven, and dry in patches. */
export function stamp(ctx, text, cx, cy, rot, rand, opts = {}) {
  const { size = 34, color = [150, 44, 38], alpha = 0.5, box = true } = opts
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(rot)
  ctx.font = `bold ${size}px "Arial Narrow", Impact, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const w = ctx.measureText(text).width

  ctx.strokeStyle = rgba(color[0], color[1], color[2], alpha)
  ctx.fillStyle = rgba(color[0], color[1], color[2], alpha)
  if (box) {
    ctx.lineWidth = Math.max(2, size * 0.1)
    ctx.strokeRect(-w / 2 - size * 0.4, -size * 0.72, w + size * 0.8, size * 1.44)
  }
  ctx.fillText(text, 0, 0)

  // Knock out flecks so the impression looks dry.
  ctx.globalCompositeOperation = 'destination-out'
  for (let i = 0; i < 140; i++) {
    const x = (rand() - 0.5) * (w + size * 1.2)
    const y = (rand() - 0.5) * size * 1.8
    ctx.beginPath()
    ctx.arc(x, y, rand() * size * 0.07, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

/** Redaction that has bled through from the other side of the sheet. */
export function redact(ctx, x, y, w, h, rand) {
  ctx.save()
  ctx.fillStyle = rgba(24, 20, 18, 0.88)
  ctx.fillRect(x, y, w, h)
  ctx.filter = 'blur(2px)'
  ctx.fillStyle = rgba(30, 24, 30, 0.3)
  ctx.fillRect(x - w * 0.01, y - h * 0.12, w * 1.02, h * 1.24)
  ctx.restore()
}

// ── Photographic ───────────────────────────────────────────────────────────

/** Halftone screen — what makes a newspaper photo read as newsprint. */
export function halftone(ctx, x, y, w, h, sample, opts = {}) {
  const { pitch = 6, angle = Math.PI / 4, color = [30, 26, 22] } = opts
  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y, w, h)
  ctx.clip()
  ctx.translate(x + w / 2, y + h / 2)
  ctx.rotate(angle)
  ctx.fillStyle = rgba(color[0], color[1], color[2], 1)
  const r = Math.hypot(w, h) / 2 + pitch
  for (let py = -r; py < r; py += pitch) {
    for (let px = -r; px < r; px += pitch) {
      // Back into unrotated space to sample the underlying image function.
      const c = Math.cos(-angle)
      const s = Math.sin(-angle)
      const ux = (px * c - py * s) / w + 0.5
      const uy = (px * s + py * c) / h + 0.5
      if (ux < 0 || ux > 1 || uy < 0 || uy > 1) continue
      const v = 1 - sample(ux, uy)
      if (v <= 0.02) continue
      ctx.beginPath()
      ctx.arc(px, py, (pitch * 0.62) * Math.sqrt(v), 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.restore()
}

/** Silver-gelatin grain, scratches, and a dust speck or two. */
export function filmGrain(ctx, x, y, w, h, rand, amount = 1) {
  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y, w, h)
  ctx.clip()
  const n = Math.floor(w * h * 0.004 * amount)
  for (let i = 0; i < n; i++) {
    const gx = x + rand() * w
    const gy = y + rand() * h
    const a = rand() * 0.09
    ctx.fillStyle = rand() > 0.5 ? rgba(255, 255, 255, a) : rgba(0, 0, 0, a)
    ctx.fillRect(gx, gy, 1, 1)
  }
  for (let i = 0; i < 5 * amount; i++) {
    ctx.strokeStyle = rgba(255, 255, 250, 0.05 + rand() * 0.1)
    ctx.lineWidth = 0.5 + rand()
    ctx.beginPath()
    const sx = x + rand() * w
    ctx.moveTo(sx, y)
    ctx.lineTo(sx + (rand() - 0.5) * w * 0.05, y + h)
    ctx.stroke()
  }
  ctx.restore()
}

export function vignette(ctx, x, y, w, h, strength = 0.5) {
  ctx.save()
  const g = ctx.createRadialGradient(
    x + w / 2, y + h / 2, Math.min(w, h) * 0.24,
    x + w / 2, y + h / 2, Math.hypot(w, h) * 0.6,
  )
  g.addColorStop(0, 'rgba(0,0,0,0)')
  g.addColorStop(1, `rgba(0,0,0,${strength})`)
  ctx.fillStyle = g
  ctx.fillRect(x, y, w, h)
  ctx.restore()
}

// ── Procedural imagery ─────────────────────────────────────────────────────
// Sampling functions returning luminance 0..1 for (u,v) in the unit square.
// They are fed to `halftone` for press photos and painted directly for prints.

export function motifNight(seed) {
  const r = mulberry(seed)
  const horizon = 0.52 + r() * 0.1
  const trees = Array.from({ length: 26 }, () => ({
    x: r(),
    w: 0.02 + r() * 0.05,
    h: 0.06 + r() * 0.22,
  }))
  const roadY = horizon + 0.04
  return (u, v) => {
    if (v < horizon) {
      // Sky, with a faint gradient and a moon-less haze.
      let l = 0.12 + (v / horizon) * 0.16
      for (const t of trees) {
        if (Math.abs(u - t.x) < t.w && v > horizon - t.h) l *= 0.25
      }
      return l
    }
    // Road surface catching a low light source.
    const d = (v - roadY) / (1 - roadY)
    const centre = 1 - Math.min(1, Math.abs(u - 0.5) * 2.4)
    return 0.1 + d * 0.24 + centre * d * 0.4
  }
}

export function motifFace(seed) {
  const r = mulberry(seed)
  const cx = 0.5 + (r() - 0.5) * 0.05
  const cy = 0.47
  const rx = 0.19 + r() * 0.03
  const ry = 0.26 + r() * 0.03
  const glasses = r() > 0.35
  const browY = cy - ry * 0.32
  return (u, v) => {
    const dx = (u - cx) / rx
    const dy = (v - cy) / ry
    const d = dx * dx + dy * dy
    if (d > 1.35) return 0.14 + (1 - v) * 0.06 // backdrop
    // Face, lit from the upper left the way a composite always is.
    let l = 0.62 - dx * 0.16 - Math.max(0, d - 0.6) * 0.5
    // Hair mass.
    if (v < browY && d < 1.2) l *= 0.42
    // Eye sockets.
    const eyeY = cy - ry * 0.12
    for (const ex of [cx - rx * 0.4, cx + rx * 0.4]) {
      if (Math.hypot((u - ex) / (rx * 0.2), (v - eyeY) / (ry * 0.09)) < 1) l *= 0.35
    }
    if (glasses) {
      for (const ex of [cx - rx * 0.44, cx + rx * 0.44]) {
        const rr = Math.hypot((u - ex) / (rx * 0.34), (v - eyeY) / (ry * 0.2))
        if (rr > 0.86 && rr < 1.05) l *= 0.3
      }
      if (Math.abs(v - eyeY) < ry * 0.02 && Math.abs(u - cx) < rx * 0.14) l *= 0.3
    }
    // Mouth.
    if (Math.hypot((u - cx) / (rx * 0.34), (v - (cy + ry * 0.45)) / (ry * 0.045)) < 1) l *= 0.45
    return Math.max(0.03, Math.min(1, l))
  }
}

export function motifObject(seed) {
  const r = mulberry(seed)
  const cx = 0.5
  const cy = 0.54
  const w = 0.3 + r() * 0.14
  const h = 0.16 + r() * 0.12
  const skew = (r() - 0.5) * 0.3
  return (u, v) => {
    const backdrop = 0.72 - v * 0.28
    const uu = u - skew * (v - cy)
    const inside = Math.abs(uu - cx) < w && Math.abs(v - cy) < h
    if (!inside) {
      // Contact shadow under the object.
      const s = Math.max(0, 1 - Math.hypot((u - cx) / (w * 1.5), (v - cy - h) / (h * 0.6)))
      return Math.max(0.05, backdrop - s * 0.42)
    }
    const t = (v - (cy - h)) / (2 * h)
    return 0.16 + t * 0.14 + Math.max(0, 0.3 - Math.abs(uu - cx) / w) * 0.5
  }
}

export function motifTerrain(seed) {
  const r = mulberry(seed)
  const oct = Array.from({ length: 5 }, (_, i) => ({
    f: 2 ** (i + 1) * 1.7,
    a: 0.5 ** i,
    px: r() * 10,
    py: r() * 10,
  }))
  return (u, v) => {
    let n = 0
    let norm = 0
    for (const o of oct) {
      n += o.a * Math.sin(u * o.f + o.px) * Math.cos(v * o.f * 1.13 + o.py)
      norm += o.a
    }
    n = n / norm * 0.5 + 0.5
    // Water reads dark and flat.
    if (n < 0.42) return 0.16 + n * 0.1
    return 0.3 + (n - 0.42) * 1.1
  }
}

export function paintSample(ctx, x, y, w, h, sample, res = 96, tint = null) {
  const cw = Math.min(res, Math.max(8, Math.round(w / 3)))
  const ch = Math.min(res, Math.max(8, Math.round(h / 3)))
  const off = makeCanvas(cw, ch)
  const octx = off.getContext('2d')
  const img = octx.createImageData(cw, ch)
  for (let j = 0; j < ch; j++) {
    for (let i = 0; i < cw; i++) {
      const l = Math.max(0, Math.min(1, sample((i + 0.5) / cw, (j + 0.5) / ch)))
      const o = (j * cw + i) * 4
      const v = l * 255
      img.data[o] = tint ? v * tint[0] : v
      img.data[o + 1] = tint ? v * tint[1] : v
      img.data[o + 2] = tint ? v * tint[2] : v
      img.data[o + 3] = 255
    }
  }
  octx.putImageData(img, 0, 0)
  ctx.save()
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(off, x, y, w, h)
  ctx.restore()
}

export const MOTIFS = {
  night: motifNight,
  face: motifFace,
  object: motifObject,
  terrain: motifTerrain,
}

/** Pick a motif from an item's tags so imagery matches its content. */
export function motifFor(item) {
  const tags = item.tags || []
  if (tags.includes('suspect')) return 'face'
  if (tags.includes('victims')) return 'face'
  if (tags.includes('map') || tags.includes('search')) return 'terrain'
  if (tags.includes('scene')) return 'night'
  if (tags.includes('physical') || tags.includes('debris') || tags.includes('aftermath'))
    return 'object'
  if (item.kind === 'photo') return 'night'
  return 'object'
}
