# Breakwater — Progress

## Current milestone
**V6 — release candidate: done.** Next: **V7 — Life ashore** (`ROADMAP_V7.md`). V1–V6 history in `docs/CHANGELOG.md` and `docs/DEVLOG.md`.

## NEXT (V7, in roadmap order)
1. On-foot first-person mode: walk/jog/look/head bob, collision with piers, buildings and decks, footsteps by surface.
2. Boarding and leaving (E at the helm; step pier ⇄ boat; walk your own deck when moored or anchored in calm water); lines thrown automatically when docking slowly by bollards.
3. Kettle Harbor walkable town: waterfront street, harbormaster (job board), shipyard office (shop), pub, fuel kiosk, your house, fish market, chandlery; small interiors; lit windows, streetlights, parked cars, a coastal road with passing cars.
4. Townspeople as distant silhouettes (swapped for supplied rigged characters automatically).
5. Other ports: walkable pier + 2–3 buildings each.
6. `docs/ASSETS_WANTED.md`; acceptance run (boat → pub → shipyard → house → boat → cast off) and noon/night town screenshots.

## Definition of done (spec 18) — status
- [x] Career playable title → every boat and upgrade; no crashes, NaNs or console errors (smoke test; V4 acceptance playthrough and job matrix in verify:full).
- [x] Every section-4 physics target passes (Bulwark turning circle is now a maximum, D103).
- [x] `sim:economy` passes.
- [x] All 6 job types work in every sea state (42/42, verify:full).
- [x] Night storm rescues readable and playable (Marlin).
- [ ] Section 12 performance: proxies met (draw calls ≤ ~140 of 300; physics 0.3 of 4 ms/step); real-GPU fps check still needs the user (issue 1).
- [x] Screenshots of all required conditions pass the art direction.
- [x] README complete.
- [x] Final commit `V6: release candidate`.

## Known issues
1. **GPU fps on real hardware** (needs the user): F3 on a GTX 1650-class laptop (High, 60 fps) and Iris Xe-class (Low, 40 fps). The sandbox renders with SwiftShader.
2. **Bulwark pickups with the test bot are unreliable** (old and new; see D103). The bot overruns: her astern power at speed stays weak by design (the 180 m stopping target), and near the target the rudder-tuned autopilot over-drives her strong low-speed pods. The boat itself now heads up into a Storm in ~21 s and holds station head to wind. A pod-aware pickup script (approach head to wind at 1–2 kn, walk the stern with the pods) would settle it; not done, to stay inside the tooling time-box.
3. Hard over at cruise the Bulwark pivots almost in place (0.38 L). Realistic for an ASD tug; if it feels too twitchy in play, lower `azimuth.cruiseAngleDeg`.
4. Survivors aboard sit still (no ladder climb). Tow-target collisions are 4-piece convex hulls; the contact damage threshold (45 kN) is a guess.
5. Blender generators untested (no Blender in the cloud); procedural models everywhere.
6. Verify budget: fast `npm run verify` takes ~165 s of 180 on this 4-core container. The browser lanes are the critical path, so V7 browser checks must be very light; slow checks go in `verify:full`.

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
- `v5-storm-front.png`: rain wall on the upwind horizon while a storm builds. `v5-storm-night-flare.png`: night Storm, parachute flare lighting the sea green-grey, searchlight beam, raft's red hand flare with its reflection, nav lights. `v5-storm-day.png`: chase view into a Storm with drops on the lens. `v5-helm-rain.png`: wheelhouse windows with drops, the Marlin's wipers mid-sweep. `v5-golden-calm.png`: low evening sun and glitter path in Calm (warm tint is subtle).
- `v4-job-board.png`: chart-paper job board over the harbor with three offers; port prompt and radio log visible.

## Decisions (V6 release candidate onward; D1–D102 in CHANGELOG)
- **D103 Bulwark: twin azimuth stern drives (user call).** The rudder, single prop and bow thruster are replaced by two ducted pods at (±2.1, −3.0, −8.4) (`cfg.azimuth`, `Propulsion.computeAzimuth`).
  - **Steering:** the helm swings both pods to helm × podLimit(speed): 90° at ≤ 1 kn, closing to 45° at 8 kn. The pod struts are 1.2 m² foils in the ship's own flow (no wash term: a pod's wash runs along its own axis; with wash they made ~12 kN of astern drag at large angles). Going astern, steering keeps its sense (the pods are steered, not reversed).
  - **Thrust:** ducted props add a 60 kN nozzle hump at rest, gone by 3 kn, on top of the open-water curve (thrustMax 25 → 23 kN). That gives ~83 kN bollard pull (was 25 kN), about 2.5× the 50 kn storm wind load on her 90 m² side, while 0→10 kn stays 32 s (target 35). A 1-D fit showed no monotone prop curve gets bollard pull much above ~30 kN and still takes 35 s to 10 kn.
  - **Astern:** the pods swing round in 4 s, symmetric so their side forces cancel. Astern efficiency 0.16 → 0.13 (open water), plus 0.7 of the nozzle hump, so the stop from 10 kn is 179 m (target 180).
  - **Results:** top 13.2 kn, turning circle 2.48 → 0.38 L (she pivots nearly in place hard over; the target is now a maximum of 2.5 L), roll 8.6 s, capsize 60°.
  - **Heading up:** time from beam-on to head to wind: Gale 35–78 s → 12–25 s; Storm never → 21 s (wind on either beam; from 150° off she still can't).
  - **Violent-storm test:** replaced by "hove to head to weather 90 s: upright" (max heel ~15°). Beam-on at 75% on arbitrary headings, both old and new capsize within 60–120 s: the old 60 s test passed on luck of timing, and a 55° boat in 14 m beam seas should be in danger.
  - **Autopilot for azimuth boats:** when the weather holds her bow off, it slows to 1 kn so the pods can reach 90° (instead of driving through the turn), and `stop()` holds her heading. The test bot creeps the last 150 m at 4 kn with slow-stopping boats.
  - **Rescue bot, measured over 4 start headings:** the scripted pickup is unreliable with the Bulwark in any weather (old boat: Gale 0/1/0/0 aboard; pods: Rough 0/2/2/1 of 2, Gale 0/5/1/0 of 5, Storm 0 on every heading). This is a limitation of the bot, not of the boat, so no rescue claim is made for her; see known issue 2.
- **D104 Marlin tow hook forward (user call):** 1.3 → 3 m from the stern (`towPointFromStern: 3`, model bitt follows). Worst course wander under tow in Rough over four headings: 10/25/93/77° → 13/14/69/50° (mean 51° → 36°); a hook 4.6 m from the stern was no better than the old one. She still answers the helm under tow in calm (79° in 30 s hard over). The tow test rig now spaces the target from the hook, so every boat starts with the same line geometry.
- **D105 verify split:** fast `npm run verify` (per commit, < 180 s): waves, all section-4 targets, seakeeping, tow physics, scripted tow/rescue, flooding, grounding, weather chain, perf, smoke test, screenshots. `npm run verify:full` (per milestone, < 600 s) adds the career acceptance playthrough, trade runs, the fleet Kittiwake tow, the Marlin storm rescue, the job matrix, chained containers, the bigger boats, the Bulwark gale rescue and the Marlin tow course-keeping test. `TIMES=1 npm run test:physics` prints per-test seconds.
- **D106 Playtest: the Solace was absurdly tippy.** GZ at 10° was 0.02 m (GM ~0.1 m), so she lolled 20–40° in any turn or beam sea. VCG 0.8 → 0.15 m (engines and tanks low), roll gyration 0.22 → 0.36 B, roll target 6.5 → 4.3 s. Hard over at 36 kn: peak heel 37° → 12°, steady 22° → 3°. Rough beam seas at 30% throttle: max 40° → 20° (the Marlin gets 21°). New fast test "Solace: hard over at full speed".
- **D107 Playtest: hull waves only where the hull is in the water.** The stem pile-up and the bow wave crest scale with bow immersion (the forward quarter's deepest buoyancy point, smoothed), and all hull waves scale with immersed volume. A bow lifted off a crest, or a hull on the plane, no longer carves the sea. (The first frame read an unset bow depth and the NaN blanked the ocean; now initialised and guarded.)
- **D108 Playtest: weather changes ramp in.** The bridge panel's sea-state buttons switched instantly: the wave field jumped and the boat was suddenly metres under a crest. Measured Calm → Storm at 50%: the Marlin capsized and sank on 2 of 3 headings, and the Solace shipped 30–135 t. The buttons and the slider now ramp 8 s per sea state (10 s at least), so Calm → Storm takes 32 s. The Solace then survives on every heading; the Marlin can still be rolled in a Storm with following seas (past her limit, per spec 7), but now you see it coming. The debug API keeps the instant switch for tests.

## Polish backlog
- Rain impact ripples on the water.
- Stars and moon disc on clear nights.
- Water on deck visuals when flooding.
- Survivor boarding animation (climb the ladder) and seated crew animation.
- Pods visible from an underwater camera (the camera is clamped above the surface).
