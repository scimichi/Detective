import {
  makeCanvas,
  mulberry,
  paperBase,
  paperFibres,
  foxing,
  coffeeRing,
  fingerprint,
  foldMarks,
  distressEdges,
  handwrite,
  typewrite,
  setText,
  greekText,
  circleAnnotation,
  stamp,
  redact,
  halftone,
  filmGrain,
  vignette,
  paintSample,
  MOTIFS,
  motifFor,
} from './canvas2d.js'

/**
 * Draws one piece of evidence at one level of detail.
 *
 * Level 0  — 64px.  A colour, a mass, an orientation. Legible as "paper".
 * Level 1  — 512px. Headline, layout, the shape of the article.
 * Level 2  — 1536px. Every word of the body, stamps, foxing, folds.
 * Level 3  — 3072px. Fibres, ink bleed, coffee, fingerprints, the margin note,
 *            the circled sentence, and the archivist's pencil at the foot.
 *
 * Each level is a superset of the last, so the swap reads as focus pulling in
 * rather than as content appearing from nowhere.
 */

const INK = [34, 29, 24]
const RED = [168, 42, 34]
const PENCIL = [72, 70, 66]

export function renderEvidence(item, level, w, h) {
  const canvas = makeCanvas(w, h)
  const ctx = canvas.getContext('2d', { alpha: true })
  const rand = mulberry(item.seed + level * 7919)
  const S = Math.max(w, h) / 1000 // one "design unit"

  const fn = RENDERERS[item.kind] || RENDERERS.report
  fn(ctx, w, h, S, item, level, rand)

  // ── Shared ageing passes, gated by level ────────────────────────────────
  if (level >= 2 && item.kind !== 'tape') {
    foxing(ctx, w, h, rand, Math.floor(14 + rand() * 26))
    foldMarks(ctx, w, h, rand, item.kind === 'map' ? 3 : 1)
  }

  if (level >= 3 && item.kind !== 'tape') {
    paperFibres(ctx, w, h, rand, 1)

    // Not everything has been left on a desk with a cup on it.
    if (rand() > 0.45) {
      coffeeRing(
        ctx,
        w * (0.15 + rand() * 0.7),
        h * (0.15 + rand() * 0.7),
        Math.min(w, h) * (0.1 + rand() * 0.14),
        rand,
        0.7 + rand() * 0.6,
      )
    }

    const prints = 1 + Math.floor(rand() * 2)
    for (let i = 0; i < prints; i++) {
      fingerprint(
        ctx,
        w * (0.08 + rand() * 0.84),
        h * (0.08 + rand() * 0.84),
        Math.min(w, h) * (0.05 + rand() * 0.05),
        rand() * Math.PI,
        rand,
        0.07 + rand() * 0.07,
      )
    }

    // The archivist's note, in pencil, along the bottom edge.
    if (item.detail) {
      ctx.save()
      ctx.globalAlpha = 0.7
      setText(ctx, item.detail, w * 0.05, h - 12 * S, {
        size: 9 * S,
        maxWidth: w * 0.9,
        color: PENCIL,
        alpha: 0.7,
        font: '"Helvetica Neue", Arial, sans-serif',
        lineHeight: 1.3,
        maxLines: 2,
      })
      ctx.restore()
    }
  }

  if (level >= 2 && item.kind !== 'tape') distressEdges(ctx, w, h, rand, 1)

  return canvas
}

/**
 * The layer that only exists under ultraviolet or infrared. Rendered white on
 * black and blended additively by the evidence shader, so it can be revealed
 * inside the flashlight cone without disturbing the visible print.
 */
export function renderHidden(item, w, h) {
  const canvas = makeCanvas(w, h)
  const ctx = canvas.getContext('2d')
  const rand = mulberry(item.seed ^ 0x5eed)
  const S = Math.max(w, h) / 1000

  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, w, h)
  if (!item.hidden) return canvas

  const uv = item.hidden.mode === 'uv'

  if (uv) {
    // Erased or bleached writing fluoresces — it reads as handwriting.
    handwrite(ctx, item.hidden.text, w * 0.08, h * 0.34, {
      size: 44 * S,
      maxWidth: w * 0.84,
      color: [255, 255, 255],
      alpha: 0.95,
      rand,
      bleed: 0.7,
      jitter: 1.2,
    })
    // Bleach blooms where a solvent was used.
    for (let i = 0; i < 5; i++) {
      const x = rand() * w
      const y = rand() * h
      const r = Math.min(w, h) * (0.06 + rand() * 0.12)
      const g = ctx.createRadialGradient(x, y, 0, x, y, r)
      g.addColorStop(0, 'rgba(255,255,255,0.28)')
      g.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = g
      ctx.fillRect(x - r, y - r, r * 2, r * 2)
    }
  } else {
    // Infrared exposes what was under the marker, and the ridges.
    typewrite(ctx, item.hidden.text, w * 0.08, h * 0.34, {
      size: 34 * S,
      maxWidth: w * 0.82,
      color: [255, 255, 255],
      alpha: 0.92,
      rand,
    })
    for (let i = 0; i < 3; i++) {
      fingerprint(
        ctx,
        w * (0.15 + rand() * 0.7),
        h * (0.15 + rand() * 0.7),
        Math.min(w, h) * (0.07 + rand() * 0.06),
        rand() * Math.PI,
        rand,
        0.6,
        [255, 255, 255],
      )
    }
  }
  return canvas
}

// ═══════════════════════════════════════════════════════════════════════════
// Per-kind renderers
// ═══════════════════════════════════════════════════════════════════════════

function drawMargin(ctx, w, h, S, item, rand, side = 'right') {
  if (!item.margin) return
  const x = side === 'right' ? w * 0.62 : w * 0.06
  handwrite(ctx, item.margin, x, h * 0.86, {
    size: 21 * S,
    maxWidth: w * 0.34,
    color: [30, 42, 96],
    alpha: 0.78,
    rand,
    slant: -0.06,
    bleed: 0.9,
  })
}

function maybeCircle(ctx, w, h, S, item, rand, box) {
  if (!item.circled || !box) return
  circleAnnotation(ctx, box.x, box.y, box.w, box.h, rand, RED, 0.42)
}

// ── Newspaper ──────────────────────────────────────────────────────────────

function drawNewspaper(ctx, w, h, S, item, level, rand) {
  paperBase(ctx, w, h, 'newsprint', rand, 0.72)
  const pad = w * 0.055

  if (level === 0) {
    ctx.fillStyle = 'rgba(40,34,28,0.75)'
    ctx.fillRect(pad, h * 0.1, w - pad * 2, h * 0.055)
    ctx.fillStyle = 'rgba(40,34,28,0.35)'
    ctx.fillRect(pad, h * 0.2, w * 0.42, h * 0.3)
    ctx.fillRect(pad, h * 0.55, w - pad * 2, h * 0.3)
    return
  }

  // Masthead
  const src = (item.source || 'THE DAILY RECORD').toUpperCase()
  ctx.save()
  ctx.textAlign = 'center'
  setText(ctx, src, w / 2, h * 0.055, {
    size: 26 * S,
    maxWidth: w - pad * 2,
    color: INK,
    alpha: 0.8,
    font: '"Playfair Display", Georgia, serif',
    weight: 'bold',
    align: 'center',
  })
  ctx.restore()

  ctx.strokeStyle = 'rgba(40,34,28,0.55)'
  ctx.lineWidth = Math.max(1, 2 * S)
  line(ctx, pad, h * 0.072, w - pad, h * 0.072)
  ctx.lineWidth = Math.max(1, 0.9 * S)
  line(ctx, pad, h * 0.079, w - pad, h * 0.079)

  setText(ctx, item.date || '', pad, h * 0.098, {
    size: 11 * S,
    maxWidth: w * 0.5,
    color: INK,
    alpha: 0.62,
    font: 'Georgia, serif',
  })

  // Headline
  const headTop = h * 0.135
  const head = setText(ctx, item.headline || item.title, pad, headTop, {
    size: 46 * S,
    maxWidth: w - pad * 2,
    color: INK,
    alpha: 0.9,
    font: '"Playfair Display", Georgia, serif',
    weight: 'bold',
    lineHeight: 1.06,
  })

  let y = headTop + head.height + 8 * S
  if (item.dek) {
    const dek = setText(ctx, item.dek, pad, y, {
      size: 17 * S,
      maxWidth: w - pad * 2,
      color: INK,
      alpha: 0.68,
      font: 'Georgia, serif',
      weight: 'italic',
    })
    y += dek.height + 10 * S
  }

  ctx.strokeStyle = 'rgba(40,34,28,0.4)'
  ctx.lineWidth = Math.max(1, 1.2 * S)
  line(ctx, pad, y, w - pad, y)
  y += 14 * S

  // Halftone press photograph, sitting in the first two columns.
  const photoW = (w - pad * 2) * 0.56
  const photoH = photoW * 0.68
  const sample = MOTIFS[motifFor(item)](item.seed)
  ctx.fillStyle = 'rgba(226,218,196,1)'
  ctx.fillRect(pad, y, photoW, photoH)
  if (level >= 2) {
    halftone(ctx, pad, y, photoW, photoH, sample, {
      pitch: Math.max(2.2, 5 * S),
      angle: Math.PI / 4,
    })
  } else {
    paintSample(ctx, pad, y, photoW, photoH, sample, 48)
    ctx.fillStyle = 'rgba(214,205,182,0.35)'
    ctx.fillRect(pad, y, photoW, photoH)
  }
  ctx.strokeStyle = 'rgba(40,34,28,0.3)'
  ctx.lineWidth = Math.max(1, S)
  ctx.strokeRect(pad, y, photoW, photoH)

  if (level >= 2) {
    setText(ctx, `${item.title} — archive print`, pad, y + photoH + 13 * S, {
      size: 10 * S,
      maxWidth: photoW,
      color: INK,
      alpha: 0.55,
      font: 'Georgia, serif',
      weight: 'italic',
    })
  }

  // Text columns wrapping around the photo.
  const colGap = w * 0.028
  const cols = 3
  const colW = (w - pad * 2 - colGap * (cols - 1)) / cols
  const bodyTop = y
  const bodyBottom = h * 0.9
  const paras = item.body || []
  let circleBox = null

  for (let c = 0; c < cols; c++) {
    const cx = pad + c * (colW + colGap)
    // The first two columns start below the photograph.
    let cy = c < 2 ? y + photoH + 30 * S : bodyTop

    for (let p = 0; p < paras.length + 4; p++) {
      if (cy > bodyBottom) break
      const text = paras[(p + c * 2) % Math.max(1, paras.length)]
      if (level >= 2 && text) {
        const isCircled =
          item.circled && text.includes(item.circled) && !circleBox
        const res = setText(ctx, text, cx, cy, {
          size: 12.5 * S,
          maxWidth: colW,
          color: INK,
          alpha: 0.82,
          lineHeight: 1.5,
          font: 'Georgia, serif',
        })
        if (isCircled) {
          circleBox = {
            x: cx - 6 * S,
            y: cy - 14 * S,
            w: colW + 12 * S,
            h: Math.min(res.height + 8 * S, 60 * S),
          }
        }
        cy += res.height + 10 * S
      } else {
        cy += greekText(ctx, cx, cy, colW, 9, {
          size: 10 * S,
          rand,
          alpha: 0.42,
        }) + 12 * S
      }
    }
  }

  if (level >= 3) {
    maybeCircle(ctx, w, h, S, item, rand, circleBox)
    drawMargin(ctx, w, h, S, item, rand, 'right')
  }
}

// ── Letter ─────────────────────────────────────────────────────────────────

function drawLetter(ctx, w, h, S, item, level, rand) {
  paperBase(ctx, w, h, 'bond', rand, 0.55)
  const pad = w * 0.09

  if (level === 0) {
    ctx.fillStyle = 'rgba(40,40,80,0.4)'
    for (let i = 0; i < 7; i++) {
      ctx.fillRect(pad, h * (0.18 + i * 0.09), (w - pad * 2) * (0.6 + rand() * 0.4), h * 0.018)
    }
    return
  }

  // Correspondence in this archive is handwritten; the hand is the evidence.
  const headSize = 30 * S
  handwrite(ctx, item.headline || item.title, pad, h * 0.14, {
    size: headSize,
    maxWidth: w - pad * 2,
    color: [26, 30, 74],
    alpha: 0.86,
    rand,
    slant: -0.05,
    bleed: 1,
    lineHeight: 1.25,
  })

  let y = h * 0.26
  if (item.date) {
    handwrite(ctx, item.date, w - pad, y - h * 0.06, {
      size: 15 * S,
      maxWidth: w * 0.34,
      color: [26, 30, 74],
      alpha: 0.6,
      rand,
    })
  }

  let circleBox = null
  const paras = item.body || []
  for (const p of paras) {
    if (y > h * 0.84) break
    if (level >= 2) {
      const before = y
      const used = handwrite(ctx, p, pad, y, {
        size: 17 * S,
        maxWidth: w - pad * 2,
        color: [26, 30, 74],
        alpha: 0.8,
        rand,
        bleed: 0.8,
        lineHeight: 1.5,
      })
      if (item.circled && p.includes(item.circled) && !circleBox) {
        circleBox = { x: pad - 10 * S, y: before - 22 * S, w: w - pad * 2 + 20 * S, h: used + 14 * S }
      }
      y += used + 14 * S
    } else {
      y += greekText(ctx, pad, y, w - pad * 2, 4, { size: 15 * S, rand, alpha: 0.35 }) + 20 * S
    }
  }

  if (level >= 2) {
    // The crossed-circle, drawn small at the foot the way a signature sits.
    const cx = w * 0.5
    const cy = h * 0.9
    const r = Math.min(w, h) * 0.055
    ctx.save()
    ctx.strokeStyle = 'rgba(26,30,74,0.7)'
    ctx.lineWidth = Math.max(1.5, 3.5 * S)
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.moveTo(cx - r * 1.35, cy)
    ctx.lineTo(cx + r * 1.35, cy)
    ctx.moveTo(cx, cy - r * 1.35)
    ctx.lineTo(cx, cy + r * 1.35)
    ctx.stroke()
    ctx.restore()
  }

  if (level >= 3) {
    maybeCircle(ctx, w, h, S, item, rand, circleBox)
    drawMargin(ctx, w, h, S, item, rand, 'left')
  }
}

// ── Official report ────────────────────────────────────────────────────────

function drawReport(ctx, w, h, S, item, level, rand) {
  paperBase(ctx, w, h, 'onionskin', rand, 0.48)
  const pad = w * 0.085

  if (level === 0) {
    ctx.fillStyle = 'rgba(40,34,28,0.55)'
    ctx.fillRect(pad, h * 0.09, w - pad * 2, h * 0.04)
    ctx.fillStyle = 'rgba(40,34,28,0.28)'
    for (let i = 0; i < 12; i++) {
      ctx.fillRect(pad, h * (0.2 + i * 0.055), (w - pad * 2) * (0.5 + rand() * 0.5), h * 0.012)
    }
    return
  }

  // Form header
  ctx.strokeStyle = 'rgba(40,34,28,0.6)'
  ctx.lineWidth = Math.max(1, 2 * S)
  ctx.strokeRect(pad * 0.6, h * 0.045, w - pad * 1.2, h * 0.1)
  setText(ctx, item.headline || item.title, pad, h * 0.09, {
    size: 21 * S,
    maxWidth: w - pad * 2,
    color: INK,
    alpha: 0.85,
    font: '"Arial Narrow", Helvetica, sans-serif',
    weight: 'bold',
  })
  setText(ctx, `FILE ${String(item.seed % 100000).padStart(5, '0')}   ${item.date || ''}`, pad, h * 0.128, {
    size: 11 * S,
    maxWidth: w - pad * 2,
    color: INK,
    alpha: 0.55,
    font: '"Courier New", monospace',
  })

  let y = h * 0.19
  if (item.dek) {
    setText(ctx, item.dek.toUpperCase(), pad, y, {
      size: 12 * S,
      maxWidth: w - pad * 2,
      color: INK,
      alpha: 0.6,
      font: '"Arial Narrow", Helvetica, sans-serif',
    })
    y += 26 * S
  }

  let circleBox = null
  const paras = item.body || []
  for (const p of paras) {
    if (y > h * 0.82) break
    if (level >= 2) {
      const before = y
      const used = typewrite(ctx, p, pad, y, {
        size: 13 * S,
        maxWidth: w - pad * 2,
        color: INK,
        alpha: 0.82,
        rand,
        lineHeight: 1.66,
      })
      if (item.circled && p.includes(item.circled) && !circleBox) {
        circleBox = { x: pad - 8 * S, y: before - 18 * S, w: w - pad * 2 + 16 * S, h: used + 10 * S }
      }
      y += used + 18 * S
    } else {
      y += greekText(ctx, pad, y, w - pad * 2, 6, { size: 11 * S, rand, alpha: 0.4 }) + 18 * S
    }
  }

  if (level >= 2) {
    // Redactions, and the stamp that always lands crooked.
    if (rand() > 0.4) {
      redact(ctx, pad, h * (0.62 + rand() * 0.14), (w - pad * 2) * (0.3 + rand() * 0.45), 15 * S, rand)
    }
    stamp(
      ctx,
      rand() > 0.5 ? 'CONFIDENTIAL' : 'EVIDENCE',
      w * (0.36 + rand() * 0.3),
      h * (0.28 + rand() * 0.4),
      (rand() - 0.5) * 0.5,
      rand,
      { size: 32 * S, color: [150, 44, 38], alpha: 0.38 },
    )
  }

  if (level >= 3) {
    maybeCircle(ctx, w, h, S, item, rand, circleBox)
    drawMargin(ctx, w, h, S, item, rand, 'right')
  }
}

// ── Index card ─────────────────────────────────────────────────────────────

function drawNote(ctx, w, h, S, item, level, rand) {
  paperBase(ctx, w, h, 'card', rand, 0.4)

  // Ruled lines and the red margin rule.
  ctx.save()
  ctx.strokeStyle = 'rgba(90,120,150,0.28)'
  ctx.lineWidth = Math.max(1, 1.2 * S)
  for (let i = 1; i < 9; i++) {
    const y = h * (0.14 + i * 0.095)
    line(ctx, w * 0.05, y, w * 0.95, y)
  }
  ctx.strokeStyle = 'rgba(170,70,70,0.35)'
  line(ctx, w * 0.13, 0, w * 0.13, h)
  ctx.restore()

  if (level === 0) {
    ctx.fillStyle = 'rgba(30,42,96,0.45)'
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(w * 0.16, h * (0.2 + i * 0.18), w * (0.4 + rand() * 0.38), h * 0.035)
    }
    return
  }

  handwrite(ctx, item.headline || item.title, w * 0.16, h * 0.19, {
    size: 34 * S,
    maxWidth: w * 0.78,
    color: [30, 42, 96],
    alpha: 0.85,
    rand,
    bleed: 1,
  })

  if (level >= 2) {
    let y = h * 0.36
    for (const p of item.body || []) {
      if (y > h * 0.86) break
      y += handwrite(ctx, p, w * 0.16, y, {
        size: 20 * S,
        maxWidth: w * 0.78,
        color: [30, 42, 96],
        alpha: 0.74,
        rand,
        lineHeight: 1.45,
        bleed: 0.7,
      }) + 12 * S
    }
  }

  if (level >= 3 && item.margin) {
    handwrite(ctx, item.margin, w * 0.16, h * 0.93, {
      size: 17 * S,
      maxWidth: w * 0.78,
      color: [150, 44, 38],
      alpha: 0.66,
      rand,
      slant: -0.09,
    })
  }
}

// ── Map ────────────────────────────────────────────────────────────────────

function drawMap(ctx, w, h, S, item, level, rand) {
  paperBase(ctx, w, h, 'chart', rand, 0.5)

  const terrain = MOTIFS.terrain(item.seed)
  // Land tinted the flat green-grey of a survey sheet.
  paintSample(ctx, 0, 0, w, h, terrain, level === 0 ? 24 : 128, [0.86, 0.88, 0.8])
  ctx.fillStyle = 'rgba(228,222,200,0.55)'
  ctx.fillRect(0, 0, w, h)

  if (level === 0) return

  // Contours
  ctx.save()
  ctx.strokeStyle = 'rgba(120,96,60,0.35)'
  ctx.lineWidth = Math.max(0.6, 0.9 * S)
  const step = level >= 2 ? 0.035 : 0.09
  for (let lvl = 0.32; lvl < 0.95; lvl += step) {
    ctx.beginPath()
    for (let x = 0; x <= w; x += Math.max(2, 4 * S)) {
      // Walk the iso-line by scanning each column for the crossing.
      let prev = terrain(x / w, 0)
      for (let y = 1; y <= h; y += Math.max(2, 3 * S)) {
        const v = terrain(x / w, y / h)
        if ((prev - lvl) * (v - lvl) < 0) {
          ctx.moveTo(x, y)
          ctx.lineTo(x + Math.max(2, 4 * S), y)
        }
        prev = v
      }
    }
    ctx.stroke()
  }
  ctx.restore()

  // Graticule
  ctx.save()
  ctx.strokeStyle = 'rgba(70,90,120,0.22)'
  ctx.lineWidth = Math.max(0.5, 0.8 * S)
  for (let i = 1; i < 8; i++) {
    line(ctx, (w / 8) * i, 0, (w / 8) * i, h)
    line(ctx, 0, (h / 6) * i, w, (h / 6) * i)
  }
  ctx.restore()

  // Roads: random walks that avoid the low ground.
  ctx.save()
  ctx.strokeStyle = 'rgba(150,60,40,0.5)'
  ctx.lineWidth = Math.max(1, 2.2 * S)
  ctx.lineCap = 'round'
  for (let r = 0; r < 5; r++) {
    let x = rand() * w
    let y = rand() * h
    let a = rand() * Math.PI * 2
    ctx.beginPath()
    ctx.moveTo(x, y)
    for (let i = 0; i < 60; i++) {
      a += (rand() - 0.5) * 0.6
      x += Math.cos(a) * w * 0.03
      y += Math.sin(a) * h * 0.03
      if (x < 0 || x > w || y < 0 || y > h) break
      ctx.lineTo(x, y)
    }
    ctx.stroke()
  }
  ctx.restore()

  // Title block
  const bx = w * 0.03
  const by = h * 0.03
  const bw = w * 0.44
  const bh = h * 0.2
  ctx.fillStyle = 'rgba(232,227,208,0.86)'
  ctx.fillRect(bx, by, bw, bh)
  ctx.strokeStyle = 'rgba(40,34,28,0.55)'
  ctx.lineWidth = Math.max(1, 1.6 * S)
  ctx.strokeRect(bx, by, bw, bh)
  setText(ctx, item.headline || item.title, bx + 12 * S, by + 28 * S, {
    size: 19 * S,
    maxWidth: bw - 24 * S,
    color: INK,
    alpha: 0.85,
    font: '"Arial Narrow", Helvetica, sans-serif',
    weight: 'bold',
  })
  if (level >= 2 && item.dek) {
    setText(ctx, item.dek, bx + 12 * S, by + bh - 20 * S, {
      size: 11 * S,
      maxWidth: bw - 24 * S,
      color: INK,
      alpha: 0.6,
      font: 'Georgia, serif',
      weight: 'italic',
      maxLines: 2,
    })
  }

  // The crossed-circle, if this map is the one that was posted.
  if (item.tags?.includes('cipher') || item.tags?.includes('map')) {
    const cx = w * (0.58 + rand() * 0.2)
    const cy = h * (0.4 + rand() * 0.25)
    const r = Math.min(w, h) * 0.13
    ctx.save()
    ctx.strokeStyle = 'rgba(160,40,32,0.75)'
    ctx.lineWidth = Math.max(1.5, 3 * S)
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.moveTo(cx - r * 1.4, cy)
    ctx.lineTo(cx + r * 1.4, cy)
    ctx.moveTo(cx, cy - r * 1.4)
    ctx.lineTo(cx, cy + r * 1.4)
    ctx.stroke()
    ctx.restore()
  }

  if (level >= 2 && item.place) {
    // A pin, and the place name beside it.
    const px = w * 0.7
    const py = h * 0.72
    ctx.save()
    ctx.fillStyle = 'rgba(170,40,34,0.9)'
    ctx.beginPath()
    ctx.arc(px, py, Math.max(3, 6 * S), 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(60,40,30,0.7)'
    ctx.lineWidth = Math.max(1, 1.4 * S)
    ctx.stroke()
    setText(ctx, item.place.name, px + 14 * S, py + 5 * S, {
      size: 13 * S,
      maxWidth: w * 0.28,
      color: INK,
      alpha: 0.8,
      font: 'Georgia, serif',
    })
    ctx.restore()
  }

  if (level >= 3) drawMargin(ctx, w, h, S, item, rand, 'left')
}

// ── Photographic print ─────────────────────────────────────────────────────

function drawPhoto(ctx, w, h, S, item, level, rand) {
  const border = Math.min(w, h) * 0.045
  ctx.fillStyle = 'rgba(238,234,222,1)'
  ctx.fillRect(0, 0, w, h)

  const ix = border
  const iy = border
  const iw = w - border * 2
  const ih = h - border * 2 - Math.min(w, h) * 0.06

  const sample = MOTIFS[motifFor(item)](item.seed)
  paintSample(ctx, ix, iy, iw, ih, sample, level === 0 ? 20 : level === 1 ? 72 : 200, [
    1.0, 0.985, 0.94,
  ])

  if (level >= 1) {
    vignette(ctx, ix, iy, iw, ih, 0.36)
  }
  if (level >= 2) {
    filmGrain(ctx, ix, iy, iw, ih, rand, 1)
    // Emulsion crazing along the lower edge.
    ctx.save()
    ctx.strokeStyle = 'rgba(255,250,240,0.16)'
    ctx.lineWidth = Math.max(0.6, S)
    for (let i = 0; i < 18; i++) {
      const x = ix + rand() * iw
      const y = iy + ih * (0.8 + rand() * 0.2)
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x + (rand() - 0.5) * iw * 0.12, y + (rand() - 0.5) * ih * 0.06)
      ctx.stroke()
    }
    ctx.restore()
  }

  ctx.strokeStyle = 'rgba(40,34,28,0.28)'
  ctx.lineWidth = Math.max(1, S)
  ctx.strokeRect(ix, iy, iw, ih)

  // Caption strip on the white border.
  if (level >= 1) {
    setText(ctx, (item.headline || item.title).toUpperCase(), ix, h - border * 0.9, {
      size: 13 * S,
      maxWidth: iw,
      color: INK,
      alpha: 0.72,
      font: '"Arial Narrow", Helvetica, sans-serif',
      maxLines: 1,
    })
  }
  if (level >= 2 && item.dek) {
    setText(ctx, item.dek, ix, h - border * 0.2, {
      size: 10 * S,
      maxWidth: iw,
      color: INK,
      alpha: 0.5,
      font: 'Georgia, serif',
      weight: 'italic',
      maxLines: 1,
    })
  }

  if (level >= 3) {
    // Print numbers, written on the border in grease pencil.
    handwrite(ctx, `#${String(item.seed % 9999).padStart(4, '0')}`, w * 0.72, border * 0.8, {
      size: 16 * S,
      maxWidth: w * 0.25,
      color: [120, 40, 34],
      alpha: 0.6,
      rand,
    })
    if (item.margin) {
      handwrite(ctx, item.margin, ix + 8 * S, iy + ih * 0.92, {
        size: 17 * S,
        maxWidth: iw * 0.62,
        color: [235, 232, 220],
        alpha: 0.5,
        rand,
        slant: -0.07,
        bleed: 1.4,
      })
    }
  }
}

// ── Polaroid ───────────────────────────────────────────────────────────────

function drawPolaroid(ctx, w, h, S, item, level, rand) {
  const b = Math.min(w, h) * 0.055
  const bottom = Math.min(w, h) * 0.2

  ctx.fillStyle = 'rgba(246,244,236,1)'
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = 'rgba(0,0,0,0.06)'
  ctx.fillRect(0, h - bottom, w, bottom)

  const ix = b
  const iy = b
  const iw = w - b * 2
  const ih = h - b - bottom

  const sample = MOTIFS[motifFor(item)](item.seed)
  paintSample(ctx, ix, iy, iw, ih, sample, level === 0 ? 20 : level === 1 ? 64 : 180, [
    1.02, 0.96, 0.86,
  ])
  if (level >= 1) vignette(ctx, ix, iy, iw, ih, 0.42)
  if (level >= 2) filmGrain(ctx, ix, iy, iw, ih, rand, 0.7)

  if (level >= 1) {
    handwrite(ctx, item.headline || item.title, ix, h - bottom * 0.42, {
      size: 22 * S,
      maxWidth: iw,
      color: [26, 30, 74],
      alpha: 0.8,
      rand,
      bleed: 0.9,
      lineHeight: 1.2,
    })
  }
  if (level >= 3 && item.margin) {
    handwrite(ctx, item.margin, ix, h - bottom * 0.06, {
      size: 13 * S,
      maxWidth: iw,
      color: [150, 44, 38],
      alpha: 0.6,
      rand,
      maxLines: 1,
    })
  }
}

// ── Cassette ───────────────────────────────────────────────────────────────

function drawTape(ctx, w, h, S, item, level, rand) {
  // Shell
  const g = ctx.createLinearGradient(0, 0, 0, h)
  g.addColorStop(0, '#33302c')
  g.addColorStop(0.5, '#26241f')
  g.addColorStop(1, '#1a1815')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)

  // Label
  const lx = w * 0.07
  const ly = h * 0.1
  const lw = w * 0.86
  const lh = h * 0.46
  ctx.fillStyle = 'rgba(224,214,186,0.95)'
  ctx.fillRect(lx, ly, lw, lh)
  ctx.strokeStyle = 'rgba(0,0,0,0.4)'
  ctx.lineWidth = Math.max(1, S)
  ctx.strokeRect(lx, ly, lw, lh)

  if (level >= 1) {
    handwrite(ctx, item.headline || item.title, lx + 10 * S, ly + lh * 0.42, {
      size: 26 * S,
      maxWidth: lw - 20 * S,
      color: [26, 30, 74],
      alpha: 0.85,
      rand,
      bleed: 0.8,
      lineHeight: 1.2,
    })
  }
  if (level >= 2 && item.audio) {
    setText(ctx, item.audio.label, lx + 10 * S, ly + lh - 12 * S, {
      size: 12 * S,
      maxWidth: lw - 20 * S,
      color: INK,
      alpha: 0.6,
      font: '"Courier New", monospace',
      maxLines: 1,
    })
  }

  // Hubs and the window between them.
  const cy = h * 0.68
  const r = h * 0.14
  for (const cx of [w * 0.28, w * 0.72]) {
    ctx.save()
    ctx.fillStyle = '#0d0c0a'
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fill()
    // Tape wound on the hub.
    ctx.fillStyle = '#4a3a2c'
    ctx.beginPath()
    ctx.arc(cx, cy, r * (cx < w / 2 ? 0.82 : 0.5), 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#181613'
    ctx.beginPath()
    ctx.arc(cx, cy, r * 0.34, 0, Math.PI * 2)
    ctx.fill()
    if (level >= 2) {
      ctx.strokeStyle = 'rgba(200,190,170,0.5)'
      ctx.lineWidth = Math.max(1, 1.4 * S)
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2
        ctx.beginPath()
        ctx.moveTo(cx + Math.cos(a) * r * 0.34, cy + Math.sin(a) * r * 0.34)
        ctx.lineTo(cx + Math.cos(a) * r * 0.2, cy + Math.sin(a) * r * 0.2)
        ctx.stroke()
      }
    }
    ctx.restore()
  }

  if (level >= 2) {
    // Screws in the corners.
    ctx.fillStyle = 'rgba(140,140,145,0.65)'
    for (const [sx, sy] of [
      [w * 0.05, h * 0.06],
      [w * 0.95, h * 0.06],
      [w * 0.05, h * 0.94],
      [w * 0.95, h * 0.94],
    ]) {
      ctx.beginPath()
      ctx.arc(sx, sy, Math.max(2, 4 * S), 0, Math.PI * 2)
      ctx.fill()
    }
  }
  if (level >= 3 && item.margin) {
    handwrite(ctx, item.margin, lx + 10 * S, ly + lh + 18 * S, {
      size: 13 * S,
      maxWidth: lw - 20 * S,
      color: [200, 190, 170],
      alpha: 0.45,
      rand,
      maxLines: 1,
    })
  }
}

const RENDERERS = {
  newspaper: drawNewspaper,
  letter: drawLetter,
  report: drawReport,
  note: drawNote,
  map: drawMap,
  photo: drawPhoto,
  polaroid: drawPolaroid,
  tape: drawTape,
}

function line(ctx, x1, y1, x2, y2) {
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
}
