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
 * and the page never authenticates with anything.
 *
 *   ELEVENLABS_API_KEY=...  node scripts/render-narration.mjs
 *   FISH_API_KEY=...        node scripts/render-narration.mjs
 *
 * Optional:
 *   NARRATION_VOICE   provider voice id
 *   NARRATION_OUT     output directory (default public/narration)
 *
 * With no key set it exits quietly and successfully: a build without narration
 * audio is a supported configuration, and the page falls back to the browser
 * voice on its own.
 *
 * Only phrases whose text has changed are re-rendered — the manifest is keyed
 * by a hash of the line, so re-running costs nothing for lines already done.
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

if (!ELEVEN && !FISH) {
  console.log(
    'narration: no ELEVENLABS_API_KEY or FISH_API_KEY set — skipping.\n' +
      '           the site will use the browser voice instead.',
  )
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
console.log(`narration: ${lines.size} phrases, ${chars.toLocaleString()} characters`)

await mkdir(OUT, { recursive: true })

// Anything already on disk from a previous run — or restored from the CI
// cache — is left alone. This is what keeps a redeploy from re-billing the
// entire archive.
const existing = new Set(
  existsSync(OUT) ? (await readdir(OUT)).filter((f) => f.endsWith('.mp3')) : [],
)

// ── Providers ─────────────────────────────────────────────────────────────

const provider = ELEVEN
  ? {
      name: 'elevenlabs',
      // A measured, mid-range narrator by default.
      voice: process.env.NARRATION_VOICE || 'onwK4e9ZLuTAKqWW03F9',
      async render(text) {
        const res = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${this.voice}?output_format=mp3_44100_128`,
          {
            method: 'POST',
            headers: {
              'xi-api-key': ELEVEN,
              'content-type': 'application/json',
            },
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
        if (!res.ok) throw new Error(`${res.status} ${await res.text()}`)
        return Buffer.from(await res.arrayBuffer())
      },
    }
  : {
      name: 'fish',
      voice: process.env.NARRATION_VOICE || '',
      async render(text) {
        const res = await fetch('https://api.fish.audio/v1/tts', {
          method: 'POST',
          headers: {
            authorization: `Bearer ${FISH}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            text,
            format: 'mp3',
            ...(this.voice ? { reference_id: this.voice } : {}),
          }),
        })
        if (!res.ok) throw new Error(`${res.status} ${await res.text()}`)
        return Buffer.from(await res.arrayBuffer())
      },
    }

console.log(`narration: using ${provider.name}`)

// ── Render ────────────────────────────────────────────────────────────────

const clips = {}
let made = 0
let reused = 0
let failed = 0

for (const [key, text] of lines) {
  const file = `${key}.mp3`
  clips[key] = file

  if (existing.has(file)) {
    reused++
    continue
  }

  let lastErr
  // Rate limits and transient failures are normal against a hosted API;
  // three attempts with a widening gap clears almost all of them.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const buf = await provider.render(text)
      await writeFile(resolve(OUT, file), buf)
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
    delete clips[key]
    console.warn(`narration: failed "${text.slice(0, 48)}…" — ${lastErr.message}`)
    // A provider that is refusing every request should stop the run rather
    // than burn through the whole archive collecting the same error.
    if (failed > 8 && made === 0) {
      console.error('narration: provider is failing consistently — giving up.')
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

// A partial manifest is still useful — the page falls back per phrase, not
// per tour — so this is only a hard failure if nothing at all came out.
if (!Object.keys(clips).length) process.exit(1)
