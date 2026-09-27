# Breakwater

A realistic storm-salvage, sea-rescue and boat-RP game in the browser (Three.js + Rapier). Tow disabled vessels, pull people out of the water, run ferries and freight, fish, and build a fleet on the Grey Reach: a 10 × 10 km archipelago with seven ports, weather that follows a forecast, and nights you need a searchlight for.

See `GAME_SPEC.md` for the design, `docs/PROGRESS.md` for status and open issues, and `docs/CHANGELOG.md` for history.

**Play online:** https://the-unknowngames.github.io/Breakwater/ (GitHub Pages, deployed from this branch).

## Install and run

Requires Node 20+.

```sh
npm install
npm run dev           # http://localhost:5173
npm run build         # production build in dist/
npm run preview       # serve dist/ on http://localhost:4173
```

Checks:

```sh
npm run verify        # build + physics tests + economy sim + headless browser smoke test and screenshots (< 3 min)
npm run test:physics  # headless physics, career, weather and performance tests
npm run sim:economy   # career pacing simulation (section 8.5 targets)
npm run perf          # draw calls, triangles and CPU time per preset and scene
npm run artifact      # single-file build for the Claude artifact + the GitHub Pages site
```

## How to play

You start at Kettle Harbor with the Marlin, a 12 m rescue workboat, and $1,500. The first job walks you through a tow. After that the radio and the job board (Tab) bring maydays and work: people in the water, life rafts, crew off a sinking trawler, disabled and swamped vessels, containers adrift, and (with the right boats) passenger timetables, charters, cargo contracts and fishing. Pay rises with the weather. Spend it at the shipyard on upgrades and boats, hire crews to run the boats you're not driving, and keep an eye on the forecast.

Heavy weather tips: come up into the wind to stop alongside someone; from 4–14 m throw a lifebuoy (E) and the line hauls them in; at night light the searchlight (L) and fire a flare (R).

## Controls

| Key | Action |
|---|---|
| W / S | Throttle lever up / down (stays set; hold to move smoothly) |
| X | Throttle to neutral |
| A / D | Rudder (Shift holds it) |
| Space | Pass the tow line (stern within 8 m of her bow, under 3 kn) / cast off |
| Q / Z | Winch: pay out / haul in |
| F | Chain the next container behind the one in tow |
| E | Pull aboard, throw a lifebuoy, take off crew, pump hose, port services |
| T | Autopilot to the waypoint or job (upgrade) |
| M | Chart (click to set a waypoint) |
| Tab | Job board |
| C | Camera: chase / helm / orbit |
| L | Searchlight on / off (aims where you look) |
| R | Fire a parachute flare (restock at a fuel port) |
| N | Let go / weigh the anchor |
| G | Shoot / haul the nets (Kittiwake, on a fishing ground) |
| P | Photo mode |
| Esc | Pause (Settings, Controls, Save & Quit) |

**Gamepad** (standard mapping): left stick steers, RT / LT throttle ahead / astern, A = E, X = Space, B = F (chain), Y = camera, LB / RB winch in / out, d-pad up searchlight · down flare · left job board · right anchor, View = chart, Menu = pause, left-stick click = neutral, right-stick click = autopilot. In menus and panels the d-pad moves a focus ring, A presses and B backs out.

**Touch** (phones and tablets): a wheel on the left; the throttle lever and buttons (TOW, E, OUT / IN, JOBS, MAP, LIGHT, FLARE, CHAIN, NETS, ANCHOR, PHOTO) on the right.

## Settings

Pause → Settings: graphics preset (Low / Medium / High / Ultra; phones get their own gentler presets), master / effects / sea & weather / radio volume, field of view, chase camera horizon lock, gamepad status, and Reset career. Settings and the career save live in the browser's local storage.

## Boats

Marlin (rescue workboat), Kestrel (fast RIB, planes), Bulwark (tug, works a Storm), Kittiwake (trawler, fishing), Solace (yacht, charters), Islander (ferry, timetables), Northfarer (freighter, cargo). Downloaded glTF models can replace the built-in ones: see `docs/MODELS.md`.

## Debug

Add `?debug=1` to the URL:

- **F3** overlay (fps, frame and physics time, draw calls, buoyancy points, sea state, waves) · **F6** cycle sea state · **F7** +3 h · **F8** scenario spawner · **F9** buoyancy points.
- URL options: `state=calm|moderate|rough|gale|storm|violent|hurricane`, `hour=0..24`, `freeze`, `quality=low|medium|high|ultra`, `boat=<id>`, `cam=chase|helm|orbit`, `heading=<deg>`, `look=<deg>&camY=<m>`, `scenario=trawler,survivors,...`, `autotension`, `tutorial`, `new` (fresh career), `traffic`, `seed=<n>`.
- `window.__game` exposes the game state and test helpers.

## Project layout

`src/core` game loop and sessions · `src/physics` buoyancy, propulsion, hull, tow line (pure JS + Rapier) · `src/ocean` waves, ocean shader, foam, wake, spray · `src/sky` day/night, weather, clouds, rain, lightning, storm front · `src/world` islands, harbors, nav aids, traffic · `src/gameplay` jobs, career, trade, fishing, fleet, weather chain, autopilot · `src/entities` boats, models, lights · `src/ui` HUD, menus, chart, job board, shipyard · `src/audio` synthesized sound · `src/config` every gameplay number · `scripts` tests, verify, perf, economy sim.

All art and audio are generated in code; no downloaded assets are required.
