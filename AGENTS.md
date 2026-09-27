# AGENTS.md — Operating Manual for AI Agents Working on Breakwater

OpenCode loads this file automatically. **Read all of it at the start of every session.** It overrides your habits. When it conflicts with `GAME_SPEC.md` or `ROADMAP_V7.md`, this file wins on *process* and those files win on *what the game should be*.

You are running unattended, 24/7, in a loop on the owner's PC. No human is watching. Nobody will answer questions. A script starts you, gives you one task mode, and after you exit it independently runs `npm run verify`. **If verify fails after your session, the script throws your work away.** Small, correct, tested changes survive. Big, clever, untested changes get deleted.

---

## 1. The 20 golden rules

1. **One small task per session.** Finish it completely. A finished small thing beats an unfinished big thing, every time.
2. **Never ask the user anything.** Decide, log the decision in `docs/PROGRESS.md` → Decisions, and keep going.
3. **Read before you write.** Before editing any file, read the whole file. Before calling any function, find and read its definition. Never guess an API, a file path, a variable name, or a config key.
4. **Search before you create.** Before creating a new file, helper, or system, search the repo (`grep`/`rg`) for something that already does it. This codebase is large (V1–V7 are done). Duplicating an existing system is a serious bug.
5. **Make the smallest change that works.** No drive-by refactors. No renaming. No reformatting files you didn't need to touch.
6. **Run `npm run verify` before every commit.** If it fails, fix it or revert. Never commit red.
7. **Never weaken, skip, delete, or loosen a test to make it pass.** If a test is genuinely wrong, fix it *and* write in Decisions exactly why, with before/after.
8. **Never use debug cheats as proof.** Invincibility, teleports, time skips, and forced states can *set up* a scenario, but a feature only works if it works when reached normally.
9. **Look at the result.** Screenshots exist to be inspected. A test that passes while the screenshot shows something broken is a failed test.
10. **Commit early, commit often,** each commit one logical change, each commit green.
11. **Keep files under ~400 lines.** Split by responsibility when they grow.
12. **Numbers live in `src/config/`.** Never scatter tuning values through logic.
13. **Art rules are absolute:** no neon, no glow UI, no glassmorphism/blurred panels, no saturated purple/cyan/magenta, no emoji in the UI, no cartoon outlines. Photographic, cold North Atlantic realism. See `GAME_SPEC.md` §2.
14. **Performance is a feature.** Don't allocate in the per-frame loop. Don't add draw calls without instancing/merging. Don't add per-frame raycasts, traversals, or `querySelector` calls.
15. **Don't break phones.** Every visual feature needs a quality-preset gate and must degrade gracefully on Low.
16. **Assets you can't download must fail soft.** The game must run perfectly without any file listed in `docs/ASSETS_WANTED.md`, and must upgrade automatically when the file appears.
17. **If you're stuck for more than ~3 attempts on the same error, stop.** Revert your changes, log what you tried in `docs/PROGRESS.md` → Stuck log, and exit. The next session gets a fresh start.
18. **Never do anything outside this repo.** Don't touch other folders, system settings, global git config, or other programs. Don't install global packages.
19. **Never force-push, rewrite history, delete branches, or run `git reset --hard`/`git clean`.** The loop script handles recovery. You don't.
20. **Leave the repo better documented than you found it.** Update `docs/PROGRESS.md` and `docs/TASKS.md` at the end of every session.

---

## 2. Session workflow (follow these steps in order, every time)

### Step 1: Orient (always)
1. Read this file.
2. Read `docs/PROGRESS.md` completely: current milestone, NEXT, known issues, Decisions, Stuck log.
3. Read `docs/TASKS.md`.
4. Run `git status` and `git log --oneline -15` to see what recently changed.
5. If `git status` shows uncommitted changes you didn't make, **don't touch them.** Work around them, and log them in PROGRESS known issues.
6. Run `npm run verify` **once before changing anything.** If it's already failing, your task for this session becomes "make verify green" regardless of the mode you were given. Log it.

### Step 2: Pick exactly one task
- Pick the highest-priority unchecked task in `docs/TASKS.md` that matches your session mode (§4).
- If no task in your mode exists, create 3–5 good ones in that section from `ROADMAP_V7.md`, the polish checklist (§8), and known issues, then pick the top one.
- A task must be finishable in one session. If it isn't, split it into smaller tasks in TASKS.md and do the first piece.
- Mark it `[~] in progress (session <date>)` in TASKS.md.

### Step 3: Plan (write it down before coding)
Write a short plan in your head or as a comment in your reply. It must answer:
- What files will I change? (List them. Read each one fully first.)
- What existing systems do I hook into? (Name the functions and files. Confirm they exist by searching.)
- How will I prove it works? (Which test, which screenshot, which number.)
- What could this break? (Performance, other systems, phones, save files.)

### Step 4: Implement in small verified steps
- Change a little, then build (`npm run build`) to catch syntax/import errors immediately.
- After each meaningful step, run the fastest relevant test (a single physics test, a unit test) before moving on.
- Keep a mental list of every file you touched.

### Step 5: Test (§6)
- Add or update at least one automated check that would fail if your feature broke.
- Run `npm run verify`. It must pass and stay under its time budget.
- For visual work, run the screenshot script and inspect the results (§7).

### Step 6: Self-review (don't skip)
Run `git diff` and read every line you changed. Check for:
- Leftover `console.log`, debug flags left on, commented-out code, TODOs you could have finished.
- Hardcoded numbers that belong in `src/config/`.
- Anything allocated per frame (`new Vector3()`, array literals, closures inside `update`).
- Missing quality-preset gates, missing phone fallbacks.
- Art-rule violations (colors, glow, emoji).
- Broken save compatibility (new save fields need defaults for old saves).

### Step 7: Commit and document
1. `git add` only the files you meant to change.
2. Commit with a clear message: `V8: phone Messages app with story contact threads`.
3. Update TASKS.md: mark the task `[x]` with the date and commit hash. Add any follow-up tasks you discovered.
4. Update PROGRESS.md: what changed, any Decisions, any new known issues. Keep it under ~150 lines. Move old detail to `docs/CHANGELOG.md`.
5. Commit the doc updates.
6. `git push origin HEAD` (plain push only).
7. Exit. Don't start a second task. The loop will start a fresh session.

---

## 3. `docs/TASKS.md` format

Keep this file as the single task queue. Create it if missing.

```
# Tasks

## FEATURE
- [ ] (P1) V8 phone: Messages app with threads per contact — acceptance: open phone, see 3 threads, new job arrives as text
- [~] (P1) ... in progress (session 2026-09-28)
- [x] (P2) ... done 2026-09-28 abc1234

## BUGFIX
## POLISH
## TEST
## VISUAL
## PERF
## CODEHEALTH
```

- **P1** = blocks the current milestone or is a visible bug. **P2** = important. **P3** = nice to have.
- Every task has a one-line **acceptance** condition you can actually check.
- Bugs found by the owner (in `docs/OWNER_NOTES.md`, if it exists) are always **P1** and always go first in BUGFIX.

---

## 4. Session modes

The loop script tells you your mode. Do only that kind of work.

| Mode | What you do |
|---|---|
| **FEATURE** | The next roadmap item from `ROADMAP_V7.md`, in milestone order. Only move to the next milestone when the current one meets its acceptance criteria. |
| **BUGFIX** | Find and fix a real bug. Sources, in order: `docs/OWNER_NOTES.md`, failing or flaky tests, PROGRESS known issues, console errors/warnings during a smoke run, then hunting (§9). |
| **POLISH** | Make one existing thing feel or look better, using the polish checklist (§8). Must include before/after evidence (screenshot or measured number). |
| **TEST** | Increase coverage of something untested or under-tested. Prefer tests that catch real regressions: physics targets, save/load round trips, every job type completing, UI opening/closing, no NaNs over long runs. Keep `npm run verify` under budget; put slow tests in `npm run verify:full`. |
| **VISUAL** | Run the screenshot suite across times of day, weather, and presets. Compare against §7. Fix the single worst visual problem. |
| **PERF** | Run `npm run perf`. Find the single biggest cost and reduce it, with measured before/after. Never trade away visual quality on High/Ultra without a preset gate. |
| **CODEHEALTH** | One focused cleanup: split an oversized file, remove dead code (prove it's unused by searching), dedupe a repeated pattern, fix a misleading name. Behavior must not change; tests must prove it. |

---

## 5. Coding rules for this project

### 5.1 General
- ES modules, one statement per line, descriptive names, no single-letter names outside tiny loops and math.
- Before adding a dependency: don't. The allowed list is in `GAME_SPEC.md` §0. If something truly can't be done without one, log a Decision and pick the smallest well-known package.
- Match the existing code style of the file you're in.
- Every new system gets a short header comment: what it does, who calls it, what it depends on.

### 5.2 Three.js
- Reuse temp objects. Declare `const _tmpVec = new THREE.Vector3()` at module scope and reuse it in hot loops.
- Dispose geometries, materials, and textures you replace or remove. Leaks crash phones.
- Use `InstancedMesh` for repeated objects (people, crates, buoys, trees, particles).
- Merge static geometry by material.
- Shadows only on objects that matter up close. Tiny props don't cast shadows.
- Every new shader or post effect: add a quality-preset toggle, test on Low.
- Don't change the renderer's color space, tone mapping, or exposure setup without a Decision.

### 5.3 Physics
- The simulation runs at a fixed 60 Hz. **Never** put gameplay logic in the render loop, and never use frame time in physics.
- Wave height comes from `Waves.js` only. Never compute water height any other way.
- Hull physics is parametric. Visual models are fitted to it and never drive physics.
- Every physics change must keep `npm run test:physics` green. If you change a coefficient, record before/after in Decisions.
- Guard against NaN: after any new force calculation, check for finite values in tests.

### 5.4 UI
- Follow the "marine instrument" and "chart paper" styles in `GAME_SPEC.md` §2.3. The phone (V8) must look like a real modern smartphone OS: clean, flat, legible. No neon, no glowing edges, no glass blur.
- Everything must work with keyboard, gamepad, **and** touch.
- Text must stay readable at 1280×720 and on a phone.
- Numbers use tabular figures.

### 5.5 Save data
- Any new saved field needs a default so old saves still load. Add a save/load round-trip test for it.
- Never rename or delete existing save fields. Migrate instead.

### 5.6 Audio
- Web Audio synthesis only unless a file exists in `public/audio/`.
- Every new sound goes through the existing mixer buses and respects the volume sliders.
- `speechSynthesis` (V8 voice) can't be routed through Web Audio. Fake the radio effect with static/squelch layered around it, as already decided in PROGRESS.

---

## 6. Testing rules

### 6.1 Test layers
| Command | Budget | When |
|---|---|---|
| `npm run build` | seconds | after every meaningful edit |
| `npm run test:physics` | < 60 s | any physics change |
| `npm run verify` | **< 180 s total** | before every commit |
| `npm run verify:full` | any length | end of every milestone, and in TEST mode |
| `npm run shots` | any length | VISUAL and POLISH modes, end of milestones |
| `npm run perf` | any length | PERF mode, end of milestones |

If `verify:full`, `shots`, or `perf` don't exist yet, creating them is a valid TEST task.

### 6.2 What a good test does
- Fails if the feature breaks. (Temporarily break the feature and confirm the test fails. Then un-break it.)
- Checks outcomes, not implementation details. "Job paid $2,100 and reputation rose by 3," not "function X was called."
- Is deterministic. Use seeds. No real-time waits where a simulated step count works.
- Is fast. Simulate faster than real time headlessly when possible.

### 6.3 Always-on sanity checks (add these to verify if missing)
- No page errors or console errors.
- No NaN or Infinity in any boat's position, velocity, or rotation after 60 s of simulated play in every sea state.
- Boat never falls below −5 m without being in the sinking state.
- Save → reload → state matches.
- Every UI screen (phone, chart, job board, shipyard, pause, settings) opens and closes with no errors.

---

## 7. Visual QA

### 7.1 Screenshot suite (`npm run shots`)
It should capture, at minimum, into `shots/<date>/`:
- Calm noon, golden hour, Rough, Gale storm day, Storm night with searchlight and flare.
- Chase camera, helm camera, on-foot in Kettle Harbor (day and night).
- Each UI screen: HUD, phone (each app), chart, job board, shipyard.
- Low preset versions of the calm noon and storm night.

### 7.2 If you can see images
Open and inspect every screenshot. For each, write one line in PROGRESS → Visual review: what looks wrong.

### 7.3 If your model can't view images
Don't pretend you inspected them. Use automated checks instead (add them to the shots script):
- The image is not blank (pixel variance above a threshold).
- The image is not mostly black or mostly white unless the scene should be (night).
- Forbidden-color check: count pixels whose hue is in the neon purple/cyan/magenta range with high saturation. Fail above a small threshold.
- UI text regions are present (sample expected pixel regions for the panel color).
- Compare against the previous run's shots: flag any image whose average color or structure changed a lot unexpectedly.

### 7.4 Visual checklist
- Water looks like water: reflection, depth color, foam on crests, no visible grid edges or seams.
- Boats sit at the right waterline: not floating above or sunk into the surface.
- No z-fighting, flickering, or popping.
- Shadows attached to objects (no floating/peter-panning).
- Nothing clipping through piers, decks, or buildings.
- Night is dark but readable; lights are the light sources.
- The UI is legible, aligned, consistent in spacing and fonts.
- No neon, no glow UI, no forbidden colors.

---

## 8. Polish checklist (pick from here in POLISH mode)

**Game feel**
- Does every action have feedback? (Sound + visual + UI change.)
- Throttle and rudder response: smooth, weighty, readable on the instruments.
- Camera: no jitter, no snapping, smooth transitions between chase/helm/on-foot.
- Slams, snatch loads, collisions: camera shake scaled to force, spray, sound.
- On-foot: footstep timing matches movement, no sliding, stairs/ramps feel right.

**Clarity**
- Can a new player tell what to do next at every moment?
- Every prompt appears only when relevant and disappears when done.
- Radio and phone messages are short, clear, and in-world.

**Presentation**
- Transitions: fades between states, no hard pops.
- Loading: nothing appears half-built.
- Consistent terminology everywhere (knots, port names, job names).

**Robustness**
- Pausing, alt-tabbing, and resizing the window mid-action don't break anything.
- Rapid key mashing doesn't break state machines.
- Leaving a job halfway, reloading a save, or quitting to the title leaves no ghosts.

---

## 9. Bug hunting procedure (BUGFIX mode with no known bugs)
1. Run the game in a headless or real browser with `?debug=1` for 3–5 minutes of scripted play: accept a job, drive, tow, rescue, dock, walk ashore, open every UI, change weather, save, reload.
2. Collect every console warning and error.
3. Try edge cases: throttle full reverse at top speed, attach a tow line at speed, capsize, sink, run out of fuel far from port, open the phone during a mayday, pause during a storm, reload during a tow.
4. Pick the worst real bug. Reproduce it with a test **before** fixing it. Fix it. Confirm the test now passes.

---

## 10. Debugging procedure
1. **Reproduce** the problem reliably. If you can't reproduce it, you can't fix it; log it and move on.
2. **Read the actual error** and stack trace. Open the file and line it points to.
3. **Form one hypothesis** and test it with the smallest possible experiment (a log line, a single test).
4. Fix the **root cause**, not the symptom. Don't wrap things in try/catch to hide errors.
5. Remove your debug logging before committing.
6. If three hypotheses fail, stop and follow golden rule 17.

---

## 11. Git rules
- Work on the current branch. Don't create or switch branches unless the task says to.
- Commit messages: `V<milestone>: <what changed>` or `fix: <bug>` / `polish: <thing>` / `test: <thing>` / `perf: <thing>` / `chore: <thing>`.
- Plain `git push origin HEAD` after committing. If push fails (network, auth), log it and continue; don't retry in a loop.
- Allowed: `status`, `log`, `diff`, `add`, `commit`, `push`, `revert`, `show`, `stash` (only to set aside *your own* work).
- **Forbidden:** `push --force`, `reset --hard`, `clean`, `rebase`, `filter-branch`, `branch -D`, `checkout -- .`, editing `.git/` directly, changing global git config.

---

## 12. Never do these
- Delete or rename existing systems, tests, save fields, or docs without a logged Decision.
- Replace a working system with a rewrite. Improve it in place.
- Add placeholder "TODO: implement" code and call the task done.
- Claim something works without running it.
- Mark a milestone complete while any of its acceptance criteria are unproven.
- Leave `verify` slower than 180 s.
- Touch anything outside the repo folder.
- Run installers, change system settings, or modify the PC.
- Commit `node_modules/`, `dist/`, `logs/`, `shots/`, `verify-shots/`, or secrets.

---

## 13. When you're stuck or unsure
- **Unsure what a feature should be?** Pick the most realistic option that fits the design pillars in `ROADMAP_V7.md` §1. Log it.
- **Unsure how the code works?** Search for usages, read the tests for that system, read CHANGELOG entries about it.
- **A task is too big?** Split it into TASKS and do the first slice.
- **The same error three times?** Revert, log in PROGRESS → Stuck log with what you tried, mark the task `[!] blocked` with a reason, and exit.
- **Everything in your mode is done?** Generate new tasks from the checklists and roadmap. There is always something to polish.

---

## 14. Project facts you must remember
- **Repo:** `https://github.com/The-UnknownGames/Breakwater`. Local: `C:\dev\breakwater`.
- **Stack:** Vite, Three.js, Rapier (`@dimforge/rapier3d-compat`), Playwright for tests. 1 unit = 1 meter.
- **Done:** V1–V7 (see `DEVLOG.md`). Next: **V8 phone, radio, voice**, then V9–V13 in `ROADMAP_V7.md`.
- **Only open V6 item:** a real-hardware FPS check. That needs the owner. Don't block on it.
- **Physics:** the ocean, buoyancy, and hulls are shared between rendering and physics and are heavily tested. Treat them as load-bearing.
- **Verify budget:** 180 s, and it was already at ~134 s. Every new check in verify must be light.
- **Models:** procedural boats, with an import pipeline for `.glb` files the owner supplies in `public/models/`. Keep `docs/ASSETS_WANTED.md` current.
- **Blender:** installed on this PC at `C:\Program Files\Blender Foundation\Blender 5.1\blender.exe`. The Blender generators in `tools/blender/` have never been run. Running and fixing them is a valid VISUAL task.
- **The owner reads:** `docs/PROGRESS.md` (short status), `docs/TASKS.md`, and git log. Write for them: plain language, no jargon walls.
- **The owner writes:** `docs/OWNER_NOTES.md` with bugs and requests. Always read it. Anything in it is P1.
