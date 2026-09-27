# Tasks

## FEATURE
- [ ] (P1) V8 phone: Phone shell — P key opens/closes, realistic smartphone UI (flat, legible, no neon) — acceptance: P opens phone overlay, P/Esc closes it, visible at 1280x720 and on phone
- [ ] (P1) V8 phone: Messages app with threads per contact — acceptance: open phone, see 3 threads, new job arrives as text
- [ ] (P1) V8 phone: Contacts app — call characters to take jobs — acceptance: contacts list shows, tapping a contact triggers a call dialog
- [ ] (P1) V8 phone: Bank app — balance, transaction history, loans — acceptance: shows current money, loan can be taken, history lists transactions
- [ ] (P1) V8 phone: Weather app — 2-day marine forecast with wave charts — acceptance: shows forecast data from weatherChain, wave height chart renders
- [ ] (P2) V8 phone: Tides & Charts app — quick map with bookmarks — acceptance: mini chart opens, bookmarks can be placed
- [ ] (P2) V8 phone: Market app — used boats, fish prices by port, parts — acceptance: listings show with condition/hours, prices vary by port
- [ ] (P2) V8 phone: Camera app — photo mode saves to in-game gallery — acceptance: photo can be taken, appears in gallery
- [ ] (P2) V8 phone: "Harbour Life" social feed — reacts to what you did — acceptance: feed shows a post reacting to a job you just finished
- [ ] (P1) V8 voice: Web Speech speechSynthesis for VHF calls, maydays, coastguard — acceptance: mayday arrives as spoken radio plus subtitles
- [ ] (P1) V8 voice: Radio filter — band-pass 300-3000 Hz, static, squelch via Web Audio — acceptance: voice plays through radio effect, subtitles always shown
- [ ] (P2) V8 voice: Per-character voices and pitches — acceptance: different characters use different speechSynthesis voices/pitches
- [ ] (P2) V8 voice: Voice on/off setting — acceptance: setting mutes speechSynthesis, subtitles still appear
- [ ] (P1) V8 radio: Wheelhouse radio stations (knob/keys to cycle) — acceptance: knob cycles VHF 16, Coastal Weather, 2 music stations
- [ ] (P1) V8 radio: VHF 16 — live maydays and traffic — acceptance: mayday audio plays on VHF 16 station
- [ ] (P2) V8 radio: Coastal Weather — spoken forecast every in-game hour — acceptance: weather broadcast plays each game hour
- [ ] (P2) V8 radio: 2 procedural music stations (folk/acoustic, ambient/lo-fi) via Web Audio — acceptance: music plays, different per station
- [ ] (P3) V8 radio: Station audio muffles through wheelhouse walls when on deck — acceptance: volume/filter changes when on deck vs inside
- [ ] (P2) V9 story: Cast definitions — Maggie Rourke, Tomas Crane, Iona Blair, Dev Okafor, The Buyer — acceptance: 5 contacts with phone, voice, location in town
- [ ] (P2) V9 story: Act 1 missions (5-7) — race Crane to mayday, tow scuttled yacht, photograph hull breach — acceptance: Act 1 playable start to finish with saves
- [ ] (P3) V9 story: Rival AI boat (Crane's salvage) competes for maydays — acceptance: Crane's boat responds to maydays, gets there first sometimes
- [ ] (P3) V10 grey work: Rules of the water — no-wake zones, nav lights, collision enforcement — acceptance: speeding in harbor triggers warning then fine
- [ ] (P3) V10 grey work: Heat system (0-5), Harbor Patrol boats respond — acceptance: heat rises with violations, patrol boards at high heat
- [ ] (P3) V10 grey work: The Buyer — night cargo runs, grey jobs pay 2-3x — acceptance: Buyer jobs available, pay more, raise heat

## BUGFIX
- [ ] (P1) GPU fps on real hardware unverified — needs owner: F3 on GTX 1650 (High, 60 fps) and Iris Xe (Low, 40 fps) — acceptance: owner confirms fps targets met
- [ ] (P2) Bulwark pickups with test bot unreliable — headless bot can't reliably pick up survivors with Bulwark — acceptance: automated storm-rescue proof with Bulwark
- [ ] (P2) Survivors aboard sit still — no climbing animation, no seated crew animation — acceptance: survivors animate when boarding
- [ ] (P2) Tow-target collisions use simple convex hulls — contact-damage threshold is a guess — acceptance: collisions feel right, damage threshold tuned
- [ ] (P3) Blender model generators untested — tools/blender/ scripts have never been run — acceptance: at least one generator runs headless and produces valid .glb

## POLISH
- [ ] (P2) Rain impact ripples on water surface — acceptance: rain creates visible ripples on water
- [ ] (P2) Stars and moon disc on clear nights — acceptance: night sky shows stars and moon
- [ ] (P2) Water sloshing on deck when flooding — acceptance: flood water visible on deck, sloshes with boat motion
- [ ] (P3) Textured cobbles, roof tiles, interior details — acceptance: town surfaces have texture, not flat color
- [ ] (P3) Doors that swing open/close — acceptance: pub/house doors animate when opened
- [ ] (P3) Walking other vessels' decks (ferries at pier, anchored boats) — acceptance: can walk on ferry deck when moored
- [ ] (P3) On-foot: footstep timing matches movement, no sliding — acceptance: footsteps sync with walk cycle
- [ ] (P3) Camera: smooth transitions between chase/helm/on-foot — acceptance: no hard cuts when switching camera modes

## TEST
- [ ] (P1) Save/load round-trip test — save, reload, state matches — acceptance: automated test proves save integrity
- [ ] (P1) No NaN/Infinity in boat state after 60s simulated play in every sea state — acceptance: physics test covers all 7 sea states for NaN
- [ ] (P2) Every UI screen opens/closes with no errors (phone, chart, job board, shipyard, pause, settings) — acceptance: browser test opens/closes each UI
- [ ] (P2) Every job type completing in every valid sea state — acceptance: all 6 job types tested end-to-end
- [ ] (P2) Boat never falls below -5m without sinking state — acceptance: physics test guards against falling through world
- [ ] (P3) V8 acceptance: spoken mayday with subtitles — acceptance: test checks subtitle text appears with speech
- [ ] (P3) V8 acceptance: every phone app works — acceptance: test opens each app, checks content renders
- [ ] (P3) V8 acceptance: social feed posts about finished job — acceptance: test completes a job, checks feed for post

## VISUAL
- [ ] (P2) Run Blender generators headless, produce valid .glb for at least one boat — acceptance: .glb loads in game via manifest
- [ ] (P2) Screenshot suite: calm noon, golden hour, Rough, Gale storm day, Storm night — acceptance: npm run shots captures all views
- [ ] (P2) Screenshot suite: on-foot in Kettle Harbor day and night — acceptance: foot mode shots captured
- [ ] (P2) Screenshot suite: each UI screen (HUD, phone apps, chart, job board, shipyard) — acceptance: UI shots captured
- [ ] (P2) Screenshot suite: Low preset versions of calm noon and storm night — acceptance: low-quality shots captured
- [ ] (P3) Automated image checks: not blank, not mostly black/white, no forbidden neon colors — acceptance: shots script validates pixels
- [ ] (P3) Compare against previous run's shots: flag unexpected changes — acceptance: diff check in shots script

## PERF
- [ ] (P2) Harbor scene draw calls: currently ~130-250, budget 300 — acceptance: harbor stays under 300 with town
- [ ] (P2) Physics step time: currently 0.3ms, budget 4ms — acceptance: physics stays under budget with 3 containers in storm
- [ ] (P3) Reduce town draw calls (~40 currently) — acceptance: town merged further, fewer draw calls
- [ ] (P3) Per-frame allocation audit — no new Vector3/array literals in update loops — acceptance: code review confirms no per-frame allocs

## CODEHEALTH
- [ ] (P2) Split files over 400 lines — acceptance: all src files under 400 lines
- [ ] (P3) Remove dead code — prove unused by searching, then remove — acceptance: dead code removed, tests pass
- [ ] (P3) Dedupe repeated pattern — acceptance: pattern extracted to shared helper, tests pass
- [ ] (P3) Fix misleading names — acceptance: renamed for clarity, tests pass
