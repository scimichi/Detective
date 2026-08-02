import zodiac from './cases/zodiac.js'
import cooper from './cases/cooper.js'
import mh370 from './cases/mh370.js'
import titanic from './cases/titanic.js'
import dyatlov from './cases/dyatlov.js'
import ripper from './cases/ripper.js'
import { layoutBoard } from './layout.js'
import { hashString } from './util.js'

const RAW = [zodiac, cooper, mh370, titanic, dyatlov, ripper]

/**
 * Boards are laid out once, at module scope. Positions must not depend on the
 * year slider or the filter state — evidence fades, it does not move.
 */
export const CASE_LIST = RAW.map((c, i) => {
  const evidence = layoutBoard(c.evidence, c.id)
  const byId = new Map(evidence.map((e) => [e.id, e]))

  return {
    ...c,
    index: i,
    seed: hashString(c.id),
    evidence,
    byId,
    // Where each board hangs in the warehouse, once you pull far enough back.
    slot: [
      (i % 3) * 52 - 52,
      Math.floor(i / 3) * 30 - 15,
      -Math.floor(i / 3) * 8,
    ],
    counts: evidence.reduce((acc, e) => {
      acc[e.kind] = (acc[e.kind] || 0) + 1
      return acc
    }, {}),
  }
})

export const CASES = Object.fromEntries(CASE_LIST.map((c) => [c.id, c]))

/** Flat index for full-text search across the entire archive. */
export const SEARCH_INDEX = CASE_LIST.flatMap((c) =>
  c.evidence.map((e) => ({
    caseId: c.id,
    caseTitle: c.title,
    id: e.id,
    kind: e.kind,
    title: e.title,
    date: e.date,
    haystack: [
      e.title,
      e.headline,
      e.dek,
      e.date,
      e.source,
      ...(e.body || []),
      e.margin,
      e.circled,
      e.detail,
      e.hidden?.text,
      e.audio?.transcript,
      ...(e.tags || []),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase(),
  })),
)

export function search(query, limit = 24) {
  const q = query.trim().toLowerCase()
  if (q.length < 2) return []
  const terms = q.split(/\s+/).filter(Boolean)
  const out = []
  for (const row of SEARCH_INDEX) {
    let score = 0
    for (const term of terms) {
      const idx = row.haystack.indexOf(term)
      if (idx === -1) {
        score = -1
        break
      }
      score += 1 + Math.max(0, 1 - idx / 400)
      if (row.title.toLowerCase().includes(term)) score += 2.5
    }
    if (score > 0) out.push({ ...row, score })
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit)
}
