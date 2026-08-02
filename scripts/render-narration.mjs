#!/usr/bin/env node
/**
 * Renders every spoken phrase in the archive to an audio file.
 *
 * Why this exists: the browser's own speech synthesis is free and always
 * available, and on most machines it sounds like a machine. A real
 * text-to-speech voice sounds like a person — but calling one from the page
 * would mean shipping an API key to every visitor, which is not a key you
 * have any more.
 *
 * So the narration is rendered here instead, at build time, on a machine that
 * is allowed to hold the key. The site ships plain audio files and a manifest,
 * and the page authenticates with nothing.
 *
 *   node scripts/render-narration.mjs            render the whole archive
 *   node scripts/render-narration.mjs --test     render one line and stop
 *   node scripts/render-narration.mjs --voices   list the voices on the key
 *
 * Environment:
 *   FISH_API_KEY | ELEVENLABS_API_KEY   whichever provider you have
 *   NARRATION_VOICE                     provider voice / reference id
 *   FISH_MODEL                          Fish backend model (default s1)
 *   NARRATION_OUT                       output dir (default public/narration)
 *
 * With no key set it exits quietly and successfully: a build without narration
 * audio is a supported configuration, and the page falls back to the browser
 * voice on its own.
 */
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { phraseKey } from '../src/audio/phraseKey.js'
import { ARCHIVE_TOUR, TOURS } from '../src/data/tours.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = resolve(root, process.env.NARRATION_OUT || 'public/narration')

const ELEVEN = process.env.ELEVENLABS_API_KEY
const FISH = process.env.FISH_API_KEY
const TEST = process.argv.includes('--test')
const LIST = process.argv.includes('--voices')

if (!ELEVEN && !FISH) {
  console.log(
    'narration: no FISH_API_KEY or ELEVENLABS_API_KEY set — skipping.\n' +
      '           the site will use the browser voice instead.',
  )
  process.exit(0)
}

// ── Providers ─────────────────────────────────────────────────────────────

const fish = {
  name: 'fish',
  voice: process.env.NARRATION_VOICE || '',
  model: process.env.FISH_MODEL || 's1',
  async render(text) {
    const res = await fetch('https://api.fish.audio/v1/tts', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${FISH}`,
        'content-type': 'application/json',
        // Selects the synthesis backend. The voice itself is reference_id.
        model: this.model,
      },
      body: JSON.stringify({
        text,
        format: 'mp3',
        mp3_bitrate: 128,
        normalize: true,
        latency: 'normal',
        ...(this.voice ? { reference_id: this.voice } : {}),
      }),
    })
    if (!res.ok) throw new Error(await describe(res))
    return Buffer.from(await res.arrayBuffer())
  },
  async voices(query) {
    const url = new URL('https://api.fish.audio/model')
    url.searchParams.set('page_size', '30')
    url.searchParams.set('page_number', '1')
    if (query) url.searchParams.set('title', query)
    const res = await fetch(url, {
      headers: { authorization: `Bearer ${FISH}` },
    })
    if (!res.ok) throw new Error(await describe(res))
    const data = await res.json()
    return (data.items || data.data || []).map((m) => ({
      id: m._id || m.id,
      title: m.title || m.name,
      languages: (m.languages || []).join(','),
    }))
  },
}

const eleven = {
  name: 'elevenlabs',
  voice: process.env.NARRATION_VOICE || 'onwK4e9ZLuTAKqWW03F9',
  async render(text) {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${this.voice}?output_format=mp3_44100_128`,
      {
        method: 'POST',
        headers: { 'xi-api-key': ELEVEN, 'content-type': 'application/json' },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.45,
            similarity_boost: 0.75,
            style: 0.35,
            use_speaker_boost: true,
          },
        }),
      },
    )
    if (!res.ok) throw new Error(await describe(res))
    return Buffer.from(await res.arrayBuffer())
  },
  async voices(_query) {
    const res = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: { 'xi-api-key': ELEVEN },
    })
    if (!res.ok) throw new Error(await describe(res))
    const data = await res.json()
    return (data.voices || []).map((v) => ({
      id: v.voice_id,
      title: v.name,
      languages: v.labels?.accent || '',
    }))
  },
}

const provider = FISH ? fish : eleven

/** Turns a failed response into something a CI log can be debugged from. */
async function describe(res) {
  let body = ''
  try {
    body = (await res.text()).slice(0, 400)
  } catch {
    body = '<unreadable>'
  }
  return `HTTP ${res.status} ${res.statusText} — ${body}`
}

/**
 * An API that answers 200 with a JSON error would otherwise leave 341 files
 * full of the word "error" on disk, and the failure would only show up as
 * silence in a browser. Check that what came back is actually audio.
 */
function looksLikeAudio(buf) {
  if (!buf || buf.length < 512) return false
  // ID3 tag, or an MPEG frame sync.
  if (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) return true
  if (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) return true
  // Some providers return WAV even when asked for mp3; that still plays.
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF') return true
  return false
}

// ── Modes that don't render the whole archive ─────────────────────────────

if (LIST) {
  // `npm run narration:voices -- narrator` searches instead of listing the
  // most popular models, which are mostly game characters.
  const query = process.argv.slice(2).find((a) => !a.startsWith('--')) || ''
  console.log(
    `narration: ${provider.name} voices${query ? ` matching "${query}"` : ''}\n`,
  )
  const list = await provider.voices(query)
  if (!list.length) console.log('  (none returned)')
  for (const v of list) {
    console.log(`  ${v.id}  ${v.title}${v.languages ? `  [${v.languages}]` : ''}`)
  }
  console.log('\nSet NARRATION_VOICE to one of the ids above.')
  process.exit(0)
}

// ── Collect every phrase, exactly as the runtime will split it ─────────────

/** Mirrors Narrator#phrase, so keys line up with what the page looks for. */
function phrases(script) {
  const out = []
  for (const raw of String(script).split(/(\|\|\||\|\|)/)) {
    if (raw === '||' || raw === '|||') continue
    for (const s of raw.split(/(?<=[.!?])\s+/)) {
      const t = s.replace(/~/g, '').trim()
      if (t) out.push(t)
    }
  }
  return out
}

const lines = new Map() // key → text
for (const beats of [ARCHIVE_TOUR, ...Object.values(TOURS)]) {
  for (const beat of beats) {
    for (const text of phrases(beat.say)) lines.set(phraseKey(text), text)
  }
}

const chars = [...lines.values()].reduce((n, t) => n + t.length, 0)
console.log(
  `narration: provider=${provider.name} voice=${provider.voice || '(default)'}` +
    `${provider.model ? ` model=${provider.model}` : ''}`,
)
console.log(`narration: ${lines.size} phrases, ${chars.toLocaleString()} characters`)

await mkdir(OUT, { recursive: true })

// A single line first, to prove the credentials and the request shape before
// spending the whole archive against them.
if (TEST) {
  const [key, text] = [...lines][0]
  console.log(`narration: test render — "${text}"`)
  const buf = await provider.render(text)
  console.log(`narration: ${buf.length} bytes, audio=${looksLikeAudio(buf)}`)
  console.log(`narration: first bytes ${buf.subarray(0, 8).toString('hex')}`)
  if (!looksLikeAudio(buf)) {
    console.error('narration: that is not audio. Body follows:')
    console.error(buf.subarray(0, 400).toString('utf8'))
    process.exit(1)
  }
  await writeFile(resolve(OUT, `${key}.mp3`), buf)
  console.log(`narration: wrote ${key}.mp3 — looks good.`)
  process.exit(0)
}

// Anything already on disk from a previous run — or restored from the CI
// cache — is left alone. This is what keeps a redeploy from re-billing the
// entire archive.
//
// Except when the voice has changed. A clip's filename is a hash of the words
// in it, because that is the identity the browser looks it up by — which means
// the same sentence read by a different narrator lands on the same filename.
// Left alone, that would make a voice change appear to succeed and silently
// serve the old voice forever. So the manifest records which voice its files
// were made with, and a mismatch invalidates the lot.
const stamp = `${provider.name}:${provider.voice || '(default)'}`
let previous = null
try {
  previous = JSON.parse(await readFile(resolve(OUT, 'manifest.json'), 'utf8'))
} catch {
  /* first run, or nothing cached */
}
const priorStamp = previous
  ? `${previous.provider}:${previous.voice || '(default)'}`
  : null
const reusable = !priorStamp || priorStamp === stamp

if (!reusable) {
  console.log(
    `narration: voice changed (${priorStamp} → ${stamp}) — re-rendering everything.`,
  )
}

const existing = new Set(
  reusable && existsSync(OUT)
    ? (await readdir(OUT)).filter((f) => f.endsWith('.mp3'))
    : [],
)

// ── Render ────────────────────────────────────────────────────────────────

const clips = {}
let made = 0
let reused = 0
let failed = 0

for (const [key, text] of lines) {
  const file = `${key}.mp3`

  if (existing.has(file)) {
    clips[key] = file
    reused++
    continue
  }

  let lastErr
  // Rate limits and transient failures are normal against a hosted API;
  // three attempts with a widening gap clears almost all of them.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const buf = await provider.render(text)
      if (!looksLikeAudio(buf)) {
        throw new Error(
          `response was not audio (${buf.length} bytes): ` +
            buf.subarray(0, 160).toString('utf8'),
        )
      }
      await writeFile(resolve(OUT, file), buf)
      clips[key] = file
      made++
      lastErr = null
      break
    } catch (err) {
      lastErr = err
      await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)))
    }
  }

  if (lastErr) {
    failed++
    console.warn(`narration: failed "${text.slice(0, 44)}…"\n           ${lastErr.message}`)
    // A provider that is refusing every request should stop the run rather
    // than burn through the whole archive collecting the same error.
    if (failed >= 3 && made === 0) {
      console.error(
        '\nnarration: the first three requests all failed and none succeeded.\n' +
          '           stopping rather than repeating this 338 more times.\n' +
          '           run with --test for a single verbose attempt.',
      )
      break
    }
  }
}

const manifest = {
  provider: provider.name,
  voice: provider.voice,
  generated: new Date().toISOString(),
  clips,
}
await writeFile(resolve(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2))

console.log(
  `narration: ${made} rendered, ${reused} reused, ${failed} failed, ` +
    `${Object.keys(clips).length} in manifest`,
)

// Deliberately always successful.
//
// Recorded narration is an enhancement on top of a site that already works:
// every phrase without a clip falls back to the browser's voice by itself. A
// provider outage, an expired card or an exhausted quota must not be able to
// stop the board from deploying — it should cost the recorded voice and
// nothing else.
if (!Object.keys(clips).length) {
  console.warn(
    '\nnarration: nothing was rendered — the site will ship with the browser\n' +
      '           voice instead. This is not a build failure.',
  )
}
