# Breakwater — Progress

## Current milestone
**V7 — Life ashore: done.** Next: **V8 — Phone, radio and voice** (`ROADMAP_V7.md`). V1–V7 history in `docs/CHANGELOG.md` and `docs/DEVLOG.md`.

## NEXT (V8, in roadmap order)
1. In-game phone (P / a gamepad button): realistic smartphone UI (not neon). Messages, Contacts, Bank (balance, history, loans), Weather (2-day marine forecast, wave charts), Tides & Charts (quick map, bookmarks), Market (used boats, fish prices by port, parts), Camera (photo mode to a gallery), "Harbour Life" feed reacting to what you did.
2. Voice: Web Speech `speechSynthesis` for VHF calls, maydays, the coastguard and the weather broadcast, through a Web Audio radio filter (band-pass 300–3000 Hz, light distortion, static, squelch); voices and pitches per character; always subtitled; a setting to turn voice off.
3. Wheelhouse radio stations (knob / keys): VHF 16, Coastal Weather (spoken each game hour), two procedural music stations (folk/acoustic, ambient/lo-fi) or files from `public/audio/stations/`; muffled through the wheelhouse walls when on deck.
4. Acceptance: a spoken mayday with subtitles; every phone app works; the feed posts about a job you just finished.

## Known issues
1. **GPU fps on real hardware** (needs the user): F3 on a GTX 1650-class laptop (High, 60 fps) and Iris Xe-class (Low, 40 fps). Harbor scenes now draw ~130–250 calls (budget 300; the town is ~40 of them).
2. **Bulwark pickups with the test bot are unreliable** (old and new; see D103 in CHANGELOG). The boat itself heads up into a Storm in ~21 s and holds station head to wind.
3. Hard over at cruise the Bulwark pivots almost in place (0.38 L). Realistic for an ASD tug; lower `azimuth.cruiseAngleDeg` if it feels twitchy.
4. **Verify budget (fixed 2026-09-27):** the physics tests now spawn before the build (they need no build), so the long pole starts at 0 s. Verify went 197 s → 118 s. V8 browser checks still need to stay light; the tutorial approach run remains the first thing to move to `verify:full` if the budget tightens.
5. Townspeople are placeholder silhouettes (by design until a rigged model arrives; see `docs/ASSETS_WANTED.md`); interiors are simple boxes; no NPC dialogue yet (V9).
8. **Not mine:** `package.json` carries a `packageManager: pnpm@12.6.0` field added by the environment (not committed; left in the working tree).
6. Walking is only on your own boat's deck (not other vessels), and only when she is moored or anchored in calm water (by design, ROADMAP_V7).
7. Survivors aboard sit still; target collisions are convex hulls; Blender generators untested (no Blender in the cloud).

## Screenshot review (`docs/shots/`)
- V1–V6 shots: see CHANGELOG (unchanged scenes).
- `v7-town-noon.png`: the waterfront street at noon: pub, chandlery, houses against the hillside, strollers, a parked car, street lights and the crane on the quay. Cobbles read flat (no texture); fine at walking pace.
- `v7-town-night.png`: warm lit windows (about half the houses), lamp glows and pools of light on the street and quay; the rest is properly dark.
- `v7-pub-night.png`: the Kettle & Anchor at night: tables and stools, fireplace with embers, pendant lamps, the open door onto the street. Box furniture; convincing at a glance, plain up close.
- `v7-deck.png`: standing on the Marlin's aft deck at her berth, the wheelhouse beside you, the pier with bollards and a lamp, a fisherman at a distance.
- `v7-breakwater.png`: out on the breakwater cap in a Rough sea: armour rock, fishermen along the mole, the lighthouse at the head, the pier and moored boats across the basin.

## Decisions (V7; D1–D108 in CHANGELOG)
- **D116 Verify order:** the physics suite (164 s) is the long pole in `verify`, but it spawned after the 33 s build, ending at 197 s. Physics imports `src/` directly in Node and needs no build, so it now spawns first and runs concurrently with the build and browser lanes: 197 s → 118 s. No test was moved or weakened.
- **D109 Made ground:** towns need flat land, but the Kettle basin was carved right back to the cliffs. `WorldShape.terrace()` levels a rectangle in the harbor frame to 1.9 m (Kettle a −134..94, o −112..−22; each station a −16..34, o −46..−8), blending over 12–16 m and never digging the harbor out seaward. Town ground renders as slabs at 2.0 m over it; the terrain mesh is too coarse (9 m) for crisp edges. The pier now starts on the quay (o −15 → −24), the quay runs to the breakwater, and the old houses floating in the basin are gone.
- **D110 Walker:** kinematic, pure JS (`src/foot/`), with its own collision instead of Rapier (headless-testable, no tunnelling). Every step it stands on the highest support within 0.5 m up or 2.6 m down (town slabs in harbor-frame boxes, or the boat's deck: the hull's deck line inset from the sheer, minus deck blocks such as the wheelhouse). A move with no support is refused, so you can't fall in. At an edge it probes 0.5–1.6 m ahead along the wanted direction and clambers (up to 1.7 m) onto a different support. On deck its spot is kept in the boat frame and re-posed each step; the camera rides the interpolated model and takes 85% of the deck's roll and pitch.
- **D111 Mooring:** lines go ashore when she is under 1.4 kn, within 28° of parallel to a pier or quay face, and within 3.5 m of it. A bow and a stern point (±0.35 L) are held by horizontal spring-dampers to their berth alongside at fender distance (0.35 m): period 5 s, damping ratio 0.9, pull capped at 0.25 g per line. Result: drift 1 cm in 60 s of 15 kn wind. Space at the helm casts off (if no tow line), and a throttle at 30% or more slips them; lines re-arm once she is 5 m clear. `berthFor(port, length, beam)` puts boats alongside the pier face.
- **D112 Helm hand-over:** at the helm, E means (in order) the ops actions (survivor, lifebuoy, crew, hose), then go ashore when moored or anchored (Moderate or calmer, under 1.2 kn), then port services (the anchorage for big ships). On foot every key except Esc, Tab, M, P, F-keys and digits goes to the walker (the `Input.sink`), so no boat control can fire; the boat keeps her lever at neutral. The autopilot disengages when you leave the helm.
- **D113 Town rendering:** all towns merge into one mesh per material (~27 materials, vertex colours for wall tints), plus one sign atlas, one Points cloud for lamp glows and one additive mesh for light pools: about +40 draw calls in harbor views. There are no real lights (the forward renderer would recompile every material). Night is faked with emissive windows, lamp heads and pools, and interior materials take a warm emissive term after dusk.
- **D114 Townspeople:** one instanced silhouette mesh (plus instanced fishing rods). They hide within 14 m of the camera (never seen up close), fishermen go home at night, and storms clear the piers. Strollers walk A* paths (`TownNav`, a 0.5 m walkability grid in the harbor frame). Two cars drive the coastal road with headlight glows at night. A rigged `townsperson` model listed in the manifest replaces the silhouettes (SkeletonUtils clone plus an Idle or Walk clip each).
- **D115 Tests:** `test:physics` adds the mooring test and the headless V7 acceptance walk (~9 s, fast set). Verify adds a light browser check on the berthed page (lines ashore, E ashore, walk 4 s, E takes the wheel), with no screenshot (budget). The town screenshots come from `scripts/shots.mjs` with a debug-only `?foot=<port>:<a>:<o>:<yaw>[:<pitch>]` placement.

## Polish backlog
- Rain impact ripples; stars and moon disc on clear nights; water sloshing on deck when flooding.
- Survivor boarding animation (climb the ladder) and seated crew animation.
- Pods visible from an underwater camera (the camera is clamped above the surface).
- Textured cobbles, roof tiles and interior details; doors that swing; rain on the street (wet look is V13).
- Walking other vessels' decks (ferries at the pier) and the Islander/Northfarer at anchor.
