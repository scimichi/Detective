#!/usr/bin/env node
/**
 * Collapses the artifact build into one self-contained HTML file.
 *
 * Usage: node scripts/build-single.mjs [outfile]
 *   (run `vite build --config vite.artifact.config.js` first)
 *
 * The output has no external references of any kind — no stylesheet, no
 * script src, no font URL, no image — so it will run from a file:// path or
 * behind a content-security policy that blocks every other host.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dist = resolve(root, 'dist-single')
const out = resolve(process.cwd(), process.argv[2] || 'detective-board.html')

for (const f of ['app.js', 'app.css']) {
  if (!existsSync(resolve(dist, f))) {
    console.error(
      `missing ${f} — run: npx vite build --config vite.artifact.config.js`,
    )
    process.exit(1)
  }
}

const css = readFileSync(resolve(dist, 'app.css'), 'utf8')
// A minified bundle can legally contain the characters "</script>" inside a
// string literal, which would end the tag early. Break the sequence; the
// escape is invisible to the JS parser.
const js = readFileSync(resolve(dist, 'app.js'), 'utf8').replaceAll(
  '</script',
  '<\\/script',
)

const html = `<title>The Detective Board</title>
<meta name="description" content="Every mystery has a thousand threads. Six unsolved cases rendered as one continuous WebGL scene." />
<style>
${css}
</style>
<div id="root"></div>
<noscript>The Detective Board requires JavaScript and WebGL.</noscript>
<script type="module">
${js}
</script>
`

writeFileSync(out, html)
const mb = (Buffer.byteLength(html) / 1048576).toFixed(2)
console.log(`wrote ${out} (${mb} MB)`)
