# Breakwater — Progress

## Current milestone
**V3 — Towing & rescue: complete.** Next session starts **V4 — World & career**.

## NEXT (V4)
1. The Grey Reach: `DepthMap.js` from a real depth map (replaces the V3 shoal stub), islands/terrain, shallows and reefs (grounding already works against `depthAt`), harbors + piers, buoys, lighthouses, vegetation, ambient traffic.
2. Jobs (6 types) on top of `Operations` (tow + rescue rules already exist), radio, job board, reputation, economy, shipyard, upgrades (auto-tension winch = `TowLine.autoTension`, autopilot = `Autopilot.js`), save/load.
3. Chart (M), minimap, guided first job (spec 15); repairs move from the F8 stub to the port.
4. Kestrel and Bulwark configs + physics tests; container targets (8 buoyancy points, 3 daisy-chained lines).
5. `npm run sim:economy`.

## Known issues
- `npm run verify` ~150–155 s of its 180 s budget (software GL; lane B reuses one page for all V2/V3 shots, smoke checks run on the Low preset).
- Towing from the aft bitt makes the Marlin yaw off course under load (it "girts"); realistic, but the player needs rudder. Revisit with a tow hook further forward if it feels bad.
- Rope visual reads well to ~150 m; beyond that it thins to a 1 px line.
- Survivors aboard are drawn seated on the aft deck, not animated.
- Target collisions use the same 4-piece convex hulls; contact damage threshold (45 kN) is a guess until V4 docking.
- Night storm readability waits on V5 lights (searchlight, running lights, flares).
- Headless verify renders at ~4 fps; screenshots are staged with `advance()` and paused frames (spec 0.2 allows setup placement).
- Blender is not installed in the cloud env: generators untested; the game uses procedural models.

## Screenshot review (`docs/shots/`)
- `v1-*`: unchanged scenes; the new Worley foam reads as froth rather than marble in `v1-rough-golden`.
- `v2-rough-pitching.png`, `v2-wake.png`: hull now carries waterline grime and dirt runs; the wake is bubbly froth with lacy edges; water is darker against the hull.
- `v2-bow-spray.png`: slam spray now shows droplet streaks plus mist (droplets were invisible before).
- `v3-tow-taut.png`: Marlin towing the trawler in Rough on 28 m of line, line taut (10 kN), tow panel up. Trawler model is simple but reads.
- `v3-pull-aboard.png`: survivor being hauled up the Marlin's side (60%), hypothermia bar and prompt visible.

## Decisions (V3)
- **D28 Spray droplet winding:** the screen-space corner frame must be a rotation, `perp = (dir.y, -dir.x)`; material also DoubleSide as a guard.
- **D29 Tow line as a physics link:** computed once per step from both bodies (before their force pass) so forces are exactly equal and opposite.
- **D30 Line damping:** c = 2·0.12·√(k·m_eff) with m_eff the reduced mass; k = B / (0.15·L) so shorter lines are stiffer.
- **D31 Auto-tension renders against the running mean load** (8 s mean × 1.35, floor 5% of rating), not an absolute threshold: real snatch peaks in Rough are only ~18% of the Marlin's 80 kN rating, so an absolute 30% threshold never acted. Result: −44% peak.
- **D32 Trawler:** 16 m, 25 t, VCG 0.15 m (0.85 m was initially unstable), drag long quad 290 / lin 420 → 7.9 kn at full throttle under tow (target 8).
- **D33 Snatch baseline:** "steady state" = mean tension towing at the same throttle in calm water.
- **D34 Flooding:** green water 0.22 t/s per metre of deck-edge immersion; leak up to 3.5 t/min at 0% integrity (so a badly holed Marlin out-leaks her 2 t/min pump); founder at 60% of reserve buoyancy then sinks at 1.5 t/s. No freeing-port drain (spec: pumps only).
- **D35 Pull-aboard:** 4.2 m from the hull side at < 2.5 kn, 2.5 s haul; survivors add 85 kg each on deck (overloading matters).
- **D36 Hypothermia minutes:** calm 14, moderate 11, rough 9, gale 7, storm 5.5; ×4 in a raft.
- **D37 Seabed stub:** one rocky shoal at (620, −520), radius 90 m, 0.3 m minimum depth, until the V4 depth map.
- **D38 Verify budget:** physics tests in a parallel process; two browser lanes; V1 shots share one page, V2 wake reuses the pitching page, V3 pull-aboard reuses the tow page.
- **D39 Gameplay rules are pure JS** (`Operations`), so the scripted tow and rescue run headless through exactly the player's code path.
- **D40 Hull paint in the shader:** antifouling / boot-top / topside / sheer-stripe bands computed per pixel from body-frame height with derivative anti-aliasing (vertex-colour bands on a coarse mesh stair-stepped, reading as "pixels"); hulls retessellated (110×28 stations). Gelcoat is MeshPhysical with clearcoat.
- **D41 Water clarity:** per-sea-state `clarity` (calm 1 → storm 0.08) drives an upwelling-light term, so fair-weather water from above is deep blue-turquoise (user reference: sunny aerial footage) while storms stay grey-green. Calm cloud cover 0.45 → 0.3, saturation 0.88 → 0.97.
- **D42 Wake:** foam map 256 → 512 texels, slow diffusion so wakes spread and soften, prop wash + two quarter-wave streaks instead of one broad band, aerated turquoise under-layer, coverage capped so fresh wake shows froth texture instead of flat white.
- **D43 Tow line visual weight:** drawn with a wet-line weight (2.6 kg/m) for the catenary, 36 mm radius, slack line hangs just under the surface, gentler straightening.
- **D44 Touch helm (playable page):** analog `PlayerBoat.wheel` (servoes the rate-limited rudder to the wheel angle); throttle lever with R / N / D detents.
- **D45 Moving wake:** wake is simulated as world-space particles redrawn into the foam map's B channel every frame (not accumulated): centre wash widens ~0.3–0.5 m/s, quarter streaks drift out at 0.1·u, Kelvin crests run out at tan 19.5°·u, which draws the diverging V. Emissions owed in a frame are spread back along the track so low frame rates don't bead it.
- **D46 Mist:** billow sprites (soft-max union of lobes, eroded, underside shaded), backlit rim glow, streaming stretch along motion; bigger and denser slam/bow mist; spindrift puffs shed from crests around the camera above 20 kn wind (user references: AC4 / Skull and Bones spray).
- **D48 Wake ribbons:** wake streams are ordered rings per trail; neighbours are drawn as tapered capsule segments with MAX blending (FoamRibbons), so no dots at any frame rate. Per-frame prop-wash and hull-contact stamps only at low speed (they beaded at speed).
- **D49 Lit spray sprites:** atlas 1024x512 stores normals + coverage; mist is lit (wrap diffuse, sky from above, backlit thin edges), gets fine wisps from a tiling noise and dissolves with age; droplets are lenses with a sun glint. Bow spray leaves from points along the forward third of the hull.
- **D50 Low preset (phones):** shadows on at 1024². Bloom was tried on phones and reverted: the in-app viewer lost its WebGL context (white screen) under the extra render targets.
- **D52 Phones, second pass:** shadows off again on Low (the version that ran well had none), no preserved drawing buffer on Low; context loss auto-restarts at most once per session, then shows a Restart button (reload loops can get WebGL blocked); start-up errors are shown on screen.
- **D51 Phone resilience:** Low preset pixel ratio 0.75 → 0.6, foam map 256, 2000 spray particles; dynamic resolution on touch devices (drops 15% steps to 0.6× after 3 s under 26 fps, recovers above 50 fps); WebGL context loss shows a notice and reloads; ocean/spray outputs clamped so an overflow can never smear Inf across post passes.
- **D47 Verify budget:** test-physics runs at nice 10; tow screenshot run-up 70 → 40 s. Verify is at ~172 s; the next milestone needs another saving (e.g. fewer page loads or shorter slam wait).
- Earlier decisions D1–D27: see `docs/CHANGELOG.md`.

## Polish backlog
- Rain impact ripples, lens droplets, helm window rain, storm front wall — V5.
- Breaking-crest spray in storms — V5.
- Stars and moon disc on clear nights.
- Shallow-water colour + shore foam need the depth map — V4.
- Engine sound voicing for Kestrel (outboard) and Bulwark (slow diesel) — V4.
- Planing lift (Kestrel) — V4.
- Wiper animation in helm view.
- Water on deck visuals when flooding.
- Survivor boarding animation (climb the ladder) and seated crew animation.
- Tow hook forward of the transom for better steering under tow.
