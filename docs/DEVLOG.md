# Breakwater — Devlog

Status as of the end of V6 work (September 2026). Details and decision numbers (D1–D102) live in `docs/PROGRESS.md` and `docs/CHANGELOG.md`.

**Where it stands:** V1–V7 are done. `V6: release candidate` is committed with your two calls: the Bulwark on twin azimuth pods (turning circle at most 2.5 L; she now makes 0.38 L) and the Marlin's tow hook moved forward. Your playtest fixes are in: a steady Solace, hull waves that follow immersion, and weather that ramps in. V7 (Life ashore) is committed: you can walk off your boat and around Kettle Harbor. The one open V6 item is a real-hardware frame-rate check. Next: V8 (phone, radio and voice).

---

## What's done

### V1 — Ocean & sky
- Vite + Three.js, fixed 60 Hz simulation with smooth render interpolation.
- Gerstner ocean shared by physics and the GPU (checked to agree within 2 cm), 7 sea states from Calm to Hurricane with smooth transitions.
- Physically based sky, day/night cycle with sun and moon, clouds, height fog, auto-exposure, colour grading, bloom.
- Crest foam, rain, lightning.

### V2 — Boat physics
- Parametric hull shared by rendering and physics; voxel buoyancy (~60 points per boat).
- Drag, slamming, propeller thrust with ventilation, rudder with stall and prop wash, wind, current, capsizing, fuel.
- Chase / helm / orbit cameras; instrument-cluster HUD; engine, sea and slam audio.
- Wake and hull foam, spray and mist.
- All Marlin physics targets tested headlessly.

### V3 — Towing & rescue
- Tow line as a real spring-damper: slack, snatch loads, breaking at its rating, winch, auto-tension upgrade; rope that sags, floats, whips when it parts.
- Tow targets (trawler, sloop), people in the water, life rafts, hypothermia timers, pull-aboard.
- Flooding, pumps, hull damage, grounding, repairs; tow panel HUD.
- Look pass: hull paint and weathering, bubbly foam, textured wake, proper spray droplets.

### V4 — World & career (plus the RP expansion you asked for)
- **The Grey Reach:** 10 × 10 km, 17 islands, reefs, shallows, 7 ports (Kettle Harbor, Pellow Point, Farrow Station, Hollin Pier, Ardmore, Lanrick Quay, Duncairn), lighthouses, buoys, surf, vegetation.
- **Career:** 6 rescue/salvage job types (person in the water, life raft, crew transfer, disabled vessel, swamped vessel, cargo recovery) plus barge tows; radio maydays; job board; reputation; economy; save/load; guided first job (the Wren).
- **Shipyard:** 9 upgrades and 7 boats — Marlin (workboat), Kestrel (RIB, planes), Bulwark (tug), Kittiwake (trawler), Solace (yacht), Islander (ferry), Northfarer (freighter).
- **RP work:** passenger runs, charters, cargo contracts, ferry timetables with complaints when late and per-port passenger ratings, fishing, anchoring, photo mode, hired crews for your other boats (who can break down in bad weather and need towing home), daisy-chained container tows.
- **UI:** chart with waypoints and autopilot (+ time compression), minimap, title screen, pause menu, settings.
- **Traffic:** two ferries, a freighter, trawlers, a yacht and a sloop on the AIS; many maydays come from them.
- **Playtest fixes:** sinking calls always reachable, smoother hull waves, mist that settles, closer orbit camera, graphics presets, admin boat picker, much punchier big boats.
- **Phones:** gentler Pixel-class presets, automatic step-down after a GPU crash, touch controls.
- **Acceptance:** a headless playthrough does the tutorial + tow + rescue + container recovery in one career with every payout checked.

### V5 — Weather & atmosphere
- **Weather that follows a forecast:** seeded chain; storms build over 10–20 min; 2-game-day forecast on the board, chart and radio; Auto/hold on the bridge panel.
- **Storm front:** a dark rain wall closes in from windward; thunder delayed by distance.
- **Night:** searchlight (L) with a visible beam, parachute flares (R), rafts light red hand flares, nav lights on every vessel, strobes on people in the water.
- **Glass:** rain on the lens, rain on the wheelhouse windows with swinging wipers, spray on the glass from slams; breaking crests in gales.
- **Audio mix:** wind howl and gusts, rain on the roof, surf near shore, 3D survivor whistles, radio ducking, UI sounds, four volume sliders.
- **Storm rescues made playable:** lifebuoy on a line (E from 4–14 m), autopilot fixes; acceptance test: Marlin in a Storm gets 4 of 5 people out.

### V6 — Polish & performance (so far)
- **Performance:** models merged by material (Marlin 114 → ~35 meshes); worst scene 277 → ~137 draw calls (budget 300); physics 0.3 ms/step towing 3 containers in a Storm (budget 4 ms); `npm run perf` report; perf checks in the test suites.
- **Gamepad:** stick steers, triggers throttle, buttons map to keys, d-pad menu navigation.
- **Settings:** graphics, 4 volume sliders, field of view, horizon lock, gamepad status, reset career.
- **Bug bash:** nav lights were on the wrong sides (fixed), golden hour now warm, breakwater and piers on the chart/minimap, rope readable at range.
- **Coverage:** every job type in every sea state (42/42) tested.
- **Docs:** full README; issue triage and definition-of-done checklist in PROGRESS.

### V7 — Life ashore
- **Moored boats:** come alongside a pier slowly and the lines go ashore by themselves (Space casts off). Moored, E leaves the helm and you walk the deck as it moves under you, then step ashore.
- **Kettle Harbor is a town** on made ground behind the quay. It has a waterfront street, the harbormaster (job board), the fish market, the Kettle & Anchor pub, Ross Chandlery, the Kettle Shipyard, a fuel kiosk on the pier head and your house (sleep until morning). All have small interiors and working counters.
- **Life:** lit windows and street lights at night, parked cars, cars on the coastal road, and townspeople at a distance. The breakwater is walkable out to the lighthouse.
- **Other ports:** each has a walkable pier, a harbour office, a store & café and a house.
- **Sound and input:** footsteps by surface. Mouse, gamepad and touch walking.
- **Tests:** a headless acceptance walk (boat → pub → shipyard → house → boat → helm → cast off) runs every verify.

---

## What still needs doing

### Release candidate follow-ups
1. **Frame rate on real hardware** (needs you): `?debug=1`, F3, High on a GTX 1650-class laptop (target 60 fps) and Low on Iris Xe-class graphics (target 40 fps). The proxies are well inside budget.
2. **Bulwark (done, D103):** twin azimuth pods with ducted props (~83 kN bollard pull) and a turning circle of 0.38 L. From beam-on she now comes head to wind in a Storm in ~21 s (before, she never did), and she holds head to weather in a Violent storm. The headless pickup bot is still unreliable with her (it was with the old rudder too), so there's no automated storm-rescue proof yet; see PROGRESS known issues.
3. **Marlin tow hook forward (done, D104):** 3 m from the stern; she holds course under tow in Rough far better.

### Waiting on you
- **Rigged townsperson (and later the story cast):** see `docs/ASSETS_WANTED.md`. Drop it in and the silhouettes are replaced automatically.
- **Realistic boat models ("GTA 6 style").** Drop-in import is ready (auto-fit, credits, phone-friendly shrinking); the sandbox can't reach model sites. Candidates are listed in `docs/MODELS.md` — send the `.glb` files or commit them to `public/models/`.

### Known issues (minor, open)
- Survivors aboard sit still (no climbing the ladder, no animation).
- Tow-target collisions use simple convex hulls; the contact-damage threshold is a guess to tune from play.
- `npm run verify` uses ~165 of its 180 s on the cloud container; new tests must stay light (slow ones go in `verify:full`).
- Blender model generators exist but are untested (no Blender in the cloud); the game uses its procedural models.

### Nice to have (polish backlog)
- Rain ripples on the water; stars and a moon disc on clear nights; water sloshing on deck when flooding.
- More boats per class; HUD radar ring (for now the minimap is the radar display).
