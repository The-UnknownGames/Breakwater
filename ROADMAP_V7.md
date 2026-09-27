# BREAKWATER — Roadmap V7+ : "Boat Life"

**Goal:** turn Breakwater from a rescue/salvage sim into a living open world, a boat-life version of GTA. The sea and the boats stay the heart of it, but the world around them should feel inhabited, reactive, and full of things to do, with a story pulling you through it.

This document is a handoff for a **fresh session**. Read it together with `GAME_SPEC.md`, `docs/PROGRESS.md`, and `DEVLOG.md`.

---

## 0. Context for the new session

- **State:** V1–V6 are complete (see `DEVLOG.md`). There are 7 boats, 7 ports, a 10 × 10 km map, 6 rescue/salvage job types plus RP jobs (ferry timetables, charters, fishing, hired crews), a weather forecast system, night play, gamepad and phone support, and `npm run verify` passing in about 134 s.
- **Keep every rule in `GAME_SPEC.md` section 0:** autonomy, no stalling, balance authority, fast verification, and PROGRESS hygiene.
- **The verify budget is nearly full** (134 of 180 s). New features get **light** smoke tests. Move slow or rarely-failing checks into a separate `npm run verify:full` that runs once per milestone, not every commit.
- **The cloud sandbox cannot download assets.** Anything that needs downloaded models, character meshes, or audio must be designed so the game works without it and upgrades automatically when the human drops files into `public/models/` or `public/audio/`. List every wanted asset in `docs/ASSETS_WANTED.md` with a spec: what it is, approximate poly budget, scale, license requirement (CC0 or CC-BY), and suggested search terms.
- **Scope discipline:** this roadmap is big. Do the milestones **in order**. Each one should leave the game better and shippable. Never have a half-built system across a milestone boundary.

---

## 1. Design pillars (what "GTA of boats" means here)

1. **A world that lives without you.** Boats have schedules, towns have routines, weather has consequences, and other people do the same jobs you do.
2. **A reason to keep going.** A story with characters, a rival, and a slowly revealed plot, plus a company you build.
3. **Freedom and mischief.** Legal work pays steadily; grey work pays more and brings heat. The player chooses.
4. **Ownership and identity.** Your boats, your liveries, your house, your dock, your name on the hull.
5. **Moments.** Whales breaching at dawn, a rogue wave, racing a rival to a mayday, a lighthouse sweeping through fog. Systems that combine into stories you'd clip and share.

---

## 2. Milestones

### V7 — Life ashore (on foot)
The single biggest step toward the GTA feel: being able to step off the boat.

- **First-person on-foot mode** (no character model needed, which avoids the asset problem).
  - WASD walk, Shift jog, mouse look, head bob.
  - Footstep sounds by surface: wood planks, concrete, gravel, deck plating.
  - Collision with piers, buildings, and boat decks.
  - Walking **on your own boat's deck while it moves** (the player is parented to the boat frame, and the deck pitches under you). Only allowed when moored or anchored in calm water, for safety and simplicity.
- **Boarding and leaving:** E at the helm to take the wheel or stand up. Step from the pier to a moored boat. Lines are thrown automatically when you dock slowly next to bollards.
- **Kettle Harbor gets a walkable town:**
  - Waterfront street, the harbormaster's office (job board), shipyard office (shop), a pub, a fuel dock kiosk, your house, a fish market, and a chandlery (gear shop).
  - Doors with simple interior rooms. It's fine if interiors are small; they should be convincing.
  - Lit windows at night, streetlights, parked cars, and a coastal road with the occasional car driving past.
- **Townspeople** at distance and as silhouettes, until character models are supplied:
  - Placeholder human figures built from simple shapes, **never seen up close**: people on piers, fishermen on the breakwater, pub windows with movement.
  - When the human supplies rigged characters (`ASSETS_WANTED.md`), they're used automatically.
- **Other ports** get a walkable pier plus 2–3 buildings each. Full towns only for Kettle Harbor in V7.
- **Acceptance:** dock at Kettle Harbor, walk from the boat to the pub, the shipyard, and the house, then back to the boat and cast off, with no loading screens and no falling through the world. Screenshots of the town at noon and at night.

### V8 — Phone, radio, and voice
The GTA-style interface to the world.

- **In-game phone** (P key or a gamepad button). A realistic smartphone UI styled like a real phone OS, not neon. Apps:
  - **Messages:** story characters text you, jobs arrive as texts from contacts, and the rival taunts you.
  - **Contacts:** call characters to take jobs or story missions.
  - **Bank:** balance, transaction history, loans.
  - **Weather:** a forecast app with a 2-day marine forecast and wave charts.
  - **Tides & Charts:** a quick map with bookmarks.
  - **Market:** buy and sell used boats (randomized listings with condition and hours), fish prices by port, and parts.
  - **Camera:** photo mode that saves to an in-game gallery.
  - **"Harbour Life" social feed:** your photos plus NPC posts about events in the world ("Saw the *Wren* get towed in by @player, legend"), reacting to what you actually did.
- **Voice:** use the browser's built-in speech synthesis (Web Speech API `speechSynthesis`) for VHF radio calls, maydays, the coastguard, and the marine weather broadcast.
  - Run it through a Web Audio radio filter: band-pass 300–3000 Hz, light distortion, static, and squelch.
  - Pick different voices and pitches per character.
  - Always shown as subtitles too, and there's a setting to turn voice off.
- **Radio stations in the wheelhouse** (a knob or keys to cycle):
  - **VHF 16** (live maydays and traffic).
  - **Coastal Weather** (a spoken forecast every in-game hour).
  - **2 music stations** of procedurally generated music (a folk/acoustic generator and a slow ambient/lo-fi generator, both Web Audio synthesis). If music files are added to `public/audio/stations/`, stations play them instead.
  - Station audio muffles through the wheelhouse walls when you're on deck.
- **Acceptance:** a mayday arrives as spoken radio plus subtitles, the phone opens and every app works, and the social feed shows a post reacting to a job you just finished.

### V9 — Story & characters
- **Cast** (each has a phone contact, a voice, and a location in town):
  - **Maggie Rourke:** the harbormaster. Tough, fair, your first employer.
  - **Tomas Crane:** owner of *Crane Marine Salvage*, your **rival**. He competes for the same maydays and salvage.
  - **Iona Blair:** an insurance investigator who pays for evidence (photos) of suspicious wrecks.
  - **Dev Okafor:** a young deckhand who joins your company and becomes your first hired crew.
  - **"The Buyer":** an unnamed contact who offers grey work (section V10).
- **Main story, 3 acts, about 15–20 missions.** A string of "accidental" sinkings in the Grey Reach turns out to be insurance fraud, with Crane involved. Missions use existing systems in new combinations:
  - Race Crane's boat to a mayday.
  - Tow a scuttled yacht in before Crane's crew can "lose" it.
  - Photograph a hull breach for Iona.
  - A night storm rescue of Crane's own crew when his boat founders (your choice whether to help: consequences either way).
  - A final salvage of evidence from a wreck in a storm.
- **Mission structure:**
  - Story missions are offered by text or call and start from a marker.
  - Mission-specific objectives and radio dialogue.
  - Checkpoints.
  - Failure and retry.
  - A small cutscene system using the existing cameras (scripted camera paths plus subtitled dialogue, and skippable).
- **The rival is systemic too:** Crane's salvage boat is a real AI vessel that responds to maydays. If he gets there first, he gets the job and the pay. The rivalry exists even outside missions.
- **Acceptance:** Act 1 (5–7 missions) is playable start to finish with saves between missions. The rival AI boat competes for a normal mayday at least once in a verify scenario.

### V10 — Grey work, heat, and the law
The GTA "trouble" layer, kept to maritime themes.

- **Rules of the water, enforced:**
  - No-wake zones in harbors (speed limits on the chart and buoys).
  - Running without nav lights at night.
  - Collisions with other vessels.
  - Towing without a permit for big contracts.
- **Harbor Patrol and Coastguard boats** that respond:
  - Loudspeaker warning, then a fine, then a boarding.
  - A **heat level** (0–5 anchors on the HUD).
  - Evading patrol means breaking line of sight (fog, islands, night with lights off) and staying away until heat decays.
  - Getting boarded with contraband means confiscation plus a fine, and your boat is impounded until you pay.
- **Grey work from The Buyer:**
  - Night cargo runs (unmarked crates from a ship offshore to a hidden cove).
  - "Recovering" salvage before its legal owner does.
  - Moving people's boats with no questions asked.
  - Pays 2–3× legal work, and raises heat and suspicion.
- **Reputation splits** into **Harbor standing** (legal, unlocks legit contracts) and **Street standing** (grey, unlocks Buyer jobs). Some story branches depend on these.
- Nothing graphic. This is smuggling, speeding, and evasion, not violence. No weapons.
- **Acceptance:** a speeding violation in the harbor triggers a warning then a fine; a Buyer run at night with lights off can succeed or get boarded depending on play.

### V11 — Living world & wildlife
- **Wildlife:**
  - Gulls following trawlers and your boat when it has a fish catch.
  - Seals on rocks that slip into the water when you get close.
  - Dolphins bow-riding at speed in calm water.
  - Whales breaching offshore in dawn and dusk hours.
  - Puffins on cliffs.
- **World events** (random, announced on radio and the social feed):
  - Regattas (sailboat races you can watch or join with a sailboat).
  - A fishing derby.
  - A ferry breakdown with 60 passengers.
  - An oil spill (containment boom towing job).
  - A ship aground on a reef (multi-stage salvage).
  - Fog banks rolling in.
  - A rare **rogue wave** in storms.
  - A town festival night with lights and music.
- **NPC life:**
  - Fishermen leave at dawn and return with catch in the afternoon.
  - The ferry keeps its timetable.
  - Pub windows fill up at night.
  - Traffic on the coastal road.
  - Sunday is quieter.
  - The town reacts to storms: boats stay in, and people clear the piers.
- **Competitors:** Crane Marine plus 1–2 smaller salvage crews answer maydays. How fast you respond matters.
- **Acceptance:** over one simulated game day (headless, accelerated), fishermen leave and return, the ferry keeps its timetable, and at least 2 world events fire. Screenshots of wildlife.

### V12 — Ownership, customization & business
- **Livery editor:** hull color, stripe color, boot-top, deckhouse color, and name and hull number painted on the transom and bow. Presets plus custom colors. The name shows on the social feed and the radio ("*Marlin*, this is Kettle Harbor…").
- **Property:**
  - Buy a better house (a garage with a workbench shows your trophies and photos).
  - Dock slips in each port (a place to leave boats and spawn there).
  - A warehouse that stores salvaged goods to sell when prices are high.
  - Eventually buy out a failing port business as a second base.
- **Company:**
  - Expand hired crews into fleet management: assign boats to contracts, pay wages, and upgrade crews' skills.
  - Crews earn passive income but can have incidents (already exists: breakdowns).
- **Economy depth:**
  - Fuel prices differ by port and change with events.
  - Fish market prices fluctuate.
  - Boat insurance (pay premiums, get covered for sinking).
  - Loans with interest.
  - Buying used boats with hidden problems.
- **Acceptance:** repaint and rename a boat and see the name on the hull, the radio, and the social feed. Buy a dock slip and a house; a hired crew earns money over an in-game day.

### V13 — Realism pass (visuals & presentation)
- **Assets:** swap in any human-supplied models from `ASSETS_WANTED.md`. Hull physics stays parametric, and models are fitted to its waterline.
- **Ocean upgrades:**
  - An **FFT ocean** option (a WebGL2 render-to-texture FFT) for the High/Ultra presets, with Gerstner as the fallback.
  - Shoreline wave breaking.
  - Rain ripples.
  - Better foam persistence.
- **Wet surfaces:**
  - Decks, piers, and roads get darker, glossier materials when it rains, with puddle reflections on piers.
  - Water running off the boat after big waves.
  - Water sloshing on deck when flooding.
- **Atmosphere:**
  - Volumetric light shafts through clouds at golden hour.
  - Stars, the Milky Way, and a moon disc on clear nights, with moonlight on the water.
  - Thicker fog layers that sit on the water.
- **Cinematic tools:**
  - A replay system that records the last 60 s and plays back with free camera (GTA's Rockstar Editor, lite).
  - A "sinking cam" slow-motion moment when a boat founders.
  - Photo mode filters: film grain, lens settings, depth of field.
- **Acceptance:** a storm-night screenshot and a golden-hour screenshot that hold up next to real photos. Replay of a slam or a rescue plays back correctly.

---

## 3. Stretch ideas (after V13, pick based on fun)

- **Diving:** on-foot extension to salvage wrecks underwater (dark, murky, flashlight).
- **Sailing:** a proper sail model (tacking, heeling, trim) for the sloop.
- **Racing league:** powerboat racing with the Kestrel on marked courses around the islands.
- **Co-op multiplayer:** a second player crews your boat (winch and searchlight while you drive). A big infrastructure job; only if everything else is solid.

---

## 4. Assets the human will need to supply (the agent keeps `docs/ASSETS_WANTED.md` current)

- **Player boats first:** Marlin (workboat), Kestrel (RIB), Bulwark (tug).
- **Rigged human characters** for townspeople and the story cast. A rigged, CC0/CC-BY humanoid plus basic animations (idle, walk, talk).
- **Town buildings:** a harbor town kit (houses, warehouses, a pub, an office).
- **Optional:** licensed or CC music for the radio stations.

Everything must work without these files and upgrade automatically when they appear.
