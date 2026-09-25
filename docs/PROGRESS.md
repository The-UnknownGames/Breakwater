# Breakwater — Progress

## Current milestone
**V1 — Ocean & sky: complete.** Next session starts **V2 — Boat physics**.

## NEXT (V2)
1. Rapier setup (`src/physics/PhysicsWorld.js`), headless-capable (no DOM imports) so `test:physics` can drive it.
2. Marlin procedural hull (fallback path first; Blender is not installed in the cloud env — check `blender --version` locally).
3. `Voxelize.js` + `Buoyancy.js` (64 pts), anisotropic drag, slamming; waterline test ±5 cm.
4. `Propulsion.js` (throttle inertia, prop wash, ventilation, rudder), wind force, `Hull.js` capsize.
5. Chase + helm cameras, instrument cluster HUD, dynamic foam RT (wake), spray, engine/sea audio.
6. `test:physics`: all Marlin targets from spec §4.

## Known issues
- Storm night without lightning is very dark (by design until V5 adds running lights, searchlight and flares). Revisit readability then.
- Close-range foam breakup texture has a slightly "marbled" look (ridged noise); replace with a dedicated foam pattern.
- Sky near the horizon in Calm is a touch pale/flat; cumulus are soft.
- Headless SwiftShader runs at ~4 fps, so fps is not measured in verify (per spec). Real-GPU perf pass is V6.
- Rain streaks near the camera can read as long smears at 4 fps (large dt); fine at 60 fps.

## Screenshot review (V1, `docs/shots/`)
- `v1-calm-noon.png`: convincing calm grey-green North Atlantic; sky slightly washed out, clouds faint. Acceptable.
- `v1-rough-golden.png`: warm low sun, glitter path, broken cloud. Whitecaps sparse at this angle (into the sun). Acceptable.
- `v1-storm-night.png`: lightning-lit storm, rain, crest foam, 400 m murk. Reads like storm footage. Bolt is slightly thick/uniform.

## Decisions
- **D1 Wave amplitude spectrum:** amplitude ∝ λ (constant-steepness tail, matches a Pierson–Moskowitz tail per log bin) instead of an arbitrary exponent. Components are stratified log-uniform in λ; index 0 is always the longest, and index order is stable across sea states.
- **D2 Physics wave subset 8 → 12:** with 8 components the physics surface differed from the rendered one by up to 0.84 m (Storm). With 12, max error is 0.30 m (RMS 0.12 m). Cost is small (400 pts × 12 waves). Spec says "may" use 8; 12 better serves "shader and physics never disagree". Revisit in V6 perf pass (Low preset could drop to 8).
- **D3 Fixed-point iterations 3 → 5:** 3–4 iterations gave 0.017 m CPU/GPU error in Storm (limit 0.02). 5 gives 0.005 m.
- **D4 Phase-continuous transitions:** each component keeps an accumulated phase; when the wave list changes, phase is compensated so it stays continuous at the anchor (camera/player). No popping or swimming near the player during 60 s weather transitions (tested: max per-frame height change 0.06 m).
- **D5 GPU/CPU sync:** physics advances waves at 60 Hz; the shader gets `uWaveTau = -(1-alpha)·dt` so the rendered surface matches interpolated body poses.
- **D6 Ocean mesh:** single grid with geometrically growing cell size (0.3 m → ~14 km), no seams; per-vertex wave LOD fades waves shorter than 4 cells; per-pixel normals use `fwidth`-based LOD.
- **D7 Preetham sky scale:** the Three.js Sky outputs ~4× the radiance of the rest of the lighting; scaled by 0.3 via a shader patch so clouds/fog/sea match it.
- **D8 Auto-exposure:** simple camera-style exposure `base·sqrt(ref/lum)`, clamped, adapting over 1.5 s and ignoring lightning. Storm days are exposed like real footage instead of going black.
- **D9 Contrast grading:** S-curve that keeps black at black (the 0.5-pivot contrast crushed nights to pure black).
- **D10 Foam thresholds:** weather `foam` = Jacobian threshold (Calm 0, Moderate 0.68, Rough 0.8, Gale 0.86, Storm 0.9) + crest-height whitewater in Gale/Storm + wind-aligned streaks.
- **D11 Calm cloud cover 0.35 → 0.45** so Calm isn't a featureless sky.
- **D12 Verify fonts:** Google Fonts are stubbed with empty CSS in Playwright so sandboxed runs don't fail on network/cert errors. System fallbacks are in the CSS stack.
- **D13 Standard-material fog:** only custom shaders (ocean, clouds, rain) use the height fog so far; PBR objects (V2+) need the same fog via an `onBeforeCompile` patch.
- **D14 Dependencies:** three ^0.180, rapier3d-compat ^0.19, vite ^7, playwright pinned to 1.56.1 (matches the pre-installed Chromium build).

## Polish backlog
- Rain impact ripples on the water (spec 2.5) — V5.
- Lens droplets, helm window rain — V5.
- Visible storm front wall — V5.
- Breaking-crest spray particles — V2 (Spray.js) / V5.
- Stars and moon disc on clear nights.
- Shallow-water colour + shore foam need the depth map — V4.
- Dynamic foam render target (wakes) — V2.
- Shadows: sun shadow fitted to the player boat — V2.
