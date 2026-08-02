import * as THREE from 'three'
import { makeCanvas, mulberry } from './canvas2d.js'

/** Cork: a warm base, thousands of granules, and a few darker voids. */
export function makeCorkTexture(size = 1024) {
  const c = makeCanvas(size, size)
  const ctx = c.getContext('2d')
  const rand = mulberry(0xc0c0)

  const g = ctx.createLinearGradient(0, 0, size, size)
  g.addColorStop(0, '#a87a4a')
  g.addColorStop(0.5, '#96683c')
  g.addColorStop(1, '#8a5f36')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)

  // Granules.
  for (let i = 0; i < size * 34; i++) {
    const x = rand() * size
    const y = rand() * size
    const r = 0.6 + rand() * 3.4
    const v = rand()
    ctx.fillStyle =
      v > 0.72
        ? `rgba(196,158,108,${0.1 + rand() * 0.22})`
        : v > 0.3
          ? `rgba(120,82,44,${0.08 + rand() * 0.2})`
          : `rgba(64,42,22,${0.1 + rand() * 0.28})`
    ctx.beginPath()
    ctx.ellipse(x, y, r, r * (0.5 + rand()), rand() * 3.14, 0, 6.283)
    ctx.fill()
  }

  // Old pin holes, from boards that came before this one.
  for (let i = 0; i < 420; i++) {
    const x = rand() * size
    const y = rand() * size
    const r = 1 + rand() * 2.4
    ctx.fillStyle = `rgba(38,24,12,${0.3 + rand() * 0.4})`
    ctx.beginPath()
    ctx.arc(x, y, r, 0, 6.283)
    ctx.fill()
    ctx.fillStyle = `rgba(210,178,130,${0.12})`
    ctx.beginPath()
    ctx.arc(x - r * 0.4, y - r * 0.4, r * 0.7, 0, 6.283)
    ctx.fill()
  }

  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(4, 3)
  tex.anisotropy = 8
  return tex
}

/** Matching bump map so the lamp finds the cork's texture at grazing angles. */
export function makeCorkBump(size = 512) {
  const c = makeCanvas(size, size)
  const ctx = c.getContext('2d')
  const rand = mulberry(0xb00b)
  ctx.fillStyle = '#808080'
  ctx.fillRect(0, 0, size, size)
  for (let i = 0; i < size * 26; i++) {
    const x = rand() * size
    const y = rand() * size
    const r = 0.6 + rand() * 3
    const v = rand() > 0.5 ? 255 : 0
    ctx.fillStyle = `rgba(${v},${v},${v},${0.05 + rand() * 0.18})`
    ctx.beginPath()
    ctx.arc(x, y, r, 0, 6.283)
    ctx.fill()
  }
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(4, 3)
  return tex
}

/** Bare concrete for the warehouse floor, far below everything. */
export function makeConcreteTexture(size = 512) {
  const c = makeCanvas(size, size)
  const ctx = c.getContext('2d')
  const rand = mulberry(0xfa11)
  ctx.fillStyle = '#191817'
  ctx.fillRect(0, 0, size, size)
  for (let i = 0; i < size * 16; i++) {
    const x = rand() * size
    const y = rand() * size
    const a = rand() * 0.06
    ctx.fillStyle = rand() > 0.5 ? `rgba(90,88,84,${a})` : `rgba(8,8,8,${a})`
    ctx.beginPath()
    ctx.arc(x, y, 0.5 + rand() * 3.5, 0, 6.283)
    ctx.fill()
  }
  // Expansion joints.
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'
  ctx.lineWidth = 2
  for (let i = 1; i < 4; i++) {
    ctx.beginPath()
    ctx.moveTo((size / 4) * i, 0)
    ctx.lineTo((size / 4) * i, size)
    ctx.moveTo(0, (size / 4) * i)
    ctx.lineTo(size, (size / 4) * i)
    ctx.stroke()
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(40, 40)
  return tex
}

/** The frame the corkboard is set into. */
export function makeWoodTexture(size = 512) {
  const c = makeCanvas(size, size)
  const ctx = c.getContext('2d')
  const rand = mulberry(0x0a2e)
  ctx.fillStyle = '#3a2a1c'
  ctx.fillRect(0, 0, size, size)
  for (let i = 0; i < 260; i++) {
    const y = rand() * size
    ctx.strokeStyle = `rgba(${20 + rand() * 60},${14 + rand() * 40},${8 + rand() * 24},${0.2 + rand() * 0.4})`
    ctx.lineWidth = 0.5 + rand() * 3
    ctx.beginPath()
    ctx.moveTo(0, y)
    for (let x = 0; x < size; x += 16) {
      ctx.lineTo(x, y + Math.sin(x * 0.02 + i) * 3 + (rand() - 0.5) * 2)
    }
    ctx.stroke()
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  return tex
}
