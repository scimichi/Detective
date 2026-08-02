// Shared world-space constants. Everything in this project lives in one
// coordinate system — there are no pages, so "navigation" is only ever a
// camera position.

export const BOARD = {
  width: 30,
  height: 17,
  // The corkboard surface sits at z = 0. Evidence hangs a few millimetres
  // in front of it so the lamp can throw real shadows onto the cork.
  z: 0,
  paperZ: 0.06,
  pinZ: 0.16,
  stringZ: 0.34,
}

// Camera distances that drive level-of-detail, asset streaming and mode
// transitions. Distance is measured from the board plane.
export const DIST = {
  handwriting: 1.15, // ink bleed, fibres, fold marks
  full: 3.2, // full-resolution scan
  medium: 9.0, // 512px
  far: 26.0, // 64px thumbnails
  boardExit: 58.0, // board starts to recede, warehouse fades up
  warehouse: 170.0, // thousands of other boards
}

export const CAMERA = {
  near: 0.05,
  far: 4000,
  fov: 42,
  minZ: 0.55, // you can press your nose against the paper, but not through it
  maxZ: 380,
  startZ: 24,
}

export const LOD = {
  sizes: [64, 512, 1536, 3072],
  // Only a handful of top-detail scans may be resident at once; the rest are
  // evicted least-recently-used. This is the whole "streaming" budget.
  residentDetail: 2,
  residentFull: 10,
}

export const KINDS = [
  'photo',
  'newspaper',
  'letter',
  'report',
  'map',
  'note',
  'tape',
  'polaroid',
]

export const KIND_LABEL = {
  photo: 'Photograph',
  newspaper: 'Press',
  letter: 'Correspondence',
  report: 'Official report',
  map: 'Cartography',
  note: 'Investigator note',
  tape: 'Audio',
  polaroid: 'Polaroid',
}

// Physical size of each evidence type, in world units (1 unit ≈ 10 cm).
export const KIND_SIZE = {
  photo: [1.55, 1.95],
  polaroid: [1.5, 1.8],
  newspaper: [3.1, 4.1],
  letter: [2.15, 2.85],
  report: [2.2, 2.9],
  map: [3.6, 2.7],
  note: [1.35, 1.05],
  tape: [1.25, 0.8],
}

/**
 * `maxLod` is the important one. A top-tier scan is several million pixels of
 * synchronous procedural drawing — perfectly affordable on a machine that can
 * already render the board, and a multi-second freeze on one that can't. A
 * renderer that is struggling should not be spending its budget building a
 * resolution it will never display smoothly, so the lowest tier simply stops
 * one level short.
 */
export const QUALITY_TIERS = {
  low: { dust: 24000, shadowMap: 1024, ssao: false, dof: false, godRays: 0.55, maxLod: 2 },
  medium: { dust: 90000, shadowMap: 2048, ssao: false, dof: true, godRays: 0.8, maxLod: 3 },
  high: { dust: 240000, shadowMap: 4096, ssao: true, dof: true, godRays: 1.0, maxLod: 3 },
}
