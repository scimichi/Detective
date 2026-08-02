# The Detective Board

> Every mystery has a thousand threads.

An archive of unsolved cases rendered as a single continuous WebGL scene. There
are no pages. The homepage is a dark room with one sentence in it; everything
after that is a camera position in the same room.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build && npm run preview
```

**Live:** https://scimichi.github.io/Detective/ — published by
`.github/workflows/deploy.yml` on every push. A project page is served from
`/<repo>/`, so the build's base path is read from the repository name at build
time rather than hard-coded; renaming or forking the repo needs no edit. The workflow
switches Pages on itself the first time it runs, so there is nothing to
configure by hand.

There is also a single-file build for anywhere that can only serve one
document:

```bash
npx vite build --config vite.artifact.config.js
node scripts/build-single.mjs detective-board.html
```

The result has no external references of any kind, so it runs from a `file://`
path or behind a policy that blocks every other host.

Six cases ship with the archive: the Zodiac, D. B. Cooper, MH370, Titanic,
Dyatlov Pass, and Whitechapel 1888.

---

## Two ways in

The homepage offers a choice, because the hardest problem with a room like
this is not knowing where to stand in it.

**Take me through it** hands the whole instrument to a narrator. It flies the
camera between exhibits, scrubs the year, lifts the board into a relationship
graph, switches on an ultraviolet lamp and sweeps the beam across the page for
you. Roughly twelve minutes a case. Pause at any point and you have the
controls; move the mouse yourself and it pauses automatically rather than
fighting you for the camera.

**Let me look around** is the unguided version, with one difference from
before: on arrival it names a specific document worth opening first, and gets
out of the way as soon as you move.

You can switch between them at any time — `▶ Talk me through this case` sits at
the top of the tool rail.

### About the voice

There is no network and there are no audio assets, so the only speech
available is whatever the machine already has installed. That is a real
constraint and the tour is built around it:

- **Voices are ranked, not defaulted.** Modern platforms ship neural voices
  alongside the old formant ones, and the good ones are never first in the
  list. `src/audio/narrator.js` scores them — Microsoft's *Natural* family,
  Apple's *Premium* and *Siri* voices, the known-good platform names — and
  drops eSpeak and the novelty voices to the bottom. **Voice** in the
  transport opens the picker; click any entry to audition it.
- **Phrasing, not paragraphs.** A block of text handed to a synthesiser comes
  back flat, and Chrome truncates it after about fifteen seconds. Scripts are
  spoken one clause at a time with a real breath between them.
- **Direction.** The scripts carry performance marks — `||` for a beat, `|||`
  before a reveal, `~…~` to slow a clause down — so the delivery has shape.
- **Written for the ear.** The narration is a different text from anything
  printed on the board: short clauses, no parentheses, and numbers written the
  way a person says them out loud.

If the browser has no speech synthesis, or you'd rather read, the same scripts
play as timed captions — the transport has a **Captions only** toggle.

## The idea

A conspiracy board only works if you can lean into it. Most 3D websites give
you a scene you orbit around; this one gives you a room you move through, and
the reward for moving is that things get more detailed rather than just bigger.

Scroll does not zoom. It moves the camera. There is no field-of-view change
anywhere in the project, which is why parallax between overlapping documents
behaves correctly, and why the desk lamp's shadows slide across a sheet the way
they should as you close in on it.

What you can do:

| | |
|---|---|
| **Scroll** | Move. One notch is about a tenth of your current standoff, so the trip from the far wall to the paper fibres is a real journey. |
| **Drag** | Pan across the cork. In relationship mode, rotate the graph. |
| **Click** | Frame a document. Click again to go all the way in. |
| **Space** | Lift everything off the board into a 3D relationship graph. |
| **T** | The chronology. Every event opens into smaller events, without limit. |
| **U** / **I** | Ultraviolet and infrared. The room goes dark and you sweep a beam. |
| **/** | Full-text search across every board. |
| **Esc** | Back out one layer at a time. Ends a tour. |
| **Space** *(during a tour)* | Pause and resume. |

Deep links: `?case=zodiac` opens straight onto a board, `?q=low|medium|high`
pins the quality tier.

---

## How it works

### There are no image assets

Not one. Every newspaper, letter, police report, map, photograph, index card
and cassette in the archive is drawn on a `<canvas>` at the resolution the
camera currently needs, from a per-item seed. The coffee ring on a particular
report is in the same place forever because the PRNG is deterministic.

`src/gfx/canvas2d.js` holds the primitives — aged paper stock, fibres, foxing,
coffee rings, latent fingerprints, fold marks, distressed edges, halftone
screens, procedural handwriting, typewriter strike variation, the elliptical
scrawl someone drew around a sentence. `src/gfx/generators.js` composes them
into the eight kinds of exhibit.

This is what makes unbounded zoom affordable. A "full-resolution scan" does not
exist until you lean in far enough to deserve it.

### Streaming and level of detail

`src/gfx/lod.js` is the streamer. Four tiers, generated on demand in idle time,
one job per slice so a 3072px canvas never stalls a frame:

| Distance | Tier | What you see |
|---|---|---|
| > 9 m | 64 px | A colour, a mass, an orientation. It reads as paper. |
| 3.2 – 9 m | 512 px | Masthead, headline, the shape of the article. |
| 1.15 – 3.2 m | 1536 px | Every word of the body copy. Stamps. Redactions. Foxing. Folds. |
| < 1.15 m | 3072 px | Paper fibres, ink bleed, the coffee ring, a latent fingerprint, the margin note in blue ballpoint, the sentence someone circled in faded red, and the archivist's pencil along the bottom edge. |

Each tier is a superset of the last, so the swap reads as focus pulling in
rather than content appearing from nowhere. Detail tiers are evicted
least-recently-used against a fixed budget — without that, walking along a
board climbs to a gigabyte of VRAM.

The `STREAMING n` readout at the bottom of the screen is the real queue depth.

### The strings are simulated

`src/scene/Strings.jsx`. Verlet points, distance constraints on a fixed 1/60
step, and a uniform spatial hash so strings can collide *with each other*.
Nudge one thread and the disturbance travels outward through everything pinned
to it, because the collision response is an actual exchange of momentum rather
than a scripted wobble. Moving the camera quickly displaces air, and heavy
points lag behind light ones.

Each string's excitement drives its own emissive term, so you can watch a
vibration cross the web. They cast real shadows onto the paper below them.

### One light

A practical lamp on a flex, swinging on two axes. Everything on the board is
lit by it, so every shadow moves: string shadows sweep across documents, the
corners of overlapping paper crawl, and the board is never twice the same.

Two things stop it being unusable. A **hand light** rides with the camera at an
intensity proportional to the square of your standoff, which holds the
irradiance on whatever you are reading roughly constant from across the room
down to the fibres. And an **iris** in `Rig.jsx` stops the exposure down as you
close in, the way an eye does when it moves into a bright pool.

Turn on a lens and both go to almost nothing — you inspect a document under
ultraviolet in the dark, not under a desk lamp.

### Dust

`src/scene/Dust.jsx`. Positions are computed entirely in the vertex shader from
a seed and the clock; the CPU never touches a particle. The field wraps in
shader space around the camera, so there is no edge to the dust anywhere in the
building. Motes are only *lit* inside the lamp's cone — outside it they are
still there, still moving, and invisible.

Count is a quality dial (24k / 90k / 240k), not a design decision, precisely
because nothing about it is on the CPU.

### The hidden layer

`src/gfx/evidenceMaterial.js` patches `MeshStandardMaterial` through
`onBeforeCompile` — the sheets have to stay lit and shadow-receiving, or the
lamp stops meaning anything. Two additions: a world-space position varying, so
the lens beam is a real volume in the room rather than a screen-space circle,
and a hidden texture blended additively inside it. The beam lands where the
pointer ray meets the board plane.

The same patch does the ageing: dragging the year slider back bleaches and
flattens the print, because early in a case you are looking at a document that
is still being handled rather than a restored scan.

### Relationship mode

Press Space and the board lifts. A force-directed layout runs to convergence
once per (case, year) and is cached, because a graph that reshuffles while you
are looking at it is unreadable. Cards counter-rotate against the group so they
always face you; the links become glowing curves driven by the same verlet
solver, with gravity turned down.

### The warehouse

Keep pulling back. Past about 60 metres the other boards fade up — one
instanced draw, thousands of them, all motion and fading in the vertex shader,
never resolvable. Every one is a case you are not looking at.

### Sound

`src/audio/soundscape.js`. No audio files either. Rain is filtered noise with a
wandering band, the clock is a scheduled transient that ticks and tocks
differently, thunder is a rare envelope on a low-passed burst, the desk lamp
hums at mains frequency from its actual position in space. Nothing loops, so
there is no loop point to notice.

Cassettes are spatial. Walk toward one and a wobbling, low-passed voice fades
up through a `PannerNode`; walk away and the distance model takes it out. The
Web Audio listener is glued to the three.js camera.

---

## Structure

```
src/
  constants.js            world scale, LOD tiers, quality tiers
  data/
    cases/*.js            six case files: exhibits, links, chronologies
    tours.js              narration scripts, written to be spoken
    layout.js             size-aware dart throw that pins everything, once
    index.js              board assembly + full-text index
  gfx/
    canvas2d.js           paper, ink and photographic primitives
    generators.js         the eight kinds of exhibit, per LOD level
    lod.js                the streamer: request, generate, evict
    evidenceMaterial.js   the patched standard material
    room.js               cork, wood, concrete
    caseCard.js           file covers for the chooser
  scene/
    nav.js                the only navigation state there is
    Rig.jsx               input, damping, handheld, iris, beam projection
    Experience.jsx        the whole site as one scene graph
    Board.jsx             one case, assembled
    EvidenceItem.jsx      a sheet of paper: LOD, presence, lens, framing
    Strings.jsx           verlet, constraints, string-on-string contact
    Lamp.jsx  Dust.jsx  Corkboard.jsx  MapTerrain.jsx
    CaseCloud.jsx         the opening
    Warehouse.jsx         everything else
    Post.jsx              bloom, SSAO, depth of field, aberration, grain
    tour.js               the director: beats, camera, lens, pacing
    graphLayout.js        force-directed, cached
  audio/
    soundscape.js         the room
    narrator.js           voice ranking, phrasing, performance marks
  ui/                     intro, HUD, inspector, chronology, search
```

## Notes on the archive

The six cases are presented from publicly documented material, and the boards
are built to show their own weak points rather than hide them: contested links
are drawn in thinner, dimmer thread; a suspect the physical evidence excludes
says so on the card; the Dyatlov board keeps the wrong turn the 1959
investigation took, because a board should show its own mistakes. Where a piece
of evidence is famous but worthless — an unauthenticated tape, a DNA claim with
no chain of custody — it is on the board *and* labelled as such.

## Performance

Quality auto-detects from `deviceMemory`, `hardwareConcurrency` and pointer
type, and is switchable from the HUD. The tiers change dust count, shadow map
size, and whether SSAO and depth of field run at all. On a machine without
hardware acceleration everything still runs, slowly — the whole project is
built so that nothing depends on a frame budget it might not get.

## Two decisions worth explaining

**Camera flights run on the render loop, not on an animation library's ticker.**
They used to use GSAP. A flight then only advanced when GSAP got a tick — and
while the texture streamer was building a full-resolution scan, it did not.
Each new flight killed a predecessor that had never moved, and the camera sat
still through an entire narrated sequence while the captions and the year
slider carried on without it. `src/scene/nav.js` now interpolates in the same
loop that draws the frame, which gives a much stronger invariant: if a frame
renders, the camera has moved.

**The top level of detail is capped by the quality tier.** A top-tier scan is
several million pixels of synchronous procedural drawing — affordable on a
machine that can already render the board, and a multi-second freeze on one
that can't. The lowest tier stops one level short rather than spending its
whole budget building a resolution it could never display smoothly.

## Deviations from a production build

Two, both deliberate:

- **The data is files, not a graph database.** The relationship model here is
  genuinely a graph, and Neo4j would be the right home for it at archive scale.
  At six cases it would be a network round trip to fetch something that fits in
  a module. `src/data/` is shaped so the query layer could be swapped without
  touching the scene.
- **Search is an in-memory index.** Same reasoning: the entire corpus is
  smaller than the code that would fetch it.
