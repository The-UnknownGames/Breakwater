# Breakwater — Progress

## Current milestone
**V2 — Boat physics: complete.** Next session starts **V3 — Towing & rescue mechanics**.

## NEXT (V3)
1. `TowLine.js`: spring-damper with slack (k from 15% stretch at break), snatch loads, 0.25 s / 1.5× break rules, winch Q/Z (10–120 m), auto-tension upgrade hook. Attach with Space (8 m, < 3 kn) at the `towPoint`/`bowCleat` empties.
2. `RopeVisual.js`: 40-node Verlet rope, floats on the surface, straightens and drips when taut.
3. `TowTarget.js`: sailboat + trawler hulls reusing `HullShape`/`BoatPhysics` (32 buoyancy points, no engine).
4. Survivors (bobbing, drifting), life raft, pull-aboard (E), hypothermia timers, capacity.
5. Flooding (deck-edge immersion, free-surface shift), pumps, hull damage + grounding (needs seabed stub until V4 depth map), repairs.
6. Tow panel HUD; F8 scenario spawner.
7. Physics tests: Marlin tows trawler ~8 kn; snatch ratio > 2× in Rough; break at rating; auto-tension −30% peak.
8. Scripted scenario test (autopilot helper) for one tow and one rescue.

## Known issues
- Night storm readability waits on V5 lights (searchlight, running lights, flares).
- Marlin still rolls ±5–10° in Calm chop at speed (quartering sea near roll resonance). Acceptable, tender realistic hull; revisit if it feels wrong in play.
- Storm at full throttle heels 40–55° but rarely capsizes within 90 s: storms become truly dangerous once V3 flooding (deck-edge water + free surface) lands.
- Close-range crest foam texture reads slightly "marbled".
- Hull-number decals are small; barely visible in chase view.
- Headless verify renders at ~4 fps, so the sim runs at half speed there (MAX_STEPS cap); real play is 60 Hz.
- Blender is not installed in the cloud env: `tools/blender/generate_boats.py` is written but untested; the game uses the procedural model (manifest lists no .glb).

## Screenshot review (`docs/shots/`)
- `v1-calm-noon.png`, `v1-rough-golden.png`, `v1-storm-night.png`: unchanged from V1 (see CHANGELOG).
- `v2-rough-pitching.png`: Marlin side-on in Rough, bow lifting over a swell. Model is clean but plain (procedural).
- `v2-wake.png`: turbulent white wake with breakup and faint Kelvin arms. Wake could be narrower near the transom.
- `v2-bow-spray.png`: head seas in Rough; slam spray lit grey-white by the overcast. Spray particles are soft discs; fine at gameplay distance.

## Decisions (V2)
- **D15 Hull form:** one parametric hull (superellipse sections, `HullShape.js`) shared by rendering, voxelization, colliders and the Blender generator, so visual and physics waterlines always match.
- **D16 Marlin draft 0.75 → 0.55 m, fullness 2.8 → 2.0:** at 0.75 m the hull displaced 17.9 m³ vs the 8.8 m³ that 9 t needs. Now the volume scale factor is 0.94 (physically consistent) instead of 0.49.
- **D17 Voxel symmetry:** starboard half clustered then mirrored (60 points) — removes a 0.3° spurious static heel.
- **D18 Wave kinematics:** orbital velocity decays with depth, exp(−k·depth), per component. Surface velocity at every point made short chop yank the hull sideways.
- **D19 Physics wave LOD:** components shorter than ~4× the buoyancy point spacing (~1.6 m) fade out of the physics sample (same smoothstep as the shader's vertex LOD). Ripples are visual-only as the spec says.
- **D20 Heave damping in world space:** vertical drag acts on world-vertical velocity relative to the water. In the hull frame, forward speed on a trimmed hull became a 60+ kN fake "lift" that rolled the boat over at speed (capsized in Moderate).
- **D21 Speed-dependent damping + skeg:** sway/heave linear damping grows with forward speed (hull lift damping), and lateral resistance is weighted aft (aftBias 0.9) for directional stability; kills the 39° snap-roll when putting the helm hard over at full speed (now a steady 8°).
- **D22 Reverse thrust:** efficiency 0.45 × a factor that falls with forward speed (1 − 0.6·v/vProp, min 0.3) instead of rising; with the spec's formula the Marlin stopped in 23 m vs 60 m.
- **D23 Prop wash on the rudder only when going ahead** (the rudder is behind the prop). Makes reverse steering weak, per spec.
- **D24 Marlin tuning (before → after):** thrustMax 21 kN → 9.2 kN, vPropMax 13.8 → 26 m/s, long drag 70 → 21, rudder area 0.5 → 0.25 m², washK 1.6 → 1.0, VCG 0.62 → 0.9 m, roll gyration 0.36B → 0.25B, vertical lin damping 30 000 → 4 000. Results: 21.6 kn, 11.6 s to 15 kn, 57 m stop, 3.3 L circle, 4.96 s roll, 66.7° vanishing angle.
- **D25 Hollow wheelhouse:** walls built around window openings with glass, console, wheel and seat, so the helm camera sees out.
- **D26 Input press counting:** key presses are counted (not a set), so several W presses within one frame all register.
- **D27 Model manifest:** `public/models/manifest.json` lists generated .glb files; the loader only fetches listed models (no 404s), else procedural.
- Earlier V1 decisions D1–D14: see `docs/CHANGELOG.md`.

## Polish backlog
- Rain impact ripples, lens droplets, helm window rain, storm front wall — V5.
- Breaking-crest spray in storms — V5.
- Stars and moon disc on clear nights.
- Shallow-water colour + shore foam need the depth map — V4.
- Engine sound voicing for Kestrel (outboard) and Bulwark (slow diesel) — V4.
- Planing lift (Kestrel) — V4.
- Wiper animation in helm view.
- Water on deck visuals when flooding (V3).
