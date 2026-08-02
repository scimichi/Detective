/**
 * A stable identifier for one spoken phrase.
 *
 * Shared by the browser and by the build-time narration renderer, so a line
 * rendered to audio on a CI runner is found again by the page at runtime.
 * Keying on the text itself — rather than on a case id and beat index — means
 * reordering the tour costs nothing, and two beats that happen to say the
 * same sentence share a single clip.
 */
export function phraseKey(text) {
  const s = String(text)
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()

  // FNV-1a, twice over with different offsets, for a 64-bit-ish hex key.
  let h1 = 0x811c9dc5
  let h2 = 0x01000193
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0
    h2 = Math.imul(h2 + c, 0x85ebca6b) >>> 0
  }
  return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0')
}
