# Changelog

## V3.1 — Look pass (before V4)
- Shader hull paint with anti-aliased bands, finer hulls, clearcoat gelcoat, non-skid decks; Marlin fit-out (rub rails, scuppers, nav lights, liferaft canister, antennas, exhaust, bow roller + anchor, cleats, wipers); trawler/sloop on the same paint.
- Clear-water upwelling colour by sea state; bubblier, irregular froth; wake as prop wash + quarter-wave streaks with diffusion and aerated churn.
- Heavier-looking tow line. Analog wheel API for touch steering.

## V3 — Towing & rescue
- Spray rewrite finished: instanced camera-facing droplets + mist from a procedural atlas, sky + forward-scattering (Henyey-Greenstein) sun lighting. Droplets had never rendered: their corner frame used `perp = (-dir.y, dir.x)`, a reflection, so every droplet quad wound backwards and was back-face culled (mist used a true rotation). Now thin motion-blurred streaks with a landing fade.
- Foam: tileable two-scale Worley bubble texture (`FoamBubbles.js`); crest foam and wakes threshold its equalised coverage field (dense froth with holes → lace of bubble walls), domain-warped, fading to mean coverage at range. Replaces the marbled fbm breakup.
- Hull footprint painted into the foam RT's G channel each frame; the ocean darkens and loses its sky reflection against hulls. Hull weathering (`hullGrime.js`): waterline scum band, deck-edge runs, paint blotches, roughness variation.
- `TowLine.js`: spring-damper with slack, k from 15% stretch at break, damping from the reduced mass, 0.25 s / 1.5× break rules, Q/Z winch (10–120 m, hauling stalls under load), auto-tension render winch relative to the running mean load. Runs as a `PhysicsWorld` link before the bodies' force pass.
- `RopeVisual.js`: 40-node Verlet line; floats slack on the surface, straightens to a catenary when taut, drips, whips free on a break and is hauled back; rope-lay normal-mapped tube whose radius grows with distance.
- Tow targets: 25 t trawler and 5 t sloop on `HullShape`/`BoatPhysics` with `NoPropulsion`, 32 buoyancy points, procedural models (`TargetModels.js`).
- Survivors and life rafts (`Survivors.js`): wave/current/wind drift, hypothermia timers by sea state (rafts ×4), E to pull aboard (4.2 m from the hull, < 2.5 kn, capacity), deck payload; pump hose to a flooding target.
- `Hull.js`: green water over the deck edge, free-surface shift of flood water, leaks below 60% integrity, rated pumps, foundering at 60% of reserve buoyancy; contact-force damage (Rapier events); grounding on a `DepthMap` stub shoal with friction, damage and scrape audio; repairs (port stub).
- `Operations.js` (pure JS rules shared by the game and tests), `Autopilot.js` (heading PD + speed schedule), `OpsSession.js` (keys → commands, visuals, audio, HUD).
- HUD: tow panel (length, winch state, tension gauge with peak hold and ok/warn/crit zones, target condition, tow speed), objective block (bearing/distance, hypothermia bar, survivors aboard), prompts, toasts. Sfx: snap, creak > 70%, clunk, splash, scrape.
- Debug: F8 scenario spawner (`?scenario=` too), `__game.spawn/setupTow/setupPickup/view/viewTow/look/render`.
- Tests: trawler/sloop flotation and stability, tow speed, Rough snatch ratio, break at rating, instant break, auto-tension, scripted tow + rescue via the autopilot, flooding, grounding (30 tests, ~43 s). Verify runs physics in parallel and two browser lanes with page reuse (~160 s).
- Fix: entering orbit mode no longer jumps the camera by the boat's travel since the last orbit frame.

## V2 decisions (moved from PROGRESS)
D15 one parametric hull for render/physics/Blender · D16 Marlin draft 0.55 m, fullness 2.0 · D17 mirrored voxel halves · D18 depth-decayed orbital velocity · D19 physics wave LOD by point footprint · D20 world-space heave damping · D21 speed-dependent damping + aft-biased lateral resistance · D22 reverse thrust falls with speed · D23 prop wash on the rudder only ahead · D24 Marlin tuning (thrust 9.2 kN, vProp 26 m/s, drag, VCG 0.9 m…) · D25 hollow wheelhouse · D26 counted key presses · D27 model manifest.

## V2 — Boat physics
- Parametric hull (`HullShape.js`), ray-parity voxelizer (fine 0.2 m grid → 60 symmetric buoyancy points), volume scaled to float at the design waterline.
- `Buoyancy.js`: per-point buoyancy, anisotropic drag (hull-frame sway/surge, world-frame heave), speed-dependent hull damping, aft-weighted lateral resistance, slamming impulses + events; depth-attenuated wave orbital velocity; wave LOD by point footprint.
- `Propulsion.js`: throttle lever with 0.6 s engine inertia, prop thrust with immersion and ventilation (RPM spike), reverse efficiency, flat-plate rudder with stall and prop wash; wind force at the windage centre with gusts; procedural current.
- `Hull.js`: capsize monitor (past capsize angle for 2 s), fuel burn; integrity/flood placeholders for V3.
- Rapier rigid body with explicit mass/CoM/inertia, 4-piece convex hull colliders; 60 Hz step ~0.17 ms.
- Procedural Marlin model: coloured hull (antifouling, boot-top, rub rail), bulwark, rails, hollow wheelhouse with glass/console/wheel, mast + rotating radar, tow bitt, fenders, liferings, hull numbers, prop + rudder, named empties. Blender generator + validator in `tools/blender/` (untested here).
- Cameras: chase (spring, horizon level, speed-scaled distance/FOV), helm (first person), orbit; C cycles; slam shake.
- Instrument cluster HUD: compass tape, speed, throttle lever + RPM (ventilation warning), rudder, heel inclinometer (warn 70% / critical 90% of capsize angle), fuel, hull, flood + pump.
- Dynamic foam render target (256², 200 m): stern wake, Kelvin bow-wave arms, hull contact, prop wash, ventilation churn, slams. Spray particles (bow spray at speed, slam bursts, ventilation) lit by sun and sky.
- Audio: Web Audio buses; diesel engine synth following RPM/load/ventilation; sea wash, spray hiss, wind band; hull slam one-shots.
- Tests: all section-4 Marlin targets + Rough-sea seakeeping in `test:physics`; verify drives the boat for 20 s and checks speed, flotation, throttle steps and camera cycling; V2 screenshots.
- Debug: F9 buoyancy points; overlay shows buoyancy/boat/spray stats. Dev tool `scripts/tune-boat.mjs`.

## V1 decisions (moved from PROGRESS)
D1 amplitude ∝ λ · D2 physics waves 8 → 12 · D3 inverse-displacement iterations 3 → 5 · D4 phase-continuous weather transitions · D5 GPU wave time offset matches interpolated bodies · D6 geometric ocean grid with vertex/pixel wave LOD · D7 Preetham sky scaled ×0.3 · D8 camera-style auto-exposure · D9 black-preserving contrast · D10 Jacobian foam thresholds per sea state · D11 Calm cloud cover 0.45 · D12 fonts stubbed in Playwright · D13 PBR objects use FogExp2 synced to the height fog · D14 dependency versions.

## V1 — Ocean & sky
- Vite + Three.js project, fixed 60 Hz loop with render interpolation, input, event bus, seeded RNG.
- `Waves.js`: 16-component Gerstner model generated from sea state (log-uniform wavelengths, ±40° spread, deep-water dispersion, Hs-scaled amplitudes). CPU `heightAt` / `normalAt` / `velocityAt` with 5-iteration inverse displacement; phase-continuous transitions.
- Ocean: camera-following geometric grid to 14 km, Gerstner vertex displacement from the same uniforms, per-pixel analytic normals, two procedural detail normal maps, Fresnel sky reflection (cube env), subsurface scatter on backlit crests, sun glitter, Jacobian crest foam + storm whitewater + wind streaks, height fog.
- Sky: Preetham sky, procedural fbm cloud dome (coverage/darkness by weather, sun-lit, silver lining, horizon haze), day/night cycle (24 real minutes per day), moonlight, env cube refresh every 2 s + PMREM.
- Weather: five sea states with 60 s smooth transitions (F6 in debug).
- Rain streaks (one draw call, wind-slanted), lightning (flash envelope, directional light, bolt ribbon).
- Post: bloom (high threshold), ACES output, colour grade (weather saturation/contrast, black-preserving S-curve), vignette, SMAA/FXAA by quality preset; auto-exposure.
- Debug: `?debug=1`, F3 overlay, F6 sea state, F7 +3 h, `window.__game`.
- Tooling: `npm run test:physics` (CPU/GPU wave agreement, Hs, transition continuity), `npm run verify` (build + physics + Playwright smoke + screenshots, ~55 s), `scripts/shots.mjs` dev screenshot tool.
