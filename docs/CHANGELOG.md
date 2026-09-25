# Changelog

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
