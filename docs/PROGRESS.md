# Breakwater — Progress

## Current milestone
**V4 — World & career: in progress.** Done: The Grey Reach (islands, Kettle Harbor, stations, nav aids, seabed), career core (5 job types, radio, job board, port services, economy, save, crew transfer), headless career tests (tow job + rescue job paid at Kettle Harbor), shipyard with all 9 upgrades and the T autopilot with time compression, Kestrel and Bulwark (all section-4 targets pass; bought and switched at the shipyard), chart (M) and minimap, `npm run sim:economy` (6/6 pacing targets, also run by verify), the guided first job (the Wren; verify drives it to the line with the autopilot helper).

## NEXT (V4)
1. Title screen (Continue / New Career / Settings / Controls, spec 11), pause menu.
2. Headless acceptance run: tutorial job + 3 more jobs with correct payouts (spec 14 V4).
3. Later in V4: cargo recovery (containers, 3 daisy-chained lines), the 250 t barge + Bulwark tow-speed test (6 kn), ambient traffic, planing lift for the Kestrel.

## Known issues
- `npm run verify` ~163 s of its 180 s budget (physics ~120 s in parallel); the next heavy addition needs a saving (candidates: fewer V1 reuse waits, a shorter tutorial drive, merging the two boat pages). (software GL; lane B reuses one page for all V2/V3 shots, smoke checks run on the Low preset).
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
- `v2-wake.png` (V4): wake is now continuous soft streaks (no dots, no texel steps); prop-wash crest froth still bubbly near the transom. Could use a little more texture far astern.
- `v4-kettle-harbor.png`: Marlin at the pier inside the rubble breakwater, lighthouse, channel buoys; pier planks read flat brown.
- `v4-kestrel.png`, `v4-bulwark.png` (from a dev run, not verify): RIB at 28 kn with grey collar, console and outboard; tug with white wheelhouse, red funnel, tyre fenders. Bulwark's wake is faint for her size.
- `v4-shipyard.png`: chart-paper shipyard at phone width (800×450), Tow line II fitted.
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
- **D55 Wake is a continuous sheet, not froth:** the ocean shader no longer runs the dynamic (wake/contact) foam through the Worley bubble threshold (thin bands became strings of dots, worst on phones); it is soft coverage with streaky texture. Ribbons are widened to ≥ 1.5 foam texels (strength scaled down to match) so they can't bead between texel centres; contact stamps are spread back along the track at low fps; the foam map is sampled with a 4-tap cubic B-spline (bilinear showed the 0.8 m texel grid on Low).
- **D56 Upgrades rewrite a per-game copy of the boat cfg** (`structuredClone` in `Game.create`; `applyUpgrades` recomputes from the base config, so it is idempotent). Hull plating is `hull.damageScale` 0.6 on every damage source.
- **D57 Autopilot (T):** steers to the chart waypoint or the job objective at 80% of top speed; any helm key, lever or wheel movement hands back control; stops 60 m short, or for seabed < 4 m within 150 m ahead. Time ×4 only in Calm/Moderate with nothing within 300 m (targets, people, shallows, ports); radio calls drop it to ×1.
- **D58 Verify is pixel-bound:** SwiftShader rasterises on the CPU and JS is cheap (10 s of sim in 0.23 s), so milestone shots render at 1024×576 (Medium), the smoke page at 800×450 (Low), each lane has its own browser, and screenshots are CDP captures of a paused, freshly rendered frame (`snap`); page.screenshot waited ~10 s for a new frame. 176 s → 143 s.
- **D59 Kestrel:** 1.6 t, VCG 0.45 m, roll gyration 0.24·B, thrust 6.0 kN with vProp 80 m/s, long quad 4, lateral drag halved (450/300) and 30° × 0.2 m² rudder. With full lateral grip a hard-over at 37 kn needs ~1 g and the displacement model heels her outward past 80° (no planing bank-in), so her turning circle is measured at a 40% "rescue cruise" throttle (~28 kn → 9 kn in the turn). At full speed a hard-over still heels her ~55°: twitchy, as the spec wants.
- **D60 Bulwark:** VCG 0.6 m (1.6 was negative GM on this hull), freeboard 1.3 m, roll gyration 0.26·B; nearly flat thrust (25 kN, vProp 60 m/s) against mostly quadratic drag (long quad 360) so 0→10 kn takes ~32 s with a 13.5 kn top speed; reverse efficiency 0.16 for the ~170 m stop; lateral drag cut to 20000/12000 so she doesn't stall in a hard turn. Tow point 4.5 m from the stern (H-bitt; `towPointFromStern`).
- **D61 Switching boats** saves the career and reloads at the berth with the other boat (`?boat=` for test pages); the live session is not rebuilt in place. Allowed only berthed at Kettle Harbor with no job and no tow.
- **D62 Chart base from the depth texture:** the chart and minimap paint the world's baked 512² depth/land texture (14 m/px): paper, four depth bands, 5/10/20 m contours, ink coastline. No extra terrain sampling at start-up. Click the chart to set the waypoint (the autopilot's target); the job circle is the offer's approximate position until within 450 m.
- **D63 sim:economy definitions:** 12 seeded careers over 8 h on a 15-min weather Markov chain; job minutes per the spec's pay checks (Calm tow 12, 2-person rescue 7) including transit, ×1.2 rough … ×1.4 storm; the player keeps a $1,200 reserve and buys down a shopping list (upgrades in table order, Kestrel after the autopilot, Bulwark last). "First upgrade" = first purchase; "Kestrel/Bulwark affordable" = cumulative net earnings reach the price; "everything owned" = every boat and every upgrade once. Earning rates: Marlin in alternating Calm/Moderate; Bulwark working a Storm.
- **D64 Pay raised ~18% to hit the pacing** (spec 0.1 balance authority): person in water base 300 → 380, per 250 → 280; raft 200/180 → 240/200; crew 400/300 → 460/330; tow share 0.15 → 0.18; swamped bonus 800 → 900; Storm payout 3.0 → 3.6. A Calm 2-person rescue now pays $940 and a Calm trawler tow $2,520 at full condition. Result: $8.3k/h Calm/Moderate, $13.1k/h storms, first upgrade 13 min, Kestrel 72 min, Bulwark 2.8 h, everything 5.5 h.
- **D65 Guided first job:** a new career (no save) starts with the Wren (sailboat) disabled 520 m seaward of Kettle Harbor, the job already accepted; Calm and the clock held until she is in; prompts only (throttle, low-speed steering once, approach, winch, cast off, then the job board). Random offers resume 20 s after. `?tutorial` forces it on test pages (with `&spawn=harbor`).
- **D66 Passing the line by backing down:** the verify driver gets ahead of the tow on her own heading and backs down onto her bow (`Autopilot.backDown`: heading + lateral-offset hold, rudder reversed astern). Lining up from abeam with a point past her bow only worked for the 16 m trawler.
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
