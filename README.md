# Breakwater

A realistic storm salvage and sea rescue game (Three.js + Rapier). See `GAME_SPEC.md` for the full design and `docs/PROGRESS.md` for current status.

## Run

```sh
npm install
npm run dev          # http://localhost:5173
npm run verify       # build + physics tests + headless browser smoke test
npm run test:physics # headless physics / wave tests only
```

## Controls (so far)

| Key | Action |
|---|---|
| W / S | Throttle lever up/down in 10% steps (hold to move continuously) |
| X | Throttle to neutral |
| A / D | Rudder (returns to centre; hold Shift to lock) |
| C | Camera: chase / helm / orbit |
| Space | Pass the tow line (stern within 8 m of a target's bow, under 3 kn) / cast off |
| Q / Z | Winch: pay out / haul in (10–120 m) |
| E | Pull a survivor aboard (alongside, under 2.5 kn) / pass the pump hose |

## Debug URL parameters

- `?debug=1` enables F3 (overlay), F6 (cycle sea state), F7 (+3 h), F8 (scenario spawner: trawler, sailboat, sinking trawler, survivors, life raft, repair, clear), F9 (buoyancy points).
- `scenario=trawler,survivors,...` spawns F8 scenarios at start; `autotension` fits the auto-tension winch.
- `state=calm|moderate|rough|gale|storm`, `hour=0..24`, `freeze` (stop the clock), `quality=low|medium|high|ultra`, `look=<compass deg>&camY=<m>` (orbit camera framing), `heading=<deg>` (boat spawn heading), `cam=chase|helm|orbit`.

Full controls and a complete README arrive with V6.
