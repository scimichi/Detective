import * as THREE from 'three'
import {
  makeCanvas,
  mulberry,
  paperBase,
  foxing,
  distressEdges,
  setText,
  handwrite,
  stamp,
  paintSample,
  filmGrain,
  vignette,
  MOTIFS,
} from './canvas2d.js'

/**
 * The card you see before you commit to a case. A file cover: photograph,
 * title, status, and a stamp — enough to be a promise, not enough to be an
 * answer.
 */
const COVER_MOTIF = {
  zodiac: 'face',
  cooper: 'object',
  mh370: 'terrain',
  titanic: 'object',
  dyatlov: 'night',
  ripper: 'night',
}

function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

export function renderCaseCard(data, w = 768, h = 1024) {
  const c = makeCanvas(w, h)
  const ctx = c.getContext('2d')
  const rand = mulberry(data.seed)
  const S = h / 1000

  paperBase(ctx, w, h, 'card', rand, 0.55)

  // Photograph, top two thirds.
  const px = w * 0.07
  const py = h * 0.07
  const pw = w * 0.86
  const ph = h * 0.42
  const sample = MOTIFS[COVER_MOTIF[data.id] || 'night'](data.seed)
  // Duotone toward the case colour, so the six covers are distinguishable
  // from across the field before any of the type is legible.
  const acc = hexToRgb(data.accent)
  const tint = [
    1.05 + acc[0] * 0.5,
    1.02 + acc[1] * 0.5,
    0.96 + acc[2] * 0.5,
  ]
  paintSample(ctx, px, py, pw, ph, sample, 160, tint)
  vignette(ctx, px, py, pw, ph, 0.42)
  filmGrain(ctx, px, py, pw, ph, rand, 0.8)
  ctx.strokeStyle = 'rgba(30,26,22,0.45)'
  ctx.lineWidth = Math.max(1, 2 * S)
  ctx.strokeRect(px, py, pw, ph)

  // Accent rule in the case colour.
  ctx.fillStyle = data.accent
  ctx.globalAlpha = 0.9
  ctx.fillRect(px, py + ph + 14 * S, pw, 5 * S)
  ctx.globalAlpha = 1

  let y = py + ph + 58 * S
  const title = setText(ctx, data.title.toUpperCase(), px, y, {
    size: 44 * S,
    maxWidth: pw,
    color: [30, 26, 22],
    alpha: 0.92,
    font: '"Playfair Display", Georgia, serif',
    weight: 'bold',
    lineHeight: 1.06,
  })
  y += title.height + 10 * S

  const sub = setText(ctx, data.subtitle, px, y, {
    size: 17 * S,
    maxWidth: pw,
    color: [30, 26, 22],
    alpha: 0.6,
    font: 'Georgia, serif',
    weight: 'italic',
  })
  y += sub.height + 26 * S

  ctx.strokeStyle = 'rgba(30,26,22,0.28)'
  ctx.lineWidth = Math.max(1, 1.4 * S)
  ctx.beginPath()
  ctx.moveTo(px, y)
  ctx.lineTo(px + pw, y)
  ctx.stroke()
  y += 34 * S

  handwrite(ctx, data.tagline, px, y, {
    size: 25 * S,
    maxWidth: pw,
    color: [26, 30, 74],
    alpha: 0.82,
    rand,
    bleed: 0.9,
    lineHeight: 1.34,
  })

  setText(ctx, data.status, px, h - 40 * S, {
    size: 13 * S,
    maxWidth: pw,
    color: [30, 26, 22],
    alpha: 0.5,
    font: '"Courier New", monospace',
    maxLines: 2,
  })

  stamp(
    ctx,
    data.status.toLowerCase().startsWith('closed') ? 'CLOSED' : 'OPEN',
    w * 0.74,
    h * 0.53,
    -0.28,
    rand,
    { size: 40 * S, color: [150, 44, 38], alpha: 0.42 },
  )

  foxing(ctx, w, h, rand, 24)
  distressEdges(ctx, w, h, rand, 0.7)

  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}
