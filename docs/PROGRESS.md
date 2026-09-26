# Breakwater — Progress

## Current milestone
**V4 — World & career: in progress.** Direction (user): the game grows into a boat RP — buy and drive boats for work or leisure. Done: The Grey Reach (islands, Kettle Harbor, stations, nav aids, seabed), career core (5 job types, radio, job board, port services, economy, save, crew transfer), headless career tests (tow job + rescue job paid at Kettle Harbor), shipyard with all 9 upgrades and the T autopilot with time compression, Kestrel and Bulwark (all section-4 targets pass; bought and switched at the shipyard), chart (M) and minimap, `npm run sim:economy` (6/6 pacing targets, also run by verify), the guided first job (the Wren; verify drives it to the line with the autopilot helper).

## NEXT (V4)
2. Headless acceptance run: tutorial job + 3 more jobs with correct payouts (spec 14 V4).
3. Later in V4: daisy-chained container tows, planing lift for the Kestrel.

## Known issues
- `npm run verify` ~160 s of its 180 s budget: physics now runs ~125 s in parallel (62 tests); the next heavy test should replace or trim one. (physics ~120 s in parallel); the next heavy addition needs a saving (candidates: fewer V1 reuse waits, a shorter tutorial drive, merging the two boat pages). (software GL; lane B reuses one page for all V2/V3 shots, smoke checks run on the Low preset).
- Towing from the aft bitt makes the Marlin yaw off course under load (it "girts"); realistic, but the player needs rudder. Revisit with a tow hook further forward if it feels bad.
- Rope visual reads well to ~150 m; beyond that it thins to a 1 px line.
- Survivors aboard are drawn seated on the aft deck, not animated.
- Target collisions use the same 4-piece convex hulls; contact damage threshold (45 kN) is a guess until V4 docking.
- Night storm readability waits on V5 lights (searchlight, running lights, flares).
- Headless verify renders at ~4 fps; screenshots are staged with `advance()` and paused frames (spec 0.2 allows setup placement).
- Searchlight II is sold and saved but acts only once the searchlight exists (V5). Radar shows vessels and people on the chart and minimap; no HUD radar returns yet.
- Chart: no weather forecast yet (the Markov weather + forecast arrive in V5); the breakwater and piers are not drawn (not in the height field).
- Blender is not installed in the cloud env: generators untested; the game uses procedural models.

## Screenshot review (`docs/shots/`)
- `v1-*`: unchanged scenes; the new Worley foam reads as froth rather than marble in `v1-rough-golden`.
- `v2-rough-pitching.png`, `v2-wake.png`: hull now carries waterline grime and dirt runs; the wake is bubbly froth with lacy edges; water is darker against the hull.
- `v2-bow-spray.png`: slam spray now shows droplet streaks plus mist (droplets were invisible before).
- `v3-tow-taut.png`: Marlin towing the trawler in Rough on 28 m of line, line taut (10 kN), tow panel up. Trawler model is simple but reads.
- `v3-pull-aboard.png`: survivor being hauled up the Marlin's side (60%), hypothermia bar and prompt visible.
- `v2-wake.png` (V4): churned, frothy wake with lacy edges behind the transom; no dots or texel steps. The verify run only builds 5.5 s of wake.
- `v4-kettle-harbor.png`: Marlin at the pier inside the rubble breakwater, lighthouse, channel buoys; pier planks read flat brown.
- `v4-kestrel.png`, `v4-bulwark.png` (from a dev run, not verify): RIB at 28 kn with grey collar, console and outboard; tug with white wheelhouse, red funnel, tyre fenders. Bulwark's wake is faint for her size.
- `v4-shipyard.png`: chart-paper shipyard at phone width (800×450), Tow line II fitted.
- `v4-solace.png`, `v4-islander.png`, `v4-northfarer.png` (dev run): yacht with saloon and flybridge; ferry with passenger decks, lifeboats, cars aft; freighter with aft bridge, funnel and a deck load of containers (tiers read flat from afar).
- `v4-hurricane.png` (dev run): Bulwark in a hurricane; murk, big grey seas, white water. At night a violent storm is nearly black until V5's lights.
- `v4-title.png`, `v4-settings.png` (dev run): title card over the harbor flyover; settings with graphics, volume and camera.
- `v4-traffic.png`, `v4-chart-ais.png` (dev run): a trawler working Hake Bank; the chart with every vessel's AIS mark and name.
- `v4-chart.png`: full chart with depth bands and contours, ports and zones, buoys, lighthouses, job circles, the waypoint route to Pellow Point. Labels crowd around Farrow; breakwater not drawn.
- `v4-kettle-harbor.png` now shows the minimap top left.
- `v4-job-board.png`: chart-paper job board over the harbor with three offers; port prompt and radio log visible.

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
- **D53 Mist motion:** mist loses its launch speed fast (drag 2.2/s) and drifts at 0.3× the wind instead of being dragged to full wind speed (storm puffs were crossing the screen at 25 m/s); no motion stretch on mist; spindrift is sparse, low (0.15 m) and faint (alpha 0.14) from 24 kn; bow mist is small and occasional (slams keep the big plumes).
- **D52 Phones, second pass:** shadows off again on Low (the version that ran well had none), no preserved drawing buffer on Low; context loss auto-restarts at most once per session, then shows a Restart button (reload loops can get WebGL blocked); start-up errors are shown on screen.
- **D51 Phone resilience:** Low preset pixel ratio 0.75 → 0.6, foam map 256, 2000 spray particles; dynamic resolution on touch devices (drops 15% steps to 0.6× after 3 s under 26 fps, recovers above 50 fps); WebGL context loss shows a notice and reloads; ocean/spray outputs clamped so an overflow can never smear Inf across post passes.
- **D54 Autopilot creep is opt-in** (`opts.creep`): inside 30 m with |heading error| > 0.7 rad the speed command is capped at 0.5 m/s so it turns on prop wash instead of orbiting a small target. Only the rescue approach passes it; the scripted tow's line-up needs normal speed.
- **D55 Wake foam (third pass):** the wake has its own foam function (`wakeFoam`), not the crest froth: a milky film for continuity, Worley froth with a soft threshold clumped along the band, and a lace of bubble walls where it thins, so it never breaks into dots. The foam map is read through a ~2 m turbulent warp (ragged, billowy edges) with a 4-tap B-spline (no 0.8 m texel steps on Low); churned-water ripples roughen the reflection in the wake. Kelvin arms break into a train of short crests (spacing 1.1 m per m/s, 5–16 m); quarter streaks are weaker and drift less so they merge into the centre wash. Ribbons are ≥ 1.5 texels wide; contact stamps are spread along the track at low fps. All wake work is skipped on pixels with no foam.
- **D67 Hull waves (visual only):** the player's hull displaces the ocean in the vertex shader and bends per-pixel normals (`ocean/boatWaveGLSL.js`): water piled on the stem, a bow crest peeling off it aft and outward (~30°) that breaks white, drawdown along the sides, a trough behind the transom then the quarter waves, transverse Kelvin waves (λ = 2πu²/g) inside the 19.5° wedge. Bow-wave height = 0.45·u²/2g capped at 0.13·beam. The vertex pass blurs every feature to the local grid cell (area kept) so coarse vertices don't pop as the grid moves; thin divergent crest ridges (wake particles → foam map alpha) reach the vertices only where cells are < ~0.7 m and are otherwise shading only. Physics still floats on the undisturbed sea.
- **D68 GitHub Pages:** `.github/workflows/pages.yml` builds `site/` (standalone playable page, `scripts/artifact.mjs`) and publishes it to the `gh-pages` branch on every push to this branch or main. Pages itself must be enabled once in the repo settings (source: gh-pages, root).
- **D69 Sinking clock:** a crew-transfer vessel's time to founder is set on accept to at least (distance / 0.7·top speed) × 1.4 + 4 min + 5 s per crew, so every call is reachable; the board shows it and the radio says it.
- **D70 Mist settles:** mist falls at 2.4 m/s² (was 0.6), grows 0.5 m/s, slam mist lives 1.7 s (was 3.8): it read as lingering smoke.
- **D71 Cameras scale with the boat** (length / 12); orbit mode starts 16 m behind and 6 m above the boat when cycled to (it used to stay wherever it was left, often far away).
- **D72 Bigger boats (no spec targets; design values checked by test:physics):** Solace 18 m motor yacht (28 t, 29.6 kn, $45k), Islander 45 m island ferry (650 t, 16 kn, 150 aboard, $150k), Northfarer 72 m coastal freighter (3,200 t, 13 kn, 1,500 kN tow, $320k). Low VCGs (0.8 / 1.3 / 0.5 m) because this hull form's GM falls fast with height; lateral drag and rudders kept modest so they don't stall in a hard turn. Boats over 30 m are kept at an anchorage 470 m off Kettle Harbor (30 m deep), which counts as the home berth for services and switching. Procedural models in `ShipModels.js`.
- **D73 Menu (playable page):** Graphics presets (Low/Med/High/Ultra) saved per browser and applied by restarting (career autosaved first); Admin row switches to any boat at once (restart at its berth) and +$10k. Fuel and damage in the save belong to the boat in use (`hullOf`).
- **D74 Trade work (RP):** passenger runs (Islander, 150 aboard), charters (Solace, 12 guests, premium per head) and cargo contracts (Islander vehicles 80 t, Northfarer 1,200 t) between ports, offered when the boat in use can carry them (60% of new offers). Load/unload by holding at the origin/destination berth under 2 kn (big ships: each port's anchorage; others: the port zone), pay per head/tonne + per km, due time from distance at 75% top speed ×1.8 + load times + 3 min, 5%/min late penalty (min 50%), +2 rep on time. Freight and passengers sit in the hold (`BoatPhysics.cargo`, at the waterline, amidships). `gameplay/Trade.js`.
- **D75 Autopilot braking scales with size:** planned deceleration min(0.35, 7/length) m/s² (the loaded freighter overshot every berth at 0.35).
- **D76 Phone presets (Pixel 10 crash):** Medium on a Pixel 10 (PowerVR GPU) lost the WebGL context and Chrome then blocked WebGL for the site until restart. Touch devices now use `PHONE_QUALITY`: Low / Medium (0.75×, foam 512, grid 192) / High (0.9×, grid 224, shadows 1024², env 128), never bloom, no Ultra. A lost context restarts one preset lower and remembers it; a failed start resets to Low and explains that the browser must be fully closed to lift its block.
- **D77 Tougher weather (user request):** two sea states past Storm: Violent storm (60 kn, Hs 9.5 m, payout 4.4) and Hurricane (75 kn, Hs 12.5 m, payout 5.5); the wave generator hits both Hs targets. A continuous storm intensity (0 Calm … 6 Hurricane, blending neighbouring states over ~6 s) and the wind direction are set from the menu. The Northfarer needed VCG 0.1 and 4.6 m freeboard to ride out a hurricane (max roll 65° in quartering seas); the Bulwark takes a violent storm at 25°.
- **D78 Title and pause (spec 11):** real careers open on a title screen (Continue when a save exists, New Career, Settings, Controls) over a slow circle of Kettle Harbor with the sea running; Esc or the II button pauses (Resume, Settings, Controls, Save & Quit → back to the title). Settings: graphics preset (restart), master volume, horizon-lock camera, kept per browser. Menus block game keys (Escape excepted). Test pages (`?debug=1`) skip the title. The admin/weather panel starts folded on every device.
- **D79 Ambient traffic (spec 6):** six kinematic vessels (`world/Traffic.js`, `TRAFFIC` in config/world.js): the ferry Skerry Belle on Kettle–Pellow–Farrow with port stops, three trawlers working fishing grounds, the yacht Halcyon, the sloop Morven. They follow routes with a size-scaled turn rate, give way to the player ahead, ride the waves (heave/pitch/roll from four samples), carry a kinematic Rapier collider the player can hit, lay wakes, and show on the chart and minimap (AIS). Half of person-overboard and raft calls come from one of them, at its position. Off on test pages unless `?traffic`.
- **D80 Verify's tutorial driver backs down at up to 3 kn when far off** (it crawled at 1 kn from ~100 m out and timed out now and then).
- **D81 Cargo recovery and barges (spec 8.1):** 3–6 sealed 40 ft containers (`CONTAINER`, 24 t, VCG −1.2 m so KG sits below KB + BM; `sealed` = no green water) adrift near a spill; tow each into Kettle Harbor, $500 each × weather (spec $350; raised with weight 1.2 → 0.8 and person-in-water $280 → $300 per survivor to keep sim:economy at 6/6). The 250 t barge (`BARGE`, 60 × 14 m) turns up in tow offers from reputation 70; the Bulwark tows it at 5.8 kn (spec 6). Daisy-chaining three containers is not done (one at a time). `gameplay/Recovery.js`.
- **D82 Anchor and photo mode (RP):** N lets go (under 2 kn, depth < 60 m) or weighs; the rode (3 × depth + 15 m) is a horizontal spring-damper at the bow once past its scope, holding up to 0.35 m/s² × boat mass and dragging beyond that (motoring away, storm windage). P (or the PHOTO button) freezes time, hides the HUD and slowly circles the camera; Esc/P leaves.
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
