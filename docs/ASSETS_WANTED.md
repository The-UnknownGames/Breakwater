# Assets wanted

The cloud sandbox can't download assets, so everything in the game is built in code and **works without any of these files**. Drop a file in and the game upgrades itself; remove it and the built-in version comes back. Every file listed here must be **CC0 or CC-BY** (put the credit in the manifest entry).

All models are glTF binary (`.glb`), metres, Y up. They go under `public/models/` and must be listed in `public/models/manifest.json`. The game only fetches listed files, so there are no 404s.

---

## 1. Player boats (highest priority)

Covered in detail in `docs/MODELS.md` (manifest format, auto-fit, credits). In short: one `.glb` per boat, any orientation and scale (auto-fitted to the hull length, bow forward, keel at the design draft). The hull physics stays parametric; the model is only the look.

| Boat | What | Poly budget | Search terms |
|---|---|---|---|
| Marlin | 12 m aluminium / GRP workboat with a wheelhouse forward, open aft deck | ≤ 60k tris | "workboat", "pilot boat", "patrol boat", "landing craft utility" |
| Kestrel | 7.5 m rescue RIB with a centre console and A-frame | ≤ 40k tris | "RIB", "rigid inflatable boat", "rescue boat" |
| Bulwark | 22 m harbour tug, ideally ASD (twin azimuth pods aft) | ≤ 90k tris | "tugboat", "harbour tug", "ASD tug" |

## 2. Townspeople (V7): a rigged humanoid

Used for everyone in town (standing, fishing, strolling). Until then the game uses simple silhouettes kept at a distance.

- **File:** `public/models/people/townsperson.glb`
- **Manifest entry:** `{ "id": "townsperson", "file": "people/townsperson.glb", "height": 1.75, "credit": "Name, license, URL" }`
- **Rig:** any humanoid skeleton, skinned, one mesh (or a few). Clothing that fits a cold harbour town (work jacket, jumper, oilskins, boots).
- **Animations** in the same file, named so they can be found: one containing `Idle` and one containing `Walk` (for example `Idle`, `Walk`). A `Talk` or `Wave` clip is welcome for V9.
- **Poly budget:** ≤ 8k tris (there can be 20+ on screen), one 1024² texture at most.
- **Scale:** any; it is scaled to `height` metres.
- **Search terms:** "rigged low poly character CC0", "Quaternius character pack" (CC0), "Kenney character" (CC0), "Mixamo-compatible CC0 character".

## 3. Story cast (V9, not needed yet)

Five named characters (the harbormaster Maggie Rourke, the rival Tomas Crane, the insurance investigator Iona Blair, the deckhand Dev Okafor, and "The Buyer"). The same spec as the townsperson (same skeleton and clip names preferred, so animations can be shared), one file each, e.g. `people/maggie.glb`, with manifest ids `cast-maggie`, `cast-crane`, `cast-iona`, `cast-dev`, `cast-buyer`.

## 4. Town buildings (V13 realism pass, optional)

A northern harbour-town kit: terraced stone/rendered houses, a pub, a warehouse or fish market shed, a small office, a slate or corrugated roof set, doors and window frames.

- **Poly budget:** ≤ 15k tris per building, shared textures (trim sheet), ≤ 2048² per texture set.
- **Scale:** metres, ground floor at y = 0, front of the building facing +Z.
- **Search terms:** "modular town kit CC0", "Kenney city kit" (CC0), "fishing village buildings", "harbour town low poly".
- The walkable layout (doors, counters, walls) stays in code (`src/config/town.js`), so buildings would need to roughly match those footprints; the procedural buildings remain as the fallback.

## 5. Radio station music (V8, optional)

Folk / acoustic and slow ambient / lo-fi tracks for the two music stations in the wheelhouse radio. Without files, both stations use synthesized music.

- **Files:** `public/audio/stations/folk/*.mp3` and `public/audio/stations/ambient/*.mp3` (OGG also fine), listed in `public/audio/stations/manifest.json` as `{ "folk": ["file.mp3", ...], "ambient": [...], "credits": { "file.mp3": "Artist, license, URL" } }`.
- **Length:** 2–5 minutes each; 6–10 tracks per station is plenty.
- **License:** CC0 or CC-BY (not NC or ND).
- **Search terms:** "CC0 folk guitar", "CC-BY acoustic sea shanty instrumental", "CC0 ambient lo-fi", Free Music Archive filtered by CC-BY.
