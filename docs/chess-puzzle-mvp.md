# Chess Puzzle App — Complete Feature & Behavior Specification

An implementation checklist for a puzzle app that competes with the best in the category: Lichess Puzzles (Storm / Streak / Racer / Dashboard), Chess.com Puzzles (Rated / Rush / Battle / Daily / Custom), ChessTempo, Chessable-style spaced repetition, CT-ART-style courses, and Woodpecker-method trainers.

**Priority legend**

- `P0` — MVP. The app is not a credible puzzle app without it.
- `P1` — Parity. Needed to be "as good as" the top apps.
- `P2` — Differentiator / polish. What makes people switch to you.

**Contents**

0. Engineering constraints (apply to every item)
1. Chess rules core
2. Board rendering
3. Move input & interaction
4. Puzzle data model
5. Core solve flow
6. Hints, solution reveal, retry
7. Post-solve review & analysis
8. Rating system
9. Puzzle selection algorithm
10. Game modes
11. Theme taxonomy
12. Spaced repetition & mistake review
13. Courses & structured learning
14. Personalized puzzles from the user's own games
15. Stats, progress & insights
16. Gamification & retention
17. Social & competitive
18. Onboarding
19. Accounts, sync & offline
20. Notifications, widgets & re-engagement
21. Settings (full list)
22. Permissions, entitlements & usage limits (incl. billing)
23. Content pipeline
24. Engine integration
25. Backend & API
26. Anti-cheat & fair play
27. Platform specifics
28. Accessibility
29. Localization
30. Performance budgets
31. Analytics & experimentation
32. Privacy, legal, compliance
33. Support & admin tooling
34. Edge-case checklist
35. Testing strategy
36. Coach assistant (avatar & dialog)
37. Suggested phasing
38. Appendix: data schemas

---

## 0. Engineering constraints (apply to every item in this spec)

These rules are inherited by every checklist item below. An item is not done until it satisfies all of them. The base repo, the local-first data layer, the sync engine, the simulation harness and the test runners already exist; this section says how features must use them, not how to build them. Replace the placeholder names in `<angle brackets>` with the real package/task names once, at the top of `CLAUDE.md`.

### 0.0 Build on what exists — the overriding rule

**Every item in this spec is implemented with the app's existing primitives, in the app's prescribed way. Nothing in this document is license to introduce a parallel mechanism.** Where a section below describes a capability in generic terms (an "API endpoint", a "server-side counter", a "cache", an "offline queue", a "store"), read it as "the existing primitive that does this here". If the existing primitive can't express a requirement, the answer is to extend the primitive through its owners' process, not to bypass it.

- [ ] `P0` **Local-first is the architecture, not a feature.** The app is local-first with a sync engine. All feature state is written to local tables and synced by the engine; features never talk to a server directly, never hold state only in memory across screens, and never implement their own offline handling, retry, queueing, conflict resolution or cache. §19's "offline mode", "sync", "conflict resolution" and "prefetch" items are therefore *properties the sync engine already provides* that each feature must not break, not things to build.
- [ ] `P0` **Tables are defined the prescribed way.** Every new table uses the existing schema-definition primitive (`<table definition API>`): declared types, migrations, sync scope (per-user / shared / server-only), conflict policy, indexes and access rules exactly as the base prescribes. No ad-hoc storage, no raw SQL outside the primitive, no JSON blobs standing in for tables, no second ORM. The §38 schemas are *logical*; their physical form is whatever the primitive prescribes.
- [ ] `P0` **Authority follows the sync engine's model.** Where this spec says "server-authoritative" (rating, quotas, run validation, permissions), it means: the client writes optimistically to local tables, the sync engine delivers the write, and the authoritative computation runs in the engine's prescribed server-side hook/mutator (`<server mutator primitive>`) and syncs the result back. Features don't add REST endpoints for things the sync engine's mutation path already covers. Endpoints listed in §25 exist only where the base's conventions call for a non-sync path (e.g., large read-only catalog fetches, real-time rooms, billing webhooks).
- [ ] `P0` **Use the base's prescribed patterns for everything that has one:** state management, navigation, dependency injection, feature flags/remote config, event bus, error handling, logging, analytics events, localization, theming/UI kit, permissions (§22 is implemented *on* the base's auth and data primitives, not beside them), background jobs, scheduling, testing/harness scenarios, package layout and naming. Before writing anything, find the existing example of the same kind of thing in the repo and match it.
- [ ] `P0` **Extend, don't fork.** If a primitive is missing a capability (say, a per-user time-windowed counter for quotas, or a sync scope for shared leaderboards), the item becomes two items: (1) extend the primitive, with its own tests, following the base's conventions; (2) build the feature on the extended primitive. Never a feature-local workaround "for now".
- [ ] `P0` **Prior art check is part of every item.** The implementation notes for each item name the existing primitive(s) it builds on and the existing feature it mirrors. A PR that introduces a new mechanism where one exists is rejected in review regardless of test coverage.
- [ ] `P0` **Harness fidelity comes from the real primitives.** The in-process simulation runs the real local data layer and the real sync engine with faked I/O (§0.4). Features are tested through the same primitives they ship on; no test-only data paths.

### 0.1 Definition of done (per item)

- [ ] Behavior is exercised by an **end-to-end test running against the in-process simulation** (`<harness package>`): real feature code, real permission layer, real rating/selection/coach code, with I/O (network, clock, storage, RNG, TTS, billing, push) replaced by the harness's deterministic fakes. No item is "done" on unit tests alone.
- [ ] The test is **deterministic-simulation style (DST):** seeded RNG, simulated clock, explicit event ordering; the test can be re-run with a seed and reproduces the same trace. Flaky = failing.
- [ ] Adversarial schedules are covered where the item involves time, concurrency or sync: the harness injects delays, reorders, duplicates, drops, clock jumps, process death and restarts. Every row in the §34 edge-case list that applies to the item has a seeded scenario.
- [ ] Invariants are asserted at every step, not only at the end (e.g., rating changes at most once per puzzle; a consumed quota unit is never double-charged; the board never accepts a move from the side not to move; no coach line exceeds its length cap).
- [ ] The item names the existing primitives it builds on (§0.0) and introduces no parallel mechanism; new tables are declared via the prescribed table primitive with sync scope and conflict policy set.
- [ ] The item lives in exactly one vertical slice package (§0.2). If it needs code in two slices, it is two items.
- [ ] Type-checks, lints (including the §22.11 tier denylist and the §36 line-length linter), and the affected packages' tests pass through the monorepo task graph with caching (§0.3), locally and in CI.
- [ ] Performance budgets from §30 that apply to the item are asserted in the harness (simulated time) and spot-checked on a device for UI items.

### 0.2 Vertical slicing

- [ ] **One package per feature slice**, owning its domain logic, storage adapters, API handlers, client state, UI, test fixtures and harness scenarios end-to-end. Example slices, matching this spec's sections: `rules`, `board`, `puzzle-catalog`, `solve`, `rating`, `selection`, `review-analysis`, `modes-rush`, `modes-storm`, `modes-streak`, `modes-battle`, `daily`, `collections`, `srs`, `courses`, `personal-games`, `stats`, `engagement` (goals/streaks/achievements), `social`, `onboarding`, `accounts-sync`, `notifications`, `settings`, `permissions` (§22, the only slice that may import `billing` and auth facts), `billing`, `content-pipeline`, `engine`, `anti-cheat`, `coach` (§36), `admin`.
- [ ] **Shared kernel is tiny and stable:** the base's existing data layer and sync engine (`<data/sync packages>`), `chess-core` (rules/FEN/SAN/PGN), `harness` (harness, fakes, scenario DSL), `ui-kit` (design system), `permissions-client` (the `can()/consume()` interface only), `events` (typed event bus), `config`. Nothing else is shared; slices don't grow their own infrastructure. A slice imports another slice's *public contract package* only, never its internals.
- [ ] **Dependency direction is enforced** (dependency-cruiser / eslint boundaries / build-graph rules): slices → kernel; slices never import each other's internals; `permissions` is the only importer of `billing` and account facts; `coach` reads other slices' events, never their state.
- [ ] **Slice contract = public package:** each slice exposes `@app/<slice>-contract` (types, events, action names, API schema) separately from `@app/<slice>` (implementation), so consumers depend on the contract and the impl can change without invalidating their caches.
- [ ] **Cross-slice communication** is through the typed event bus and contracts, replayable in the harness. No direct calls into another slice's store.
- [ ] **Each slice ships its own harness scenarios** (`<slice>/harness/*.scenario.ts`) and fixtures; the spec suite is the union of all slices' scenarios plus a small set of whole-app journeys in `harness`.
- [ ] Platform shells (`app-ios`, `app-android`, `app-web`, `api`, `workers`) are thin composition roots that wire slices together; they contain no feature logic.

### 0.3 Monorepo, partitioning and caching

- [ ] **Every task is cacheable and hermetic:** build, typecheck, lint, unit, harness, spec, codegen and storybook/snapshots declare exact inputs and outputs so the task runner (Turborepo) can cache and skip them. No task reads undeclared files or the network; anything nondeterministic (timestamps, absolute paths, env) is excluded from inputs/outputs.
- [ ] **Partition for cache hit rate:** many small packages beat few large ones; contracts are separate from implementations (§0.2); generated code (action catalog constants, API clients, line-pool bundles, localization tables) is its own package so its consumers only rebuild when the generated output changes.
- [ ] **Test tasks are sharded per slice** and, for the largest slices, per scenario group; a change in one slice re-runs that slice's tests and its dependents' contract tests only. Whole-app journeys run on the `harness` package and are gated behind `affected` detection.
- [ ] **Remote cache** is on for local and CI; CI runs `--filter=...[origin/main]` (affected only) with the full graph on main. Cache misses on unchanged packages are treated as bugs (fix the input globs).
- [ ] **Harness-time, not wall-time:** spec tests advance the simulated clock, so a "24-hour quota window" test runs in milliseconds; wall-clock sleeps are banned in tests.
- [ ] **Budgets:** affected-only CI ≤ 5 min p50; full graph ≤ 15 min; local `turbo run test --filter=<slice>` on a warm cache ≤ 10 s. Tracked in CI and regressed like any other metric.
- [ ] **Codegen is checked in and verified**, not regenerated on every run: a task diff-checks generated output so downstream caches stay stable.
- [ ] **Persistent, watch-mode dev loops** per slice (`turbo watch`) so a slice's tests re-run on save without rebuilding the world.

### 0.4 Simulation harness expectations (what the harness must fake)

- [ ] Clock and timers (user-local timezones and DST transitions included)
- [ ] Network: latency, partitions, reorder, duplicate, drop, slow responses; server and client both run in-process
- [ ] Storage: the real local data layer and the real sync engine running in-process on both client and server sides, with injectable failures, process-death snapshots and restarts — never a fake store standing in for them
- [ ] RNG: single seeded source; every random choice (puzzle selection, coach line, matchmaking) draws from it
- [ ] Engine: a fake UCI engine with scripted evals per position, plus an optional real-engine mode for content jobs
- [ ] Billing: store receipts, renewals, refunds and webhooks as scripted events
- [ ] Push/notifications, TTS/audio, haptics, app lifecycle (foreground/background/kill), device capabilities (reduce-motion, type size, RTL)
- [ ] Multi-client: N devices for one account and M accounts for real-time modes, all in one process
- [ ] Trace output: every scenario produces a replayable event trace with the seed; failures print the minimal seed and the step at which an invariant broke

### 0.5 What this spec deliberately does not specify

- Framework, language, database or UI toolkit choices beyond what the existing base already fixes.
- File layouts inside a slice.
- Anything the base, the data layer, the sync engine or the harness already document; link to them from `CLAUDE.md` rather than duplicating them here. Where this spec and the base's documented conventions disagree, the base wins and the spec should be corrected.

## 1. Chess rules core

The foundation. Every bug here shows up as "the app said my correct move was wrong."

- [ ] `P0` Full legal move generation (bitboard or 0x88; or adopt a proven library — chess.js, shakmaty, python-chess, chessops)
- [ ] `P0` Castling: both sides, rights tracking, cannot castle out of / through / into check, rook-attacked-is-fine rule
- [ ] `P0` En passant: capture square, only valid the immediate next move, legality when it exposes own king (the horizontal pin case)
- [ ] `P0` Promotion to Q/R/B/N, including capture-promotions
- [ ] `P0` Check, checkmate, stalemate detection
- [ ] `P0` Pins and discovered check handled by legality filter
- [ ] `P0` FEN parse + serialize (all 6 fields), with validation and useful errors
- [ ] `P0` UCI move format parse/serialize (`e2e4`, `e7e8q`)
- [ ] `P0` SAN generate + parse, with correct disambiguation (`Nbd7`, `R1e2`, `Qh4e1`), `+`, `#`, `=Q`, `O-O`, `O-O-O`
- [ ] `P1` PGN import/export: headers, comments `{}`, NAGs (`!`, `??`, `$1`), nested variations, `[%eval]` / `[%clk]` tags
- [ ] `P1` Draw rules: insufficient material, threefold repetition, 50-move rule (needed for play-vs-engine continuation)
- [ ] `P1` Zobrist hashing for position identity (dedupe puzzles, repetition detection)
- [ ] `P1` Immutable position objects or cheap make/unmake so review navigation is instant
- [ ] `P2` Chess960 castling support (only if you ingest 960 puzzles or add variants)
- [ ] `P0` Perft test suite passing on the standard positions (startpos, Kiwipete, positions 3–6) to the usual depths

## 2. Board rendering

- [ ] `P0` Crisp vector pieces at any size (SVG or pre-rasterized @1x/2x/3x), no blur on scale
- [ ] `P0` Board always oriented with the solver's color at the bottom; manual flip button
- [ ] `P0` Square sizing that fills available width, stays square, handles notches / safe areas / split-screen
- [ ] `P0` Last-move highlight (from + to squares)
- [ ] `P0` Selected-piece highlight
- [ ] `P0` Legal-move indicators: dot on empty squares, ring/corner-marks on capturable squares
- [ ] `P0` Check indicator: red radial glow on the king in check
- [ ] `P0` Piece move animation (slide), ~150–250 ms default, eased; castling animates both pieces; en passant removes the captured pawn at the right moment; promotion swaps piece at arrival
- [ ] `P0` Coordinates: on-board (inside edge squares) / outside border / off — flipped correctly with orientation
- [ ] `P1` Board themes: at least 8–12 (brown, green, blue, grey, wood textures, high-contrast, dark)
- [ ] `P1` Piece sets: at least 8–12 (cburnett/staunton-style, merida, alpha, neo-style, minimalist, letter pieces for accessibility)
- [ ] `P1` Animation speed setting: off / fast / normal / slow
- [ ] `P1` Correct/incorrect feedback overlay on the destination square (green check badge / red X badge)
- [ ] `P1` Hint highlight style distinct from selection (e.g., pulsing square)
- [ ] `P1` Engine-arrow and user-arrow layers rendered above pieces, with knight-move L-shaped or straight arrows
- [ ] `P1` Captured material / material-balance strip (`+3`) — optional in puzzle mode, on in analysis
- [ ] `P1` Side-to-move indicator ("White to move" text + color chip), always visible before first move
- [ ] `P1` Dark mode / light mode / follow-system for the whole UI
- [ ] `P2` Custom board colors (pick light/dark hex), custom background
- [ ] `P2` 3D-ish or animated piece sets, board-theme store (each set is a scoped `cosmetic.piece_set.use` grant, §22)
- [ ] `P2` Blindfold rendering modes: hide all pieces / hide own / hide opponent / show as identical discs
- [ ] `P2` Board zoom/resize handle (web/tablet)
- [ ] `P2` "Ghost piece" at origin square while dragging

## 3. Move input & interaction

- [ ] `P0` Drag-and-drop with touch: piece lifts, scales up ~1.5–2×, and is offset above the finger so it's visible; hovered target square gets a highlight ring
- [ ] `P0` Tap-tap (tap piece, tap destination) — works simultaneously with drag, no mode switch
- [ ] `P0` Tap selected piece again → deselect; tap a different own piece → switch selection; tap illegal square → deselect (or keep, as a setting)
- [ ] `P0` Drop on illegal square or off-board → piece snaps back with a quick animation, no penalty, no "wrong move" registered
- [ ] `P0` Only the side-to-move's pieces are interactive; input locked during opponent animation and after puzzle end (except in review)
- [ ] `P0` Promotion picker: appears on the promotion file stacked from the promotion square (Q, N, R, B order), tap outside cancels the move
- [ ] `P0` **Never auto-queen silently in puzzles** — underpromotion puzzles exist. If an auto-queen setting exists, it must be ignored (or the picker forced) in puzzle contexts
- [ ] `P0` Castling accepted via king-two-squares AND king-onto-own-rook
- [ ] `P0` Input latency: piece must respond to touch-down within one frame
- [ ] `P1` Input method setting: drag only / tap only / both
- [ ] `P1` Sounds: move, capture, check, castle, promote, correct, wrong, puzzle solved, timer low-tick, run-over; separate volume or on/off; respects silent switch
- [ ] `P1` Haptics: light tick on move, success pattern on solve, error pattern on wrong move; toggle
- [ ] `P1` User annotations: draw arrows (right-drag on web; long-press-drag or an "annotate" toggle on mobile), highlight squares, multiple colors via modifier keys; auto-clear on next move
- [ ] `P1` Mouse: right-click cancels an in-progress drag; mouse wheel / arrow keys navigate moves in review
- [ ] `P1` Keyboard shortcuts (web/desktop/iPad keyboard): `←/→` step, `↑/↓` start/end, `Space`/`Enter` next puzzle, `H` hint, `F` flip, `S` show solution, `A` analysis
- [ ] `P2` Keyboard move entry (type SAN like `Nf3`), with autocomplete — also an accessibility path
- [ ] `P2` Voice move input
- [ ] `P2` Left-handed / one-handed layout option (controls reachable by thumb)
- [ ] `P2` Accidental-touch guard: ignore touches that start in system gesture edges; minimum drag distance before a drag is committed
- [ ] `P2` "Confirm move" setting (off by default; useful for accessibility and tablets)

## 4. Puzzle data model

- [ ] `P0` Fields: `id`, `fen`, `moves[]` (UCI), `rating`, `ratingDeviation`, `themes[]`, `plays`, `popularity`, `sourceGameUrl`, `openingTags[]`
- [ ] `P0` Adopt the Lichess convention: `fen` is the position **before** the opponent's setup move; `moves[0]` is the opponent's move that creates the tactic; user plays `moves[1], [3], …`; the line ends on a user move
- [ ] `P0` Solver color derived from FEN side-to-move (inverted, because of the setup move)
- [ ] `P0` Seed the content from the Lichess open puzzle database (CC0, several million puzzles, already rated and themed) — see §23
- [ ] `P1` Alternate-solution support: per-ply list of additional accepted moves (for curated content where two moves are equally winning)
- [ ] `P1` "Any mate is accepted" flag semantics: on a mating final move, any legal move that delivers checkmate is correct
- [ ] `P1` Branching solutions (tree, not line) for course content: opponent may have multiple defenses the user must answer
- [ ] `P1` Per-move annotations: text comment, NAG, arrows/highlights (for curated/course puzzles)
- [ ] `P1` Metadata: goal type (`win`, `mate`, `draw/defend`, `equalize`), move count, game phase, players / event / year of source game, master-game flag
- [ ] `P1` Quality fields: upvotes, downvotes, report count, status (`active`, `quarantined`, `retired`)
- [ ] `P2` Wrong-move refutations: precomputed best reply to the most common wrong answers ("why doesn't Qxh7 work?")
- [ ] `P2` Human-written or generated explanation text per puzzle
- [ ] `P2` Versioning on puzzles so corrections don't corrupt attempt history

## 5. Core solve flow

The single most important flow; it is executed thousands of times per user.

**Load**

- [ ] `P0` Next puzzle is already in memory when the previous one ends (prefetch queue) — transition under 100 ms
- [ ] `P0` Board shows the pre-setup position, pauses ~400–600 ms, then animates the opponent's setup move with sound and last-move highlight
- [ ] `P0` Orientation set before first paint (no visible flip)
- [ ] `P0` Prompt: "Your turn — find the best move for White/Black"
- [ ] `P1` Header shows puzzle rating (or hides it until solved — setting), puzzle ID, and elapsed timer (optional)
- [ ] `P1` Themes are **hidden until the puzzle ends** (they are spoilers), unless the user chose a theme session
- [ ] `P1` Goal hint line where it isn't spoilery in context (e.g., "Mate in 2" only in mate-in-N sessions)

**User moves**

- [ ] `P0` Compare user move to expected solution move (after normalizing castling notation and promotion piece)
- [ ] `P0` Correct, line continues → brief green feedback, opponent reply auto-plays after ~300–500 ms, input re-enabled
- [ ] `P0` Correct, final move → success state, sound, haptic, result panel
- [ ] `P0` Final-move mate rule: any checkmating move counts as correct
- [ ] `P0` Wrong move → red feedback, piece returns (or stays briefly then reverts), puzzle marked failed **once**, rating updates immediately
- [ ] `P0` Rating is affected only by the first outcome: first wrong move = loss; clean solve = win. Nothing after that changes rating
- [ ] `P1` After a wrong move the user can keep trying (unrated) or view the solution — "Retry" and "View solution" buttons
- [ ] `P1` "Good move, but there's better" soft-fail path for curated puzzles with flagged second-best moves (does not count as a fail; asks to try again)
- [ ] `P1` Multi-move puzzles show progress (e.g., dots or "Move 2 of 3") — optional, as it leaks length
- [ ] `P1` Opponent reply speed follows the animation-speed setting; zero delay option for speed solvers

**Result panel**

- [ ] `P0` Shows solved/failed, rating delta (`+8` / `−12`) with animated count, new rating
- [ ] `P0` Primary CTA: "Next puzzle" (large, thumb-reachable); auto-advance setting (off / after 1 s / immediately on success)
- [ ] `P1` Shows puzzle rating, times played, % solved, themes, source game (players, year) with link
- [ ] `P1` Actions: retry, analysis board, thumbs up/down, favorite/bookmark, add to collection, share, report
- [ ] `P1` Elapsed time and the user's average for this rating band
- [ ] `P2` "X% of players at your level solved this" / "You were faster than Y%"
- [ ] `P1` One-line explanation of the idea, spoken by the coach (§36): "The knight fork on e7 wins the queen because the f-pawn is pinned"

**Session handling**

- [ ] `P0` Leaving mid-puzzle: puzzle remains pending and is restored on return (no free skip, no silent fail)
- [ ] `P1` Explicit "Skip" is either unavailable in rated mode or counts as a fail — be explicit in UI
- [ ] `P1` App backgrounded: timer pauses in untimed modes; timed modes keep a server-anchored clock
- [ ] `P1` Session summary on exit: solved / failed, rating change, accuracy, time, themes missed, streak status

## 6. Hints, solution reveal, retry

- [ ] `P0` "Show solution": plays the remaining line out with animation, then enters review mode; counts as a fail if not already resolved
- [ ] `P1` Progressive hint: 1st tap highlights the piece to move; 2nd tap shows the destination (arrow); hints are voiced by the coach (§36)
- [ ] `P1` Hint cost policy, clearly communicated: using any hint makes the puzzle non-winning for rating (treated as fail or as "no gain") 
- [ ] `P1` Hint button delayed/disabled for the first N seconds (setting) to discourage reflex use
- [ ] `P1` "Retry from start" and "Retry from the move I missed"
- [ ] `P1` Conceptual hint tier before the piece hint ("Look for an overloaded defender") — delivered as a coach line (§36)
- [ ] `P1` Hint availability and daily allowance are permissions (`hint.use` quota, `hint.tiers` parameter, §22); the hint button asks the permission client and renders the shared denial surface — no other gating logic

## 7. Post-solve review & analysis

- [ ] `P0` Move list (SAN, figurine option) with tappable moves; current move highlighted; scrubbing forward/back with buttons, swipe, and arrow keys
- [ ] `P0` Jump to start / end; board animates on single steps, snaps on jumps
- [ ] `P1` "Play it out" — user can make any move in review and explore freely; exploration creates a variation rather than mutating the main line
- [ ] `P1` Local engine analysis toggle: eval bar, best line(s), depth indicator, multi-PV 1–3, arrows for top moves — availability via `analysis.engine.use`, depth/PV bounds via the `analysis.engine.*` parameters (§22)
- [ ] `P1` "Why was my move wrong?" — engine shows the refutation line of the user's wrong move, with eval comparison
- [ ] `P1` Open source game at the puzzle's ply (in-app viewer or link out)
- [ ] `P1` Copy FEN / copy PGN / share position image
- [ ] `P1` Continue vs. computer from the final position ("convert the advantage") at selectable strength
- [ ] `P2` Threat display (null-move engine search showing what the opponent threatens)
- [ ] `P2` Opening explorer link for opening-phase puzzles
- [ ] `P2` Community comments per puzzle, moderated; spoiler-safe (only visible after attempt)
- [ ] `P2` Theme voting: users confirm/reject theme tags and propose new ones

## 8. Rating system

- [ ] `P0` Glicko-2 for both player and puzzle; each attempt is a "game" between them (solve = win, fail = loss)
- [ ] `P0` New users: rating 1500, high RD (e.g., 350–500), provisional "?" marker until RD drops below a threshold
- [ ] `P0` Server-authoritative rating; client shows an optimistic estimate and reconciles
- [ ] `P0` Repeat attempts on an already-seen puzzle never affect rating
- [ ] `P1` Puzzle ratings update too, but damped, and only from rated first attempts by non-provisional, non-flagged users
- [ ] `P1` Reduced rating weight when the user has extra information: chosen theme sessions, mate-in-N sessions, opening sessions (the theme is a hint)
- [ ] `P1` RD inflation over inactivity (rating becomes less certain after time away)
- [ ] `P1` Per-theme performance ratings (not shown as official rating, but used for weakness detection and selection)
- [ ] `P1` Separate ratings per competitive mode: standard puzzle rating, Battle rating; Rush/Storm use high scores, not ratings
- [ ] `P1` Rating floor and sane cap on per-puzzle swing so a provisional user can't jump 400 points on a fluke
- [ ] `P1` Rating history stored per attempt for graphs
- [ ] `P1` Option to hide rating entirely ("zen mode") for users who get tilted
- [ ] `P2` Optional time-aware scoring mode (ChessTempo-style "blitz" rating where speed matters) as a separate rating
- [ ] `P2` Rating reset / re-placement option
- [ ] `P2` Approximate mapping from puzzle rating to playing strength shown as guidance, clearly labeled as approximate

## 9. Puzzle selection algorithm

- [ ] `P0` Choose puzzles within a window around the user's rating (e.g., ±100–200, widening with RD)
- [ ] `P0` Never serve a puzzle the user has already attempted in rated mode (until pool exhaustion, then oldest-first and unrated)
- [ ] `P0` Quality filter: exclude puzzles below a popularity / play-count / report threshold
- [ ] `P1` Difficulty preference: Easiest (−600) / Easier (−300) / Normal / Harder (+300) / Hardest (+600)
- [ ] `P1` Target success rate tuning: default window should produce ~50–60% solves in rated; ~80–85% in "warm-up"/learning modes
- [ ] `P1` Balance: solver color, game phase, theme variety, puzzle length; avoid streaks of the same motif in mixed mode
- [ ] `P1` Weakness-weighted selection ("Smart mix"): oversample themes where the user underperforms
- [ ] `P1` Prefetch batches (20–50) keyed to rating; refresh when rating drifts past the batch window
- [ ] `P1` Server-side seen-set per user (bloom filter or table) plus client-side dedupe for offline batches
- [ ] `P1` Tilt detection: after N consecutive fails, quietly ease difficulty and/or suggest a break; the coach switches to the calm register (§36.5)
- [ ] `P2` Session-shaped selection: warm-up (easy) → core (at level) → stretch (hard) → cool-down
- [ ] `P2` Filters for power users: rating range, themes include/exclude, phase, side, move count, master games only, min popularity, opening family

## 10. Game modes

### 10.1 Rated puzzles (core) — `P0`
- [ ] Endless rated stream as specified in §5–§9
- [ ] Each rated puzzle served consumes the `puzzle.rated.solve` quota (§22); when denied, the mode shows the shared denial surface with remaining/reset info. The mode code contains no limit logic of its own

### 10.2 Practice / unrated — `P0`
- [ ] Same flow, no rating change, relaxed hints, unlimited retries
- [ ] Entry points: by theme, by opening, by difficulty, by custom filter

### 10.3 Themed training — `P1`
- [ ] Theme browser grouped by category (§11) with description, example diagram, user's performance per theme, puzzle count
- [ ] "Healthy mix" default tile
- [ ] Reduced-weight rating or unrated toggle

### 10.4 Puzzles by opening — `P1`
- [ ] Browse by opening family → variation; show count and user stats
- [ ] "Openings you play" shortcut (from linked accounts, §14)

### 10.5 Daily puzzle — `P1`
- [ ] One global puzzle per day, same for everyone; rolls over at a fixed UTC time, displayed in local time
- [ ] Archive calendar of past dailies with solved/failed/missed state
- [ ] Daily-puzzle streak, global solve % and average time, comments
- [ ] Shareable result card; home-screen widget (§20)
- [ ] Difficulty curve across the week (easier Monday → harder Sunday) `P2`

### 10.6 Timed run: "Rush" style — `P1`
- [ ] Variants: 3-minute, 5-minute, Survival (untimed)
- [ ] Three strikes and the run ends; timer expiry ends the run
- [ ] Difficulty ramps from trivial upward on a fixed curve; same curve for everyone for leaderboard fairness
- [ ] Zero-delay transitions: no result panel, instant next puzzle, minimal animation, opponent reply near-instant
- [ ] Wrong move → strike, puzzle is abandoned immediately (no retry), next puzzle loads
- [ ] HUD: score, strikes, clock; clock turns red and ticks under 10 s
- [ ] End screen: score, personal best (per variant, today / week / all-time), accuracy, longest clean streak, highest puzzle rating solved, review list of every puzzle (solved/failed) with tap-to-review
- [ ] Leaderboards: global, friends, country; daily / weekly / all-time
- [ ] Starting a run consumes `run.rush.start` (context: variant) at `POST /runs` (§22); no per-mode limit logic
- [ ] Entire puzzle sequence preloaded at run start so network never affects the run

### 10.7 Timed run: "Storm" style — `P1`
- [ ] Run start consumes `run.storm.start` (§22)
- [ ] Fixed starting clock (e.g., 3:00); each wrong move costs time (e.g., −10 s) instead of strikes
- [ ] Combo meter: consecutive correct moves fill a bar; thresholds grant bonus seconds; wrong move resets combo
- [ ] Score = puzzles solved; stats: moves, accuracy, best combo, time per move, highest solved
- [ ] Daily high-score tracking and history chart

### 10.8 Streak — `P1`
- [ ] Run start consumes `run.streak.start` (§22)
- [ ] Untimed; puzzles get progressively harder; first mistake ends the run
- [ ] One skip per run
- [ ] Run persists across app restarts until broken
- [ ] Personal best, leaderboard

### 10.9 Real-time race ("Racer" style) — `P2`
- [ ] Lobby via link/code or public matchmaking, up to ~10 players; joining gated by `racer.play`, hosting by `racer.host` (§22)
- [ ] All players get the same puzzle sequence; fixed duration (e.g., 90 s)
- [ ] Live progress track showing each player's score; combo bonuses; penalties for wrong moves
- [ ] Countdown start, rematch button, results podium
- [ ] Reconnect handling; bots or ghost replays to fill empty lobbies

### 10.10 Head-to-head battle — `P2`
- [ ] 1v1 simultaneous Rush with identical sequences; winner = higher score when both are out or time ends
- [ ] Entry gated by `battle.play` (quota + concurrent lease, §22)
- [ ] Matchmaking by Battle rating, friend challenges, rematch
- [ ] Separate Battle rating (Glicko/Elo), league/tier display
- [ ] Live opponent score + strike display, emotes `P2`
- [ ] Disconnect = forfeit after grace period; abandonment penalties

### 10.11 Custom sets & collections — `P1`
- [ ] Bookmark/favorite any puzzle
- [ ] User-created collections (name, description, reorder, remove); creation bounded by the `collection.max_count` / `collection.max_items` caps (§22)
- [ ] Generate a set from filters (rating range, themes, count)
- [ ] Play a set in order or shuffled; per-set progress and accuracy
- [ ] Share sets by link; import someone else's set `P2`
- [ ] Coach mode: assign sets to students and view their results `P2`

### 10.12 Woodpecker-method cycles — `P2`
- [ ] Fixed set (e.g., 100–1000 puzzles) solved repeatedly in cycles
- [ ] Each cycle targets roughly half the previous cycle's time
- [ ] Per-cycle stats: time, accuracy, per-puzzle speedup; cycle-over-cycle chart
- [ ] Schedule/pace planner ("finish cycle 1 in 4 weeks")

### 10.13 Mate trainer — `P1`
- [ ] Mate in 1 / 2 / 3 / 4 / 5+ ladders; named mating patterns (back rank, smothered, Anastasia, Arabian, Boden, etc.) as mini-courses

### 10.14 Endgame trainer — `P2`
- [ ] Theoretical positions (Lucena, Philidor, K+P opposition, Q vs P on 7th, etc.) played out against tablebase-perfect defense
- [ ] Success = achieving the tablebase result; feedback shows when a move changed the theoretical outcome
- [ ] Syzygy tablebase access (server API for 6–7 men; small 3–5 men set can ship on-device)

### 10.15 Visualization & calculation drills — `P2`
- [ ] Blindfold puzzles (see §2 render modes)
- [ ] "Follow the moves": show a position, list N moves as text, then ask for the tactic in the resulting (unseen) position
- [ ] Checks-Captures-Threats drill: tap every check / every capture in a position
- [ ] Count attackers/defenders of a square
- [ ] Coordinates trainer: find the named square / name the highlighted square, timed, both orientations
- [ ] Knight-path and piece-vision drills

### 10.16 Defensive & judgment puzzles — `P2`
- [ ] "Find the only move" defense puzzles
- [ ] "Is there a tactic?" — positions where the right answer may be a quiet move (counters puzzle-mode bias)
- [ ] "Spot the blunder": choose which of two candidate moves loses
- [ ] Guess-the-move through a master game with scoring

### 10.17 Play from position — `P1`
- [ ] After any puzzle: continue against the engine at chosen strength to convert the win

## 11. Theme taxonomy

Use the Lichess tag set as the base so the open database works out of the box, then group for UI.

- [ ] `P1` **Motifs:** fork, pin, skewer, discovered attack, double check, deflection, attraction (decoy), interference, clearance, x-ray attack, capturing the defender (removing the guard), intermezzo (zwischenzug), quiet move, sacrifice, hanging piece, trapped piece, zugzwang, defensive move, exposed king, kingside attack, queenside attack, attacking f2/f7, advanced pawn, promotion, underpromotion, en passant, castling
- [ ] `P1` **Mates:** mate, mate in 1 / 2 / 3 / 4 / 5+, back-rank mate, smothered mate, Anastasia's mate, Arabian mate, Boden's mate, double-bishop mate, dovetail mate, hook mate, kill-box mate, Vukovic mate
- [ ] `P1` **Phases:** opening, middlegame, endgame; rook / bishop / knight / pawn / queen / queen-and-rook endgames
- [ ] `P1` **Goals:** equality, advantage, crushing, mate
- [ ] `P1` **Lengths:** one-move, short, long, very long
- [ ] `P1` **Origin:** master game, master vs master, super-GM game, player games (own games)
- [ ] `P1` Each theme has: localized name, one-paragraph description, canonical example diagram, category, icon
- [ ] `P2` Additional curated tags not in the base set: overloading, windmill, desperado, greek gift, perpetual check, stalemate trick, fortress, opposition, breakthrough, battery, weak back rank

## 12. Spaced repetition & mistake review

- [ ] `P1` Every failed puzzle automatically enters a review queue
- [ ] `P1` Scheduler (SM-2 or FSRS-style): intervals grow on success (e.g., 1 d → 3 d → 7 d → 21 d → 60 d), reset on fail; "graduated" after N consecutive clean solves
- [ ] `P1` "Review due" count badge on the home screen; review session mixes due items
- [ ] `P1` Review attempts are unrated
- [ ] `P1` Filter mistakes by theme / date / rating; manual add and remove
- [ ] `P2` Also queue puzzles solved slowly or with a hint (configurable)
- [ ] `P2` Forecast chart (upcoming reviews per day), daily review cap
- [ ] `P2` Include personal-game mistakes (§14) in the same queue

## 13. Courses & structured learning

- [ ] `P1` Curriculum tree: beginner → intermediate → advanced, each unit = short explanation + graded puzzle set; course entry gated by `course.access` scoped to the course id (§22)
- [ ] `P1` Lesson format: interactive board with the coach narrating (§36.3), guided moves, then practice puzzles with full hints
- [ ] `P1` Unit completion, stars/mastery levels, unlock logic (or fully open — setting/product decision)
- [ ] `P1` Placement into the curriculum based on puzzle rating
- [ ] `P2` Skill tree visualization with per-skill mastery decay and "practice to restore"
- [ ] `P2` Certificates / completion badges
- [ ] `P2` Authoring tool (CMS) for coaches/content team: board editor, line editor with comments/arrows, preview, publish workflow
- [ ] `P2` Third-party / paid course marketplace (a purchase yields a `course.access` grant scoped to that course, §22)

## 14. Personalized puzzles from the user's own games

A major differentiator; high perceived value.

- [ ] `P2` Link Lichess and Chess.com usernames (public game APIs; OAuth where needed), plus PGN upload; gated by `personal_games.import` and the `personal_games.analyze` quota (§22)
- [ ] `P2` Periodic import of recent games (incremental, rate-limit aware)
- [ ] `P2` Server-side engine pass to find missed tactics and blunders: eval-swing thresholds, single-best-move check, minimum depth, skip already-lost positions
- [ ] `P2` Generate puzzles from both "you missed this" and "your opponent missed this" moments
- [ ] `P2` Auto-tag themes; feed into weakness model and spaced repetition
- [ ] `P2` "From your game vs. X on DATE" context line and link to the full game
- [ ] `P2` Insights: most-missed motifs in real games vs. puzzle performance; time-trouble correlation

## 15. Stats, progress & insights

- [ ] `P0` Current rating, total solved, overall accuracy
- [ ] `P1` Rating graph with ranges (7 d / 30 d / 90 d / 1 y / all), peak rating marker
- [ ] `P1` Puzzle history list: every attempt with result, rating delta, time, date; tap to replay; filter solved/failed
- [ ] `P1` Performance by theme: attempts, accuracy, performance rating; sorted strengths & weaknesses; "train this" CTA per theme
- [ ] `P1` Dashboard time windows (1 / 7 / 30 / 90 days) and a radar chart across theme categories; available windows bounded by the `stats.window.max_days` parameter (§22)
- [ ] `P1` Activity calendar heatmap; current and longest daily streak
- [ ] `P1` Time stats: average solve time, by rating band, by theme; time spent training per day/week
- [ ] `P1` Per-mode bests and history (Rush/Storm/Streak/Battle)
- [ ] `P2` Accuracy by puzzle length, by side, by phase
- [ ] `P2` Weekly report (in-app + email/push): puzzles, rating change, best theme, weakest theme, suggested focus
- [ ] `P2` Percentile vs. all users
- [ ] `P2` Goals: target rating with projected date; weekly volume goals
- [ ] `P2` Data export (CSV/JSON of attempts)

## 16. Gamification & retention

- [ ] `P1` Daily goal (e.g., 5 / 10 / 20 puzzles or minutes), progress ring on home
- [ ] `P1` Daily streak with clear rules, timezone-safe day boundaries, and a visible "at risk" state
- [ ] `P1` Streak freeze / repair — `streak.freeze.use` quota (§22); earned freezes are temporal grants, never a special code path
- [ ] `P1` Achievements/badges: volume milestones, rating milestones, streak milestones, per-theme mastery, mode bests, perfect sessions
- [ ] `P1` Celebration moments: new peak rating, new personal best, milestone confetti — skippable, never blocking; voiced by the coach within its budget (§36.6)
- [ ] `P2` XP and levels; weekly leagues with promotion/relegation
- [ ] `P2` Daily/weekly quests ("solve 5 endgame puzzles", "score 20 in Rush")
- [ ] `P2` Cosmetic unlocks (boards, pieces, profile flair) as rewards — each is a scoped `cosmetic.*` grant (§22)
- [ ] `P2` Seasonal events and themed puzzle packs (World Championship puzzles, famous-player packs)
- [ ] `P1` Anti-dark-pattern guardrails: no guilt-trip copy, easy notification opt-down, zen mode

## 17. Social & competitive

- [ ] `P1` Public profile: avatar, username, country flag, ratings, bests, badges, activity; privacy controls
- [ ] `P1` Friends/follow: search by username, invite link, contact import (opt-in), friend requests, block
- [ ] `P1` Leaderboards: global / country / friends; per mode; daily / weekly / all-time; pagination + "jump to me"; inclusion requires `leaderboard.participate` (§22) — no auth-state checks in leaderboard code
- [ ] `P1` Share a puzzle: deep link that opens the exact puzzle in-app (or web fallback), plus rendered image of the position
- [ ] `P1` Share results: daily puzzle card, Rush score card, rating milestone card
- [ ] `P2` Animated GIF/video export of the solution
- [ ] `P2` Direct challenges: send a Rush/Battle challenge; async "beat my score on this exact sequence"
- [ ] `P2` Clubs/teams with team leaderboards and club tournaments
- [ ] `P2` Scheduled puzzle tournaments/arenas
- [ ] `P2` Activity feed (friends' PBs and milestones), reactions
- [ ] `P1` Moderation: username filter, report user, comment moderation queue, mute/ban tooling

## 18. Onboarding

- [ ] `P0` Play before signup: first puzzle on screen within seconds of first launch; account creation deferred
- [ ] `P0` Skill self-assessment (new to chess / beginner / intermediate / advanced / give online rating) → initial rating seed with high RD
- [ ] `P1` Fast calibration: first ~10 puzzles use large adaptive steps
- [ ] `P1` Interactive micro-tutorial run by the coach (§36): how to move, what "best move" means, multi-move puzzles, how rating works, hint cost
- [ ] `P1` True-beginner branch: how pieces move, check/mate basics, before entering rated puzzles
- [ ] `P1` Goal setting (daily target) and reminder time picker, followed by a well-timed notification permission prompt (after a success moment, with a pre-prompt)
- [ ] `P1` Personalization: board theme + piece set quick pick
- [ ] `P1` Account prompt at a value moment ("Save your 1540 rating"), and whenever a denial reason is `requires_account` (§22)
- [ ] `P2` Import history / link accounts from Lichess / Chess.com during onboarding

## 19. Accounts, sync & offline

The app is local-first with an existing sync engine (§0.0). The items below describe the user-visible guarantees; the offline, sync, conflict and prefetch behaviors are delivered by the existing engine and its table definitions. Features must not implement their own versions of any of them.

- [ ] `P0` Anonymous accounts with local persistence, upgradeable to a verified account without data loss. "Anonymous" is an auth fact consumed by the policy resolver (§22); feature code never branches on it
- [ ] `P0` Sign in with Apple, Google, email (magic link or password); Sign in with Apple is mandatory on iOS if other social logins exist
- [ ] `P1` Link Lichess / Chess.com identities
- [ ] `P1` Cross-device sync: rating, history, seen-set, settings, collections, SRS state, streaks — enabled via `account.sync.enable` (§22)
- [ ] `P1` Offline mode: puzzle batches live in synced local tables (hundreds cached), the full solve flow runs against local state, rating shows a local provisional value until the engine's server-side computation syncs back; attempts are ordinary local writes the sync engine delivers in order
- [ ] `P1` Conflict resolution: attempts are an append-only table with the engine's append/idempotent conflict policy; rating is recomputed in the prescribed server-side mutator; duplicate attempt IDs are idempotent by table definition, not by feature code
- [ ] `P1` Multi-device concurrency: two devices don't get served the same "next" puzzle as rated twice
- [ ] `P1` Downloadable offline packs (by theme/rating) for flights `P2` for large packs — `offline.pack.download` grant with `offline.pack.max_mb` / `offline.cache.max_puzzles` caps (§22)
- [ ] `P0` Account deletion in-app (store requirement), data export
- [ ] `P1` Username change rules, email verification, password reset, session management / logout everywhere
- [ ] `P1` Merge flow when an anonymous user signs into an existing account (choose or merge histories)

## 20. Notifications, widgets & re-engagement

- [ ] `P1` Daily reminder at user-chosen time; smart-shift to the user's usual training time `P2`
- [ ] `P1` Streak-at-risk reminder in the evening, only if goal not yet met
- [ ] `P1` Daily puzzle available
- [ ] `P1` Review queue due
- [ ] `P1` Social: friend request, challenge received, friend beat your score
- [ ] `P1` Granular per-category toggles; quiet hours; hard frequency cap
- [ ] `P1` Deep links from every notification to the exact destination
- [ ] `P1` Home-screen widgets: daily puzzle diagram, streak + goal ring, rating sparkline
- [ ] `P2` Lock-screen widgets / Live Activity for an in-progress streak; Android equivalents
- [ ] `P2` Interactive widget: solve a mate-in-1 on the widget
- [ ] `P2` Email: weekly progress report, win-back sequence; one-click unsubscribe
- [ ] `P2` Watch complication for streak

## 21. Settings (full list)

- [ ] **Board:** board theme, piece set, coordinates (inside/outside/off), highlight last move, show legal moves, highlight check, animation speed, board orientation lock, custom colors
- [ ] **Input:** drag/tap/both, confirm move, piece-lift size and offset, promotion behavior in non-puzzle contexts, left-handed layout
- [ ] **Sound & haptics:** master sound, sound theme, volume, haptics on/off
- [ ] **Puzzle behavior:** default difficulty, auto-advance (off / on success / always) and delay, show timer, show puzzle rating before solving, show rating change, hide my rating (zen), show move-count progress, hint delay, opponent reply speed, retry on fail default
- [ ] **Notation:** SAN letters / figurine / localized piece letters
- [ ] **Analysis:** engine on/off by default, lines (1–3), max depth/time, threads, hash, eval bar, best-move arrows, cloud eval allowed
- [ ] **Appearance:** light/dark/system, accent color, app icon alternates `P2`
- [ ] **Notifications:** per-category toggles, reminder time, quiet hours
- [ ] **Account:** profile, linked accounts, privacy (profile visibility, leaderboard participation, friend requests), blocked users, export data, delete account
- [ ] **Membership & purchases:** active products and validity (facts from billing), manage, restore purchases, redeem code. Displays what the user owns; never a tier label authored in code
- [ ] **Data:** offline cache size, download packs, clear cache, cellular data usage
- [ ] **Accessibility:** see §28
- [ ] **Language**
- [ ] **About:** version, licenses/attribution (engine GPL, puzzle DB, piece sets), terms, privacy, contact, rate the app
- [ ] `P1` All settings sync across devices, with device-local overrides where sensible (e.g., haptics)

## 22. Permissions, entitlements & usage limits

Every gated feature and every usage cap in the app goes through **one authorization layer**. Feature code asks a permission question and gets an answer; it never asks what kind of user it is talking to. Product tiers (whatever they are called this year — a guest tier, a free tier, a paid tier, a trial, a coach plan) exist **only as named bundles of grants in policy configuration**. No tier name, plan name, or "is this user premium" concept appears anywhere in application code, database columns used by feature code, analytics event schemas, or UI strings authored by developers.

### 22.1 Non-negotiable rules

- [ ] `P0` **One entry point.** All gating goes through the permission service: `can(subject, action, context) → Decision` and `consume(subject, quota, amount, idempotencyKey) → Decision`. Nothing else in the codebase decides who may do what.
- [ ] `P0` **No tier coupling.** Forbidden in feature code, UI, API handlers, analytics, and schema: tier/plan names, `isPremium`, `isPro`, `isPaid`, `isGuest`, `isFree`, `plan`, `tier`, `subscriptionLevel`, or any equivalent. Grep-clean, enforced by lint (§22.11).
- [ ] `P0` **Facts in, permissions out.** Only the policy resolver reads account facts (auth state, active purchases, admin grants, promo grants, org membership, fair-play flags). Everything downstream of the resolver sees only actions, quotas and decisions.
- [ ] `P0` **Authoritative via the sync engine.** The resolved `PermissionSet` and quota counters are synced tables (server-only write scope, client read); the client decides instantly from local state, `consume` is an optimistic local write, and the prescribed server-side mutator re-evaluates it and syncs the authoritative decision back. A client-side "allowed" is a hint, never a grant.
- [ ] `P0` **Config-driven.** Tiers, limits, windows and upsell targets live in policy config that product can change without a deploy (remote config / admin console), with versioning and rollback.
- [ ] `P0` **Denials carry a reason, not a tier.** A denied decision returns a machine-readable reason (`quota_exhausted`, `not_granted`, `requires_account`, `restricted`) plus an optional `unlockRef` that the upsell UI resolves via config. The client never says "upgrade to Plus" from a hard-coded string; the copy comes from the config entry that `unlockRef` points at.

### 22.2 Permission model

- [ ] `P0` **Actions** — string identifiers in a `domain.verb` form, e.g. `puzzle.rated.solve`, `run.rush.start`, `analysis.engine.use`. An action is either granted or not.
- [ ] `P0` **Quotas** — an action with a numeric allowance: `{ limit: number | "unlimited", window: "day" | "week" | "month" | "rolling24h" | "lifetime" | "concurrent", resetBoundary: "userLocalMidnight" | "utcMidnight" }`. A quota is consumed, not merely checked.
- [ ] `P0` **Caps** — numeric limits that aren't consumed over time but bound a state: max collections, max SRS queue size, max stats window in days, max offline pack size. Represented as `{ max: number | "unlimited" }`.
- [ ] `P0` **Parameters** — non-boolean grants that tune a feature: engine max depth, hint tiers available, daily-archive lookback days.
- [ ] `P0` **Context** — the input to a decision beyond the subject: mode, variant, course id, collection id, puzzle id, client platform, requested amount.
- [ ] `P0` **Decision** — `{ allowed: boolean, reason?: string, remaining?: number, resetsAt?: timestamp, unlockRef?: string, policyVersion: string }`.
- [ ] `P1` **Scopes** — grants can be scoped to a resource pattern (`course.access` on `course:endgames-101`, `collection.play` on collections owned by a coach's students).
- [ ] `P1` **Restrictions** — negative grants (deny rules) layered on top for fair-play sanctions, age gating, regional legal limits, and organization policy. Deny always beats allow.

### 22.3 Policy resolution

- [ ] `P0` **Resolver inputs (facts):** authentication state (anonymous vs. verified account), active purchases/subscriptions from the billing service, admin-issued grants, promo/referral/reward grants, trial state, org/coach membership, fair-play status, age band, region.
- [ ] `P0` **Resolver output:** a `PermissionSet` = the union of all grants from all sources, with restrictions applied last. Cached per user with a `policyVersion` and a `factsHash` so it invalidates when either changes.
- [ ] `P0` **Merging:** boolean grants union; numeric quotas and caps take the **maximum** across sources; parameters take the most permissive; restrictions override everything.
- [ ] `P0` **Roles are bundles, not identities.** A "role" in config is just a named set of grants that the resolver assigns when a fact predicate matches (e.g., `when: { auth: "anonymous" }`, `when: { purchase: "sub_monthly" }`). Roles are data. Code never references a role by name.
- [ ] `P0` **Baseline role** — a role with `when: always` so that a user with no other matching role still gets a defined set (this is where the most limited experience lives).
- [ ] `P1` **Temporal grants:** every grant can carry `validFrom` / `validUntil` (trials, promos, streak rewards, "earned 5 extra hints today").
- [ ] `P1` **Invalidation:** billing webhooks, admin edits and policy publishes emit a `permissions.changed(userId)` event; server cache and client snapshot refresh. Client also refreshes on foreground and at snapshot TTL.
- [ ] `P1` **Fail policy:** if the resolver is unreachable, the server uses the last cached `PermissionSet` (bounded staleness, e.g. 1 h); if none exists, it falls back to the baseline role. It never fails open to "everything".
- [ ] `P2` **Simulation API** for admins and tests: "what would user X be allowed to do under policy version Y?"

### 22.4 Quota accounting

- [ ] `P0` **Consumption is idempotent.** Every `consume` carries an idempotency key (attempt id, run id). Retries and offline replays never double-charge.
- [ ] `P0` **Consume at the right moment.** Rated puzzles are charged when served/started, not when finished — a puzzle already on the board always completes, and the limit UX never interrupts mid-puzzle. Timed runs are charged at `POST /runs` (run start).
- [ ] `P0` **Windows are computed server-side** from server time; `resetBoundary: userLocalMidnight` uses the user's stored timezone, with DST and timezone-travel handled the same way streaks are (§34).
- [ ] `P0` **Remaining + resetsAt** are returned on every decision and on `GET /me/permissions`, so the UI can show "3 left · resets in 4 h" without a second call.
- [ ] `P1` **Offline mode:** client decrements its local copy of the counters against the last snapshot; on sync the server replays consumption in order. A small **overdraft tolerance** (config, e.g. +2) accepts attempts made offline slightly past the limit rather than discarding the user's work; beyond that, offline attempts are stored as unrated practice.
- [ ] `P1` **Refunds:** a consumed unit is released if the action never materialized (puzzle failed to load, run aborted before the first move within N seconds). Explicit `release(idempotencyKey)`.
- [ ] `P1` **Concurrent quotas** (e.g. one active Battle at a time) use lease semantics with expiry.
- [ ] `P2` **Earned allowance:** rewards (streak milestones, rewarded ads, referrals) are modeled as temporal grants that raise a quota, never as special-case code paths.

### 22.5 Client integration

- [ ] `P0` **Snapshot delivery:** the `PermissionSet`, counters, `resetsAt` and `policyVersion` are rows in synced tables scoped to the user, so they are present on cold start and updated by the sync engine when the resolver rewrites them; no dedicated fetch, TTL or push-invalidation code in the feature.
- [ ] `P0` **Single client API:** `permissions.can(action, ctx)`, `permissions.remaining(quota)`, `permissions.gate(action, ctx, onDenied)`; UI components use a `<Gated action=...>` wrapper / hook. Nothing else in the client reads the snapshot.
- [ ] `P0` **Three UI treatments, chosen per action in config, not in code:** `hide` (the entry point doesn't render), `lock` (rendered with a lock badge; tapping opens the unlock surface), `soft` (rendered normally; the denial surface appears on attempt). Config default is `lock` for features and `soft` for quotas.
- [ ] `P0` **Denial surface** is one shared component that takes the `Decision` and resolves `unlockRef` → copy, benefits list, CTA target from config. It is the only place upsell copy is rendered.
- [ ] `P1` **Optimistic UI:** the client trusts its snapshot for instant feedback, then reconciles on server response; a server denial after a client allow shows the denial surface and rolls back local state.
- [ ] `P1` **Quota meters** where useful (home screen chip "Rated puzzles: 7 left today"), driven entirely by `remaining`/`limit`; hidden automatically when `limit` is `unlimited`.
- [ ] `P1` **Snapshot versioning:** the client stores `policyVersion`; if the server responds with a newer version on any call, the client refetches the snapshot.

### 22.6 Server enforcement

- [ ] `P0` **Every server-side mutator (and every non-sync endpoint) declares the action (and quota) it requires** using the base's prescribed guard/decorator primitive; handlers can't be reached without a decision. Mutators or endpoints without a declaration fail CI.
- [ ] `P0` **Run tokens embed the decision:** `POST /runs` performs the consume; the signed run token carries `policyVersion` and the run's granted parameters (e.g., duration variant), so later calls don't re-litigate.
- [ ] `P0` **Batch attempt ingestion** (offline replay) evaluates each attempt's consumption in client-timestamp order under the policy that was active at that time (policy versions are retained).
- [ ] `P1` **Decision audit log** (sampled for allows, complete for denials): userId, action, context hash, decision, reason, policyVersion, latency. Feeds analytics and support.
- [ ] `P1` **Rate limiting is separate** from quotas: abuse limits (§25) are infrastructure; quotas are product policy. Neither reads the other's config.

### 22.7 Catalog of gated actions and quotas

Everything below is a permission. Nothing below is allowed to be checked any other way. Limits shown in §22.8 are illustrative configuration, not code.

**Solving**
- [ ] `P0` `puzzle.rated.solve` — quota
- [ ] `P0` `puzzle.practice.solve` — quota (usually unlimited)
- [ ] `P1` `puzzle.theme_session.start` — grant, optional scope by theme category
- [ ] `P1` `puzzle.opening_session.start` — grant
- [ ] `P1` `puzzle.custom_filter.use` — grant
- [ ] `P1` `puzzle.difficulty.adjust` — grant (allowed range as parameter)
- [ ] `P1` `hint.use` — quota (per day), parameter `hint.tiers` = which tiers are available
- [ ] `P1` `solution.view` — grant (or quota)
- [ ] `P1` `puzzle.retry` — grant

**Modes**
- [ ] `P1` `run.rush.start` — quota per variant (context: `variant`)
- [ ] `P1` `run.storm.start` — quota
- [ ] `P1` `run.streak.start` — quota
- [ ] `P1` `daily.solve` — grant; `daily.archive.access` — parameter `lookbackDays`
- [ ] `P1` `mate_trainer.access` — grant, scope by ladder
- [ ] `P1` `collection.play` — grant, scope by owner/visibility
- [ ] `P2` `battle.play` — quota + concurrent lease
- [ ] `P2` `racer.play` — grant; `racer.host` — grant
- [ ] `P2` `woodpecker.cycle.start` — grant; cap `woodpecker.set.max_size`
- [ ] `P2` `endgame_trainer.access`, `drills.visualization.access`, `drills.blindfold.access`, `judgment.access` — grants
- [ ] `P1` `play_from_position.start` — grant

**Review, analysis, learning**
- [ ] `P1` `analysis.engine.use` — grant; parameters `analysis.engine.max_depth`, `analysis.engine.multipv`
- [ ] `P2` `analysis.cloud_eval.use` — quota
- [ ] `P1` `analysis.refutation.view` — grant ("why was my move wrong")
- [ ] `P1` `srs.review.access` — grant; cap `srs.queue.max_items`; quota `srs.review.solve`
- [ ] `P1` `course.access` — grant scoped by course id; `lesson.complete` — grant
- [ ] `P2` `personal_games.import` — grant; quota `personal_games.analyze` (games/day); cap `personal_games.linked_accounts.max`
- [ ] `P2` `explanation.view` — grant

**Stats & data**
- [ ] `P1` `stats.overview.view` — grant; parameter `stats.window.max_days`
- [ ] `P1` `stats.theme_breakdown.view` — grant
- [ ] `P1` `stats.history.view` — parameter `stats.history.max_items`
- [ ] `P2` `stats.weekly_report.receive` — grant
- [ ] `P2` `stats.export` — quota

**Content & customization**
- [ ] `P1` `collection.create` — cap `collection.max_count`; `collection.max_items` — cap
- [ ] `P2` `collection.share` — grant; `collection.import` — grant
- [ ] `P1` `offline.pack.download` — grant; cap `offline.pack.max_mb`; cap `offline.cache.max_puzzles`
- [ ] `P1` `cosmetic.board_theme.use` — scoped by theme id; `cosmetic.piece_set.use` — scoped by set id
- [ ] `P2` `cosmetic.custom_colors.use` — grant

**Social & identity**
- [ ] `P1` `profile.public.enable` — grant
- [ ] `P1` `leaderboard.participate` — grant (the baseline role typically lacks it; this replaces any "guests can't be on leaderboards" check)
- [ ] `P1` `social.friends.manage` — grant; `social.challenge.send` — quota
- [ ] `P2` `comment.post` — grant; `comment.read` — grant
- [ ] `P2` `club.create` — cap; `club.join` — grant
- [ ] `P2` `coach.assign` — grant scoped to students

**Engagement & retention**
- [ ] `P1` `streak.freeze.use` — quota (per month)
- [ ] `P1` `goal.daily.set` — grant
- [ ] `P2` `quest.access` — grant
- [ ] `P2` `ads.exempt` — grant (the *absence* of this grant is what shows ads; the ads module asks `can(ads.exempt)`, nothing else)
- [ ] `P2` `ads.rewarded.watch` — quota (a watched ad issues a temporal grant that raises another quota)

**Account**
- [ ] `P0` `account.sync.enable` — grant (cross-device sync)
- [ ] `P0` `account.data.export` — grant (legal minimum: every verified account has it)
- [ ] `P1` `account.link_external` — grant

### 22.8 Example policy configuration (data — the only place tier names exist)

Product tiers are authored here, in the policy service's config, and nowhere else. The names below are examples and can change without touching code.

```yaml
policyVersion: 2026-09-19.1

roles:
  baseline:                       # every subject gets this
    when: always
    grants:
      puzzle.rated.solve:      { limit: 5, window: day, resetBoundary: userLocalMidnight }
      puzzle.practice.solve:   { limit: 20, window: day }
      hint.use:                { limit: 3, window: day }
      hint.tiers:              [piece]
      solution.view:           true
      puzzle.retry:            true
      daily.solve:             true
      daily.archive.access:    { lookbackDays: 0 }
      analysis.engine.use:     false
      stats.overview.view:     true
      stats.window.max_days:   7
      collection.max_count:    0
      offline.cache.max_puzzles: 25
      cosmetic.board_theme.use: [brown, green]
      cosmetic.piece_set.use:   [standard]
      leaderboard.participate: false
      account.sync.enable:     false
      streak.freeze.use:       { limit: 0, window: month }

  verified_account:               # a signed-in user with no purchase
    when: { auth: verified }
    grants:
      puzzle.rated.solve:      { limit: 15, window: day, resetBoundary: userLocalMidnight }
      puzzle.practice.solve:   unlimited
      hint.use:                { limit: 5, window: day }
      run.rush.start:          { limit: 3, window: day }
      run.storm.start:         { limit: 3, window: day }
      run.streak.start:        { limit: 1, window: day }
      daily.archive.access:    { lookbackDays: 7 }
      srs.review.access:       true
      srs.queue.max_items:     50
      stats.window.max_days:   30
      stats.theme_breakdown.view: true
      collection.max_count:    3
      collection.max_items:    100
      leaderboard.participate: true
      profile.public.enable:   true
      social.friends.manage:   true
      account.sync.enable:     true
      account.data.export:     true
      offline.cache.max_puzzles: 100
      streak.freeze.use:       { limit: 1, window: month }

  member:                         # any active paid entitlement
    when: { purchase.any: [sub_monthly, sub_annual, lifetime] }
    grants:
      puzzle.rated.solve:      unlimited
      hint.use:                unlimited
      hint.tiers:              [concept, piece, square]
      run.rush.start:          unlimited
      run.storm.start:         unlimited
      run.streak.start:        unlimited
      battle.play:             unlimited
      racer.host:              true
      daily.archive.access:    { lookbackDays: unlimited }
      analysis.engine.use:     true
      analysis.engine.max_depth: 24
      analysis.refutation.view: true
      analysis.cloud_eval.use: { limit: 200, window: day }
      srs.queue.max_items:     unlimited
      stats.window.max_days:   unlimited
      stats.weekly_report.receive: true
      stats.export:            { limit: 5, window: month }
      course.access:           "*"
      personal_games.import:   true
      personal_games.analyze:  { limit: 50, window: day }
      collection.max_count:    unlimited
      collection.share:        true
      offline.pack.download:   true
      offline.pack.max_mb:     500
      cosmetic.board_theme.use: "*"
      cosmetic.piece_set.use:   "*"
      ads.exempt:              true
      streak.freeze.use:       { limit: 4, window: month }

  trial:
    when: { trial.active: true }
    inherits: member
    validUntil: trial.endsAt

  coach:
    when: { org.role: coach }
    grants:
      coach.assign:            { scope: "students:*" }
      collection.max_count:    unlimited

restrictions:
  fair_play_shadow:
    when: { fairPlay.flag: shadow }
    deny: [leaderboard.participate, battle.play, racer.play]
  underage:
    when: { ageBand: under13 }
    deny: [profile.public.enable, comment.post, comment.read, social.friends.manage]

unlockRefs:                      # what the denial surface shows; copy is localized by key
  puzzle.rated.solve:
    requires_account: { titleKey: unlock.rated.account, ctaTarget: signup }
    quota_exhausted:  { titleKey: unlock.rated.limit,   ctaTarget: offer.member, secondaryCta: wait_for_reset }
  analysis.engine.use:
    not_granted:      { titleKey: unlock.analysis,      ctaTarget: offer.member }
```

Notes on the example:
- `verified_account` and `member` both match a paying user; merging takes the maximum, so the paid grants win without any code path knowing "which one" the user is.
- Adding a new tier (say a mid-priced one) is a new role block in this file. No release is required.
- Changing a limit is a config publish with a new `policyVersion`; the old version is retained for replaying offline attempts.

### 22.9 Billing & purchases

Billing produces **facts** (an active product, a trial, a refund). The resolver turns facts into grants. Billing code never grants a permission directly and never knows what a product unlocks.

- [ ] `P1` Product catalog: products (`sub_monthly`, `sub_annual`, `lifetime`, course packs, cosmetic packs) as store SKUs mapped to fact identifiers; the mapping from fact to grants lives only in policy config (§22.8)
- [ ] `P1` StoreKit 2 / Google Play Billing / Stripe (web) integration; server-side receipt validation; server notifications for renewals, refunds, grace periods, billing retry, family sharing
- [ ] `P1` Entitlement facts service: `{ userId, product, platform, status, validFrom, validUntil, originalTxId }`; changes emit `permissions.changed(userId)`
- [ ] `P1` Cross-platform: facts attach to the account, so a purchase on one platform applies everywhere the account signs in
- [ ] `P1` Restore purchases, upgrade/downgrade/crossgrade proration, cancellation info, refund handling (refund → fact revoked → grants recomputed → client snapshot refreshed)
- [ ] `P1` Offer surfaces (paywalls) are config-driven: which offer to show is resolved from `unlockRef` → `ctaTarget` → offer config (products, price display, benefits list keys, trial terms, legal footer). The client renders whatever offer config it receives
- [ ] `P1` Limit UX: visible remaining count and reset countdown driven by the decision payload; never interrupt mid-puzzle (consumption happens at puzzle start, §22.4)
- [ ] `P1` Offer A/B testing via remote config on the offer objects and on policy roles (e.g., test a baseline limit of 5 vs 8), with guardrail metrics
- [ ] `P2` Lifetime purchase, family sharing, student/regional pricing, promo codes (a redeemed code = a temporal grant fact), win-back and intro offers
- [ ] `P2` Ads: shown only when `ads.exempt` is denied; never during a puzzle or timed run; rewarded ads issue temporal grants; consent management; "remove ads" product maps to the `ads.exempt` grant in config
- [ ] `P2` Gifting; coach/team plans (org membership fact → coach role)
- [ ] `P1` Subscription compliance: clear pricing, renewal terms, easy cancellation path; account screen shows active products and their validity (facts), not a tier label authored in code

### 22.10 Admin & operations

- [ ] `P1` Policy editor in the admin console: edit roles, limits, restrictions, unlock copy; validate against the action catalog; diff, publish with a new version, rollback
- [ ] `P1` Per-user grants: issue/revoke individual grants or full roles with validity windows and a reason (support cases, creators, testers); all changes audited
- [ ] `P1` User inspector: current facts, resolved `PermissionSet`, live counters, recent denials, "simulate under policy version X"
- [ ] `P1` Metrics: denial rate per action, conversion from denial surface, quota utilization histograms, decision latency p95
- [ ] `P2` Staged rollout of policy versions by percentage or cohort

### 22.11 Enforcing "no tier coupling" in the codebase

- [ ] `P0` Package boundaries: `policy/` (resolver, config schema, catalog of action names) is the only package that may import billing facts, auth facts or role definitions. Feature packages depend on the `permissions` client interface only. Enforced by dependency-cruiser / module boundary rules
- [ ] `P0` Lint rule with a denylist of identifiers and string literals (tier names as they appear in config, `premium`, `pro`, `plus`, `free`, `guest`, `tier`, `plan`, `subscriptionLevel`, `isPaid`, `entitled`) outside `policy/` and `billing/`; CI fails on any hit. Allowlist for legal/marketing copy files
- [ ] `P0` Action names are constants generated from the catalog (§22.7); a typo'd action fails type-checking, not at runtime
- [ ] `P0` Analytics events carry `action`, `decision`, `reason`, `policyVersion` — never a tier. Segmenting by tier is done in the analytics warehouse by joining on facts, not by emitting tier names from clients
- [ ] `P1` Database: no `tier`/`plan` column on the user table used by feature code. Facts tables (entitlements, grants) are read by the resolver only. Feature queries that need to filter by capability use a materialized `user_permissions` view produced by the resolver
- [ ] `P1` Code review checklist item: "Does this PR introduce any gating? If so, is it a `can()`/`consume()` call with a catalogued action?"
- [ ] `P1` Tests (see also §35): resolver unit tests with fixture fact sets; property test that every action in the catalog resolves to a defined value under the baseline role; contract test that every declared endpoint has a permission declaration; grep test that the denylist finds zero hits

## 23. Content pipeline

- [ ] `P0` Ingest the Lichess puzzle database (CC0). Parse CSV (`PuzzleId, FEN, Moves, Rating, RatingDeviation, Popularity, NbPlays, Themes, GameUrl, OpeningTags`), load to DB, build indexes on rating, themes, opening, popularity
- [ ] `P0` Validation pass on ingest: every move legal, line ends on solver move, FEN valid, no duplicates by position hash + solution
- [ ] `P1` Quality gating: minimum plays, minimum popularity, max RD; quarantine on reports
- [ ] `P1` Own generation pipeline (long term): mine games (Lichess open game DB, master PGNs you have rights to) → engine scan for single-winning-move positions → uniqueness check (best move clearly better than second-best by threshold, at every solver ply) → length trimming → theme auto-tagging (rule-based detectors per motif) → seed rating from engine/depth heuristics then let Glicko converge
- [ ] `P1` Re-verification of reported puzzles with a deeper engine search; auto-retire or fix (add alternate solution)
- [ ] `P1` Curated sets by human editors: beginner ladders, famous combinations, pattern packs
- [ ] `P1` Daily puzzle selection: editorial queue with fallback auto-pick (high popularity, mid rating, not recently used)
- [ ] `P1` Rush/Storm difficulty ladder curation: short, unambiguous, high-quality puzzles in fixed rating steps
- [ ] `P2` Explanations at scale: template-based from detected motifs, optionally LLM-assisted and engine-verified, with human review for curated content
- [ ] `P1` Licensing hygiene: track source and license per puzzle; do not copy puzzles from copyrighted books/apps; attribute piece sets and engine
- [ ] `P1` Content delivery: puzzles served via API in batches; static packs via CDN for offline

## 24. Engine integration

- [ ] `P1` Stockfish on-device: native build for iOS/Android, WASM (multi-threaded where cross-origin isolation is available, single-thread fallback) for web
- [ ] `P1` NNUE network bundled or downloaded on first use (mind app size — consider the small net)
- [ ] `P1` UCI wrapper: start/stop, position set, go depth/movetime, multi-PV, parse `info` lines, handle `bestmove`, cancel cleanly on position change
- [ ] `P1` Resource limits: capped threads and hash on mobile, auto-stop at depth/time, pause when backgrounded, thermal and low-power awareness
- [ ] `P1` Eval presentation: centipawns → friendly bar; mate scores (`M3`); always from White's perspective or solver's — be consistent
- [ ] `P1` Strength-limited play for "continue from position" (Skill Level / UCI_Elo, plus move-time caps)
- [ ] `P2` Cloud eval cache for common positions; server-side deep analysis for reports and personal-game mining
- [ ] `P2` Tablebase probing for endgames (server API)
- [ ] `P1` **GPL compliance:** Stockfish is GPLv3 — linking it into your binary has licensing consequences. Common approach: isolate it as a separate process/module and publish that component's source, or get legal advice before shipping
- [ ] `P0` The engine is **never** available during an unresolved rated puzzle or any competitive run

## 25. Backend & API

The primary data path is the sync engine (§0.0): features write local tables, prescribed server-side mutators compute authoritative results, and the engine syncs both ways. The endpoints below exist only for the cases the base's conventions route outside sync (bulk read-only catalog, real-time rooms, billing webhooks, admin). Do not add an endpoint for anything a table + mutator can express.

- [ ] `P0` Services: auth, users/profiles, puzzle catalog, puzzle selection, attempts + rating, settings sync, **permissions/policy** (§22)
- [ ] `P1` Additional: leaderboards, social graph, notifications, billing (produces entitlement facts only), content CMS, reports/moderation, analytics ingestion, real-time (battles/races), game-import + analysis workers
- [ ] `P0` Core endpoints: `GET /puzzles/next?mode&theme&difficulty&count`, `POST /attempts` (batch, idempotent), `GET /me` (includes the permission snapshot), `GET /me/permissions`, `GET /me/stats`, `GET /puzzles/{id}`, `GET /daily`
- [ ] `P1` Run endpoints for Rush/Storm/Streak: `POST /runs` (consumes the mode's start quota, returns signed run token + puzzle sequence), `POST /runs/{id}/moves` or end-of-run submission with full move log and timestamps
- [ ] `P1` Idempotency keys on all writes; attempts are an append-only event log; ratings derivable by replay
- [ ] `P1` Leaderboards on sorted sets (Redis) with periodic snapshots; friend boards computed on read
- [ ] `P2` Real-time: WebSocket service for Battle/Racer — rooms, synchronized start, heartbeats, reconnection with state resync, server clock authority
- [ ] `P1` Matchmaking service (rating bands that widen over wait time)
- [ ] `P1` Caching/CDN for puzzle batches, daily puzzle, theme metadata, images
- [ ] `P1` Rate limiting, abuse protection, bot detection on signup (infrastructure limits; distinct from product quotas in §22)
- [ ] `P1` Observability: structured logs, metrics, tracing, alerting; SLOs for `next puzzle` latency (p95 < 200 ms) and attempt ingestion
- [ ] `P1` Feature flags + remote config
- [ ] `P1` Migrations, backups, disaster recovery; GDPR delete pipeline that actually purges
- [ ] `P1` API versioning and forced-upgrade / soft-upgrade mechanism for old clients

## 26. Anti-cheat & fair play

- [ ] `P1` Server-side validation of every rated attempt and every competitive run (replay the move log against the solution)
- [ ] `P1` Signed run tokens with server-issued sequence and start time; reject impossible timelines (moves faster than human/animation minimums, total time > allowed)
- [ ] `P1` For leaderboard modes, consider not shipping solutions in plaintext: either validate move-by-move server-side (latency cost) or ship encrypted/obfuscated and rely on server replay + heuristics
- [ ] `P1` Statistical flags: accuracy vs. rating outliers, superhuman solve times on hard puzzles, zero-variance timing, sudden rating spikes, repeated-puzzle-ID anomalies
- [ ] `P1` Consequences: shadow-exclude from leaderboards, exclude from puzzle-rating updates, rating reset, ban; appeal path
- [ ] `P1` Prevent "peek then reinstall" farming: leaderboard inclusion requires the `leaderboard.participate` grant (which the baseline role lacks, §22); device attestation (App Attest / Play Integrity) `P2`
- [ ] `P1` Puzzle ratings only learn from clean users
- [ ] `P2` Multi-account detection for Battle rating manipulation (win trading)

## 27. Platform specifics

**iOS / iPadOS**
- [ ] `P0` iPhone all sizes, safe areas, Dynamic Island clearance
- [ ] `P1` iPad layouts: side-by-side board + panel, Split View / Stage Manager resizing, pointer + hardware keyboard support, landscape
- [ ] `P1` WidgetKit widgets, App Intents / Shortcuts ("Start daily puzzle"), Spotlight indexing of daily puzzle `P2`
- [ ] `P1` Universal links; Handoff `P2`
- [ ] `P2` Apple Watch streak complication; Game Center leaderboards/achievements mirror; SharePlay race

**Android**
- [ ] `P0` Wide device matrix, gesture-nav insets, back-button/predictive-back behavior in every flow (especially mid-run confirmation)
- [ ] `P1` Tablets, foldables (posture-aware layout), Chromebooks with mouse/keyboard
- [ ] `P1` App widgets, app links, app shortcuts
- [ ] `P1` Low-end performance mode (reduced animations, smaller engine limits)

**Web**
- [ ] `P1` Responsive web app sharing the account system; puzzle deep links resolve on web for users without the app, with smart app banner
- [ ] `P1` PWA: installable, offline cache of a puzzle batch
- [ ] `P1` SEO landing pages for themes and the daily puzzle (acquisition channel)
- [ ] `P1` Full mouse + keyboard UX (right-click arrows, shortcuts)

**Shared**
- [ ] `P1` Landscape mode on phones (board left, controls right) or an explicit portrait lock
- [ ] `P1` State restoration after process death — especially during streaks and timed runs
- [ ] `P1` Audio session etiquette: don't interrupt the user's music/podcast; mix sounds

## 28. Accessibility

- [ ] `P1` Screen reader: every square is an accessible element ("e4, white knight"); board summary on demand (list pieces by side); last move announced; result announced
- [ ] `P1` Move entry without drag: tap-tap with announcements, and typed SAN / coordinate entry
- [ ] `P1` Dynamic type / font scaling across all non-board UI; layouts that survive the largest sizes
- [ ] `P1` Color-blind-safe feedback: never rely on red/green alone — icons + text + haptic
- [ ] `P1` High-contrast board theme and high-legibility piece set; letter-piece set
- [ ] `P1` Reduce-motion honored (cross-fade instead of slide, no confetti)
- [ ] `P1` Minimum 44 pt hit targets for controls; generous drag tolerance
- [ ] `P2` Switch Control / external keyboard full navigation
- [ ] `P2` Voice control move entry; spoken move announcements for blindfold training
- [ ] `P2` Untimed alternatives highlighted for users who can't play speed modes; extended-time option in non-leaderboard runs
- [ ] `P1` Audit against WCAG 2.2 AA for web

## 29. Localization

- [ ] `P1` String externalization from day one; pluralization rules; no concatenated sentences
- [ ] `P1` Priority languages: English, Spanish, Portuguese (BR), French, German, Russian, Hindi, Turkish, Italian, Polish, Chinese, Japanese, Korean, Arabic
- [ ] `P1` Localized piece letters in SAN (e.g., German `S` for knight) **or** figurine notation to sidestep the issue — make it a setting
- [ ] `P1` RTL layout for Arabic/Hebrew (board itself never mirrors)
- [ ] `P1` Localized theme names/descriptions, course content, store listings, screenshots, notification copy
- [ ] `P1` Locale-aware dates, numbers, week start; timezone-safe streak logic
- [ ] `P2` Community translation workflow (Crowdin-style)

## 30. Performance budgets

- [ ] `P0` Cold start to interactive puzzle: < 2 s on a mid-range device
- [ ] `P0` Touch-to-visual response: < 16 ms (one frame); drag at sustained 60 fps (120 on ProMotion)
- [ ] `P0` Move validation: < 5 ms, fully local
- [ ] `P0` Next-puzzle transition: < 100 ms from tap (prefetched)
- [ ] `P1` Rush-mode puzzle swap: < 50 ms, zero network dependency mid-run
- [ ] `P1` Memory: board screen steady-state small; engine memory capped; no leaks across thousands of puzzles in one session
- [ ] `P1` Battery: idle board draws nothing; engine auto-stops; no wakelocks outside runs
- [ ] `P1` App size: keep the base download lean; NNUE net, extra piece sets, offline packs as on-demand resources
- [ ] `P1` Crash-free sessions > 99.8%; ANR rate below Play vitals thresholds
- [ ] `P1` Network resilience: every call has timeout, retry with backoff, and an offline fallback path

## 31. Analytics & experimentation

- [ ] `P1` Event taxonomy: `puzzle_started`, `move_made` (correct/incorrect, ms), `hint_used`, `solution_viewed`, `puzzle_completed` (result, time, rating delta), `session_start/end`, `run_started/ended` (mode, score), `permission_denied` (action, reason, policyVersion), `unlock_surface_viewed` (unlockRef), `purchase_completed` (product), `notification_opened`, `share_tapped`, `setting_changed`, `report_submitted`
- [ ] `P1` Funnels: install → first puzzle → 5 puzzles → account → D1/D7/D30 retention → denial → unlock surface → purchase. Tier segmentation happens in the warehouse by joining facts, never from client-emitted tier names
- [ ] `P1` Content health dashboards: per-puzzle solve rate vs. expected, report rate, abandon rate, time distribution (finds broken puzzles automatically)
- [ ] `P1` Rating system health: predicted vs. actual solve probability calibration curve
- [ ] `P1` A/B framework with remote config; guardrail metrics (retention, crash rate)
- [ ] `P1` Crash + performance monitoring
- [ ] `P1` Consent-aware analytics (ATT on iOS, GDPR consent in EU); no PII in events

## 32. Privacy, legal, compliance

- [ ] `P0` Privacy policy, terms of service, in-app links
- [ ] `P0` App Store privacy nutrition labels / Play Data Safety form accurate
- [ ] `P0` In-app account deletion
- [ ] `P1` GDPR/CCPA: consent, access, export, erasure; DPA with vendors; data retention schedule
- [ ] `P1` Children: age gate; COPPA / GDPR-K handling — under-age accounts get no public profile, no chat/comments, no behavioral ads, parental consent where required. Chess skews young; plan for this
- [ ] `P1` UGC compliance (usernames, comments, set names): report, block, moderation SLA — required by both stores
- [ ] `P1` Subscription compliance: clear pricing, renewal terms, easy cancellation path
- [ ] `P1` Open-source license compliance and attribution screen (engine, chess libs, piece sets, puzzle DB)
- [ ] `P1` Security: TLS everywhere, token storage in Keychain/Keystore, hashed passwords (argon2/bcrypt), rate-limited auth, dependency scanning

## 33. Support & admin tooling

- [ ] `P1` In-app help center / FAQ: how rating works, why a move was "wrong", hint rules, streak rules, subscription questions
- [ ] `P1` Contact support with auto-attached diagnostics (app version, device, user ID, last puzzle ID)
- [ ] `P1` "Report this puzzle" with reasons: multiple solutions, wrong solution, bad/trivial, wrong theme, other + free text; attaches the user's attempted move
- [ ] `P1` Admin console: search user, view attempts, adjust/reset rating, issue/revoke grants and roles (§22.10), ban/shadow-ban (fair-play flags become restrictions in §22), handle reports, quarantine/retire/fix puzzles, edit themes, schedule daily puzzles, manage curated sets, feature flags
- [ ] `P1` In-app announcements / what's-new; maintenance-mode and forced-update screens
- [ ] `P2` Public status page; community Discord/forum link; feature-request board
- [ ] `P1` App-review prompt at a positive moment (new peak / PB), rate-limited

## 34. Edge-case checklist

**Chess logic**
- [ ] Underpromotion is the solution and the user has auto-queen on
- [ ] Promotion with capture; promotion delivering mate (any-mate rule applies across piece choice)
- [ ] En passant as the solution move; en passant that would be illegal due to a pin
- [ ] Castling as the solution; castling entered as king-takes-rook; castling rights in FEN wrong/missing
- [ ] Final move has multiple mates; non-final move has an alternative mate that is *faster* than the stored line (accept and end puzzle as solved)
- [ ] Solution move and another move transpose to the same position
- [ ] User's move is equally winning per engine but not the stored move (content fix path + soft-fail UX)
- [ ] Stalemate-trick and draw-goal puzzles: success criteria aren't "win material"
- [ ] Puzzle where solver is Black: orientation, coordinates, promotion picker direction all flipped correctly
- [ ] Discovered/double check highlighting; king in check at puzzle start

**Interaction**
- [ ] Drag begun during opponent animation; very fast double input; multi-touch with two fingers on two pieces
- [ ] Drag interrupted by system gesture, incoming call, notification pull-down, rotation
- [ ] Tap on promotion picker edge / outside; picker near screen edge when board is flipped
- [ ] Tapping "Next" twice quickly; tapping hint at the exact moment of moving
- [ ] Rotation or split-screen resize mid-drag and mid-animation

**State & sync**
- [ ] App killed mid-puzzle, mid-Rush, mid-Streak, mid-Battle
- [ ] Offline attempts synced days later, out of order, or duplicated
- [ ] Same account active on two devices simultaneously
- [ ] Anonymous → verified account merge where both have history
- [ ] Device clock manipulation (streaks, daily puzzle, run timers) — use server time
- [ ] Timezone travel and DST changes vs. daily streak boundaries
- [ ] Daily puzzle rollover while the user is solving it
- [ ] Puzzle retired/edited after being prefetched or while in a user's SRS queue or collection
- [ ] User exhausts the puzzle pool in a narrow filter (e.g., rare theme at extreme rating)
- [ ] Entitlement fact expires or is refunded mid-session / mid-run: the running puzzle/run completes under the decision it was started with; the next gated action re-evaluates
- [ ] Purchase completed while offline; snapshot refresh races with an in-flight `consume`
- [ ] Policy version published while the user is mid-session; offline attempts replayed under the version active at their client timestamp
- [ ] Quota window rolls over (user-local midnight) while a puzzle is on the board; timezone change moves the reset boundary
- [ ] Resolver unavailable: bounded-stale snapshot, then baseline role — never fail open
- [ ] Two devices consume the last unit of a quota simultaneously (server serializes; the loser gets `quota_exhausted` with a refund of any optimistic local decrement)
- [ ] Rating at extremes (very low/high) where few puzzles exist in the window

**Real-time**
- [ ] Disconnect/reconnect in Battle/Racer; opponent leaves; both finish on the same tick; lobby host leaves
- [ ] Clock drift between client and server; backgrounding during a timed run

## 35. Testing strategy

- [ ] `P0` Perft suite for the move generator; SAN/FEN/PGN round-trip property tests
- [ ] `P0` Full-database validation job: every puzzle's line is legal and terminates on the solver's move
- [ ] `P0` Solve-flow unit tests: correct path, wrong path, alt-mate acceptance, promotion variants, castling input variants
- [ ] `P1` Rating engine tests against reference Glicko-2 vectors; simulation tests for convergence and calibration
- [ ] `P1` Selection algorithm simulation: no repeats, window behavior, pool exhaustion
- [ ] `P1` Sync tests: offline queue replay, idempotency, conflict merges, multi-device
- [ ] `P1` UI automation for the critical flows (first launch → solve → next; Rush full run; purchase sandbox)
- [ ] `P1` Snapshot tests for board rendering across themes, orientations, sizes, RTL, dark mode, large type
- [ ] `P1` Accessibility audits with VoiceOver/TalkBack scripts
- [ ] `P1` Performance tests on low-end devices: frame timing during drag, 1,000-puzzle soak test for leaks
- [ ] `P1` Load tests on `next puzzle`, attempt ingestion, leaderboards, WebSocket rooms
- [ ] `P1` Billing tests: sandbox purchase, renewal, lapse, grace, refund, restore, cross-platform entitlement — asserting on resulting **grants**, not on any tier label
- [ ] `P0` Permission tests: resolver fixtures per fact combination; every catalogued action defined under the baseline role; merge semantics (max of quotas, deny wins); idempotent consume/replay; window rollover; contract test that every endpoint declares its action; CI grep/lint proving zero tier references outside `policy/` and `billing/`
- [ ] `P1` Beta channel (TestFlight / Play closed testing) with staged rollouts and kill-switch flags

## 36. Coach assistant (avatar & dialog)

The coach is a single, consistent assistant UI — an avatar that speaks — used everywhere in the puzzle experience. It is the app's voice: it introduces puzzles, reacts to moves, explains mistakes, nudges the next puzzle, and closes sessions. The overhaul goal: **smart** (says something specific to this position and this player), **concise** (one idea, one line, gone before it's in the way), and **habit-forming** (makes the next puzzle feel inevitable) without crossing into manipulation (§16 guardrails apply).

### 36.1 Design principles

- [ ] `P0` **One coach, everywhere.** Same avatar, name, voice, tone and component across solve flow, review, modes, onboarding, stats and the denial surface. No second "helper" character, no per-screen mascots.
- [ ] `P0` **Never blocks input.** The coach speaks alongside the board; it never covers it, never requires dismissal, never steals focus from a piece in hand.
- [ ] `P0` **One idea per line.** Hard caps: ≤ 12 words for reactions, ≤ 25 words for explanations, ≤ 2 lines on screen at once. Longer content lives behind a tap ("Show me").
- [ ] `P0` **Specific beats generic.** Every line should be impossible to say about a different puzzle or a different player: name the square, the piece, the motif, the streak number, yesterday's result. Generic praise ("Great job!") is a fallback of last resort and rate-limited.
- [ ] `P0` **Silence is a feature.** The coach earns each utterance. Default talk budget per session (§36.6); when in doubt, say nothing.
- [ ] `P0` **Truthful and grounded.** Explanations come from the solution line, theme tags and engine output, never invented. If the coach can't ground a statement, it uses a neutral line.
- [ ] `P1` **Consistent personality.** Written character sheet: warm, direct, dry humor, never sarcastic at the player's expense, never gushing. Second person, present tense, contractions, no exclamation stacking, no emoji in speech. Every line in the pool passes a tone check against the sheet.
- [ ] `P1` **Respects the player's state.** Detects tilt, speed-solving, learning mode and competitive mode, and shifts register (§36.5).

### 36.2 Avatar

- [ ] `P0` **Placement:** compact pill/bubble anchored to the coach avatar in a fixed slot (below board on phone portrait, side panel on tablet/desktop/landscape). Never over the board; never over the primary CTA.
- [ ] `P0` **States:** idle, listening (player has piece in hand), thinking (brief, ≤ 600 ms, before an explanation), speaking, pleased, sympathetic, celebrating, pointing (gesture toward a board square, paired with a board highlight/arrow layer from §2).
- [ ] `P0` **Motion budget:** subtle, looped idle; state transitions ≤ 250 ms; celebration ≤ 1.5 s and skippable; honors reduce-motion (static frames + fade).
- [ ] `P1` **Expression sync:** face/pose matches the line's sentiment tag (§36.8); mouth animation driven by TTS phoneme timings when audio is on, simple talk-loop when off.
- [ ] `P1` **Sizes:** mini (avatar + one line, default in solve flow), expanded (tap: full explanation, quick replies), hidden (user setting; text still available in a plain caption strip if they keep captions).
- [ ] `P1` **Board pointer:** the coach can highlight a square/arrow as part of a line ("The knight on e5 is the problem" + e5 pulses). Pointer clears on the player's next touch.
- [ ] `P2` **Customization:** a few avatar looks/outfits and voices as scoped `cosmetic.coach.*` grants (§22).
- [ ] `P2` **Idle life:** rare, small idle behaviors (glance at board, nod) so it feels present; never attention-seeking.

### 36.3 Dialog moments (trigger catalog)

Each moment maps to a **line pool** with selection rules. Every moment has a `budgetCost`, `cooldown`, `maxPerSession`, and `allowedModes`.

**Puzzle lifecycle**
- [ ] `P0` `puzzle.intro` — after the setup move animates. Usually silent; speaks when there's a real hook: first puzzle of session, side switch after a run of same color, a theme session prompt, a "watch the h-file" tease when the player's weakness theme is present (never a spoiler for the solution).
- [ ] `P0` `move.correct.continue` — mid-line correct move. Default silent; a short beat ("Keep going.", "Yes — and now?") on long lines, max 1 per puzzle.
- [ ] `P0` `move.wrong` — first wrong move. One line, specific to the refutation when available ("Qxh7 loses to …Kxh7 — the bishop isn't covering g6."), else the motif ("There's a fork here you're not using."). Then offers: Retry · Hint · Show me.
- [ ] `P0` `puzzle.solved` — result panel. Specific line (motif + why it worked, or time/rating context), then the next-puzzle nudge (§36.7).
- [ ] `P0` `puzzle.failed.review` — when the solution plays out. Names the key move and the idea in ≤ 25 words. Offers "Why not my move?" if a refutation exists.
- [ ] `P1` `hint.offered` / `hint.used` — conceptual hint tier is the coach speaking ("Which piece is doing two jobs?"); piece/square tiers pair speech with the board pointer.
- [ ] `P1` `puzzle.slow` — player idle > N seconds on a puzzle at/below their level: one nudge ("Checks first."). Once per puzzle, never in timed modes.
- [ ] `P1` `puzzle.fast_solve` — solved far faster than the band average: acknowledge speed, once per session.
- [ ] `P1` `puzzle.retry.success` — solved on retry: reinforce the correction, not the failure.

**Session arc**
- [ ] `P0` `session.start` — one line that references continuity: yesterday's result, streak count, review-due count, or the goal for today. Returning after a gap: acknowledge the gap without guilt ("Been a week. Let's warm up.").
- [ ] `P0` `session.goal_reached` — daily goal hit: celebrate briefly, then a soft "one more?" only if budget allows.
- [ ] `P0` `session.end` — summary line with one takeaway ("Forks were 4/4 today. Pins weren't.") and a tomorrow hook.
- [ ] `P1` `streak.progress` — consecutive correct within a session at milestones (3, 5, 10), variable rather than every time.
- [ ] `P1` `tilt.detected` — N consecutive fails: register shift to calm, offer an easier set or a break; suppress all celebration lines for the rest of the session.
- [ ] `P1` `rating.peak` / `rating.milestone` — new peak or round-number crossing: the coach's biggest celebration.
- [ ] `P1` `weakness.spotted` — after enough evidence in one theme: name it, offer a themed set ("Three misses on back-rank ideas this week. Want ten of those?").

**Modes**
- [ ] `P0` `run.start` (Rush/Storm/Streak) — one line, then **silent for the whole run**. No mid-run speech, ever.
- [ ] `P0` `run.end` — score vs. personal best, one highlight (highest-rated solved, best combo), one line.
- [ ] `P1` `daily.intro` / `daily.result` — flavor for the daily puzzle; result line references the global solve rate.
- [ ] `P1` `srs.due` / `srs.item.intro` — "You missed this one on Tuesday." at review time; success on a lapsed item gets a specific callback.
- [ ] `P2` `battle.*` / `racer.*` — pre-match and post-match only.

**Learning & courses**
- [ ] `P1` `lesson.narration` — the coach is the narrator of course lessons (longer content allowed in expanded state, still chunked into ≤ 25-word steps with "Next").
- [ ] `P1` `explanation.request` — "Why?" quick reply in review: explanation built from the solution line and engine eval.

**System & permissions**
- [ ] `P0` `permission.denied` — the coach voices the shared denial surface (§22.5) using the `unlockRef` copy; tone is matter-of-fact, never pushy ("That's today's five. Practice mode is open, or come back at midnight.").
- [ ] `P1` `onboarding.*` — the coach runs the micro-tutorial and calibration (§18) in first person.
- [ ] `P1` `error.*` — offline, sync failed, puzzle failed to load: the coach explains in one plain line; no blame.

### 36.4 Line generation

- [ ] `P0` **Template + slots system.** Line pools are authored per moment with slots (`{square}`, `{piece}`, `{motif}`, `{count}`, `{delta}`, `{theme}`, `{yesterday}`) and conditions (rating band, mode, side, line length, hint used, time bucket, sentiment). Deterministic, offline-capable, localizable.
- [ ] `P0` **Grounding data available to templates:** solution moves, motif tags, goal type, wrong-move refutation (precomputed or engine), eval swing, solve time vs. band average, session stats, streaks, SRS history for this puzzle, weakness model, permission decision.
- [ ] `P0` **Selection rules:** weighted random within the eligible pool; no repeat of the same line within the last N (e.g., 30) utterances per user; no two lines from the same template family back-to-back; specificity score prefers lines that fill more slots.
- [ ] `P0` **Fallback ladder:** specific line → motif-level line → neutral line → silence. Never a broken slot on screen.
- [ ] `P1` **Refutation phrasing engine:** turn a UCI refutation line into a human sentence ("after …Kxh7, Qh5+ is met by Kg8 and there's nothing") with SAN, ≤ 25 words, truncated to the decisive point.
- [ ] `P1` **Variety authoring:** each `P0` moment ships with ≥ 20 lines per major condition; playtest for staleness at 200-puzzle sessions.
- [ ] `P2` **LLM-assisted lines (optional):** for explanations only, generated server-side from grounded inputs (position, solution, refutation, engine lines), constrained to the length cap, tone-checked, cached per puzzle+wrong-move, and verified against the engine (no move claims that the engine disagrees with). Never used for reactions (latency) and never on-device without the grounded context. Falls back to templates on any failure.
- [ ] `P2` **Player-model conditioning:** lines conditioned on the weakness model and history ("Second time a knight fork got you this week.").

### 36.5 Register and adaptivity

- [ ] `P1` **Registers:** `learning` (default; explains, encourages, slower), `speed` (terse, fewer lines, no explanations unless asked), `competitive` (runs and battles: start/end only), `calm` (after tilt: no celebration, no streak talk, softer wrong-move lines), `beginner` (plainer vocabulary, names pieces and squares explicitly, more praise budget).
- [ ] `P1` Register selection is automatic (mode, rating band, recent fail rate, solve speed) with a user override in settings.
- [ ] `P1` Wrong-move lines never mock, never use "obvious", "simple", "easy", "just". Failure lines focus on the idea, not the player.
- [ ] `P1` Praise is calibrated: bigger words for harder puzzles relative to the player's rating, quieter for easy ones. The coach's reactions should be informative about difficulty.

### 36.6 Frequency and budget

- [ ] `P0` **Session talk budget:** a points budget per session (e.g., 30) with per-moment costs; reactions cost 1, explanations 3, celebrations 5. When exhausted, only `move.wrong` explanations, `permission.denied`, `error.*` and `session.end` may speak.
- [ ] `P0` **Cooldowns:** same moment can't fire twice within its cooldown (e.g., `streak.progress` 90 s, `puzzle.slow` once per puzzle, generic praise 5 puzzles).
- [ ] `P0` **Mode silence:** no speech during timed runs, battles, races, or while the engine analysis panel is open (the panel is the voice there).
- [ ] `P1` **Adaptive volume:** users who tap "Show me"/"Why?" often get a slightly larger budget; users who dismiss or mute get less. Learned per user, reset from settings.
- [ ] `P1` **Auto-advance awareness:** with auto-advance on, solved lines are ≤ 8 words and never delay the transition.

### 36.7 Habit loop (the "one more" design)

Engagement mechanics the coach is allowed to use — each is honest, each references real state, and none blocks leaving.

- [ ] `P0` **Open loops:** end lines with a concrete next thing: "Next one's a pin — your weakest theme." / "Two more for today's goal." / "You're 6 points off your peak."
- [ ] `P0` **Continuity callbacks:** reference yesterday, last week, the last time this motif appeared, the puzzle they missed on Tuesday. Memory is the coach's superpower and the thing generic apps can't do.
- [ ] `P0` **Variable reward:** celebration intensity and lines vary; not every solve gets a reaction, so reactions stay meaningful.
- [ ] `P1` **Progress framing:** always relative to the player's own history, never to other users unless the player opted into leaderboards.
- [ ] `P1` **Session-shaped pacing:** warm-up lines are light, core lines are focused, stretch puzzles get "this one's above your level — no penalty for looking" framing, cool-down closes with the takeaway.
- [ ] `P1` **Graceful exits:** when the player leaves, the coach says one line that makes coming back easy ("Streak's safe. See you tomorrow.") — no "are you sure?", no guilt, no countdown pressure.
- [ ] `P0` **Hard limits (from §16):** no fake scarcity, no fabricated social pressure, no shaming, no notification copy written as if from the coach that the coach wouldn't say in-app, no speech tied to purchase prompts beyond the plain denial line.

### 36.8 Voice, audio and captions

- [ ] `P1` **TTS:** on-device neural voice where available (AVSpeech / Android TTS with a chosen voice), or pre-rendered audio for the fixed line pool with on-the-fly synthesis only for slot-filled lines; one consistent voice per language.
- [ ] `P1` **Audio rules:** off by default on first launch (ask once after the first solve); respects silent switch; ducks, never pauses, the user's music; no audio during timed runs; caption always shown while audio plays.
- [ ] `P1` **Timing:** speech starts within 150 ms of the trigger or not at all; lines are cut if the player moves on (no queued backlog of stale lines — max queue depth 1, newest wins).
- [ ] `P1` **Sentiment tags** on every line drive avatar expression and, where TTS supports it, prosody.
- [ ] `P2` **Localized voices** for the priority languages (§29); line pools are translated as pools, not word-for-word, so idioms and length caps hold.

### 36.9 Interaction

- [ ] `P0` **Tap the bubble:** expands to the full line + quick replies. Tap again or tap the board: collapses.
- [ ] `P0` **Quick replies** are contextual chips, max 3: `Why?` · `Show me` · `Hint` · `Next` · `Easier set` · `Not now`. Every quick reply maps to an existing action (never new logic in the coach).
- [ ] `P1` **Swipe to dismiss** a line; a dismissal is a signal to the adaptive budget.
- [ ] `P1` **Long-press avatar:** coach menu (mute voice, captions, register override, hide coach, "what can you do?").
- [ ] `P2` **Free-text / voice questions** in review ("what if I play Rf8?") answered from the engine, grounded and length-capped; unavailable in rated puzzles before resolution (§24).

### 36.10 Settings

- [ ] `P0` Coach: on / captions only / off
- [ ] `P1` Voice on/off, voice selection, volume relative to effects
- [ ] `P1` Chattiness: quiet / normal / talkative (scales the session budget)
- [ ] `P1` Register override: auto / learning / speed
- [ ] `P1` Reduce motion inherits from system; avatar animation toggle
- [ ] `P2` Avatar look / voice cosmetics (permission-scoped)

### 36.11 Accessibility & localization

- [ ] `P1` Every line is announced by the screen reader as a polite live region; audio and caption are equivalent; board pointers have text equivalents ("highlighting e5").
- [ ] `P1` Captions meet contrast and dynamic type; bubble grows with type size without covering the board.
- [ ] `P1` Line pools are localized per language with the same length caps; slots respect grammar (gender/number) via ICU MessageFormat; piece names and SAN follow the notation setting (§29).
- [ ] `P1` Cultural check on humor per locale.

### 36.12 Permissions integration

- [ ] `P0` Coach availability and depth are permissions (§22): `coach.enabled` (grant), `coach.explanations.view` (grant), `coach.refutation.view` (grant, aligns with `analysis.refutation.view`), `coach.lesson_narration` (scoped by course), `coach.freeform_questions` (quota), `cosmetic.coach.*` (scoped cosmetics). The coach never inspects account facts; it asks `can()` like any other feature.
- [ ] `P0` The denial surface's spoken line comes from the `unlockRef` config copy (§22.8); the coach adds tone, not content.

### 36.13 Analytics

- [ ] `P1` Events: `coach_line_shown` (moment, templateId, register, slotsFilled, budgetRemaining), `coach_line_expanded`, `coach_quick_reply` (which), `coach_dismissed`, `coach_muted/unmuted`, `coach_audio_played`
- [ ] `P1` Metrics: next-puzzle rate after each moment type vs. silent control; retry rate after `move.wrong` lines; explanation open rate; mute rate by chattiness setting; D7 retention split by coach on/off (holdout)
- [ ] `P1` Line-level health: per-template dismissal rate and staleness; auto-demote lines that underperform
- [ ] `P1` A/B: budget size, register thresholds, celebration variance, session-end hook variants

### 36.14 Content & tooling

- [ ] `P1` Line authoring tool in the admin console: moment → conditions → lines with slots, sentiment tag, register tags, length linter, tone checklist, preview on sample positions, localization export/import
- [ ] `P1` Harness: replay a recorded session and see what the coach would say under a policy/pool version
- [ ] `P1` Versioned line pools delivered via remote config with rollback

### 36.15 Testing

- [ ] `P0` Unit: selection rules (no repeats within N, cooldowns, budget exhaustion, mode silence), fallback ladder with missing slots, length caps enforced at build time
- [ ] `P0` Grounding tests: every refutation/explanation line is checked against the solution line and engine output on a fixture set; a line that names a move not in the data fails
- [ ] `P1` Snapshot tests for bubble layout at all type sizes, orientations, RTL, and with the board pointer active
- [ ] `P1` Playtest protocol: 200-puzzle sessions scored for staleness, annoyance and "did it ever cover the board"
- [ ] `P1` Screen-reader script: solve three puzzles with the coach on, verify every announcement is timely and non-duplicative

### 36.16 Example lines (tone reference)

```
session.start (returning, streak 4, review due 3)
  "Day five. Three misses from last week are waiting — start there?"

puzzle.intro (theme session: deflection)
  "Deflection. Something is guarding too much."

move.wrong (refutation known)
  "Rxe7 runs into …Qxe7 — the rook was the only thing holding f7."

move.wrong (motif only)
  "Close. There's a skewer here you haven't used."

puzzle.solved (hard for the band, motif fork)
  "That fork was 200 above you. Next one's easier — go."

puzzle.failed.review
  "Bh6 was the move. It threatens mate and the queen at once. Why not yours?"

tilt.detected
  "Three in a row. Want ten easy ones to reset? No rating."

run.end (Rush, new best)
  "31. New best by two. The 1900 you got at the end was the one."

permission.denied (rated quota)
  "That's today's five rated. Practice is open, or the counter resets at midnight."

session.end
  "Forks 5/5, back-rank 1/3. Tomorrow I'll bring back-rank."
```

## 37. Suggested phasing

**Phase 1 — MVP (credible core)**
Rules core → board + input → Lichess DB ingest → **permission layer with a permissive policy (§22.1–22.6, 22.11)** → solve flow → Glicko-2 rating → selection with prefetch → review navigation → coach v1 (avatar, §36.1–36.3 P0 moments, template lines, budget) → basic stats → anonymous + sign-in → settings basics → analytics/crash reporting.

The permission layer ships in Phase 1 even though nothing is charged yet: every later feature is written against `can()`/`consume()` from day one, so limits become a config change rather than a retrofit.

**Phase 2 — Parity**
Themes + openings browser → daily puzzle + widget → hints → engine analysis in review → Rush/Storm/Streak + leaderboards → mistake review with spaced repetition → coach v2 (refutation phrasing, registers, voice, continuity callbacks) → dashboard by theme → daily goals/streaks/achievements → notifications → offline sync → themes/piece sets → billing + published limit policy (§22.8–22.10) → accessibility + localization pass → anti-cheat → admin console.

**Phase 3 — Differentiation**
Personalized puzzles from own games → courses/curriculum + CMS → Battle/Racer real-time → Woodpecker cycles → endgame trainer with tablebases → visualization drills → coach v3 (grounded LLM explanations, free-text questions, player-model lines) → social graph, clubs, tournaments → coach tools → web app parity.

## 38. Appendix: data schemas

```text
Puzzle
  id, fen, moves[] (UCI), rating, rd, volatility, plays, popularity,
  themes[], openingTags[], goal, phase, lengthClass,
  altMoves{ply -> [uci]}, annotations{ply -> {comment, nag, arrows}},
  source{gameUrl, white, black, year, event, isMaster},
  quality{up, down, reports, status}, version, createdAt

User
  id, username, email?, authProviders[], country, avatar, createdAt,
  timezone, ageBand, fairPlay{status}, linkedAccounts{lichess, chesscom}
  -- no tier/plan column; auth state is derived from authProviders by the
  -- policy resolver only. Feature code never reads authProviders for gating.

UserRating
  userId, mode (standard | battle | blitz), rating, rd, volatility,
  peak, gamesCount, isProvisional, updatedAt

Attempt  (append-only)
  id (client-generated UUID, idempotent), userId, puzzleId, puzzleVersion,
  mode, context{theme?, setId?, runId?, srs?}, result (win | loss),
  rated (bool), weight, movesPlayed[], firstWrongMove?, hintsUsed, solutionViewed,
  timeMs, ratingBefore, ratingAfter, puzzleRatingAtAttempt,
  clientTs, serverTs, deviceId, offline (bool)

Run  (Rush / Storm / Streak / Battle / Racer)
  id, userId, mode, variant, seed/sequenceId, startedAt (server), endedAt,
  score, strikes, bestCombo, accuracy, moveLog[{puzzleId, uci, tMs, correct}],
  validated (bool), flags[]

SrsItem
  userId, puzzleId, dueAt, intervalDays, ease/stability, reps, lapses, state

Collection
  id, ownerId, name, description, puzzleIds[], visibility, shareSlug

ThemeStat  (materialized)
  userId, theme, window, attempts, wins, perfRating, avgTimeMs

Streak
  userId, current, longest, lastQualifiedDay (user-local), freezes

EntitlementFact  (written by billing, read only by the policy resolver)
  userId, product, platform, status, validFrom, validUntil, originalTxId

Grant  (admin / promo / reward / org — read only by the policy resolver)
  id, userId, source (admin | promo | reward | org | trial), role? | action?,
  value?, scope?, validFrom, validUntil, reason, issuedBy, createdAt

PolicyVersion
  version, publishedAt, publishedBy, roles{}, restrictions{}, unlockRefs{},
  actionCatalogHash, status (draft | live | retired)

PermissionSet  (materialized per user; the only thing feature code sees)
  userId, policyVersion, factsHash, computedAt, expiresAt,
  grants{action -> true | {limit, window, resetBoundary} | {max} | param | scope[]},
  denies[]

QuotaCounter
  userId, action, contextKey?, windowStart, used, limitAtWindowStart, resetsAt

ConsumeLedger  (idempotency)
  idempotencyKey, userId, action, amount, decision, policyVersion, ts

PermissionDecisionLog  (sampled allows, all denials)
  userId, action, contextHash, allowed, reason, policyVersion, latencyMs, ts

Report
  id, puzzleId, userId, reason, attemptedMove, text, status, resolution

CoachLine  (authored, versioned pool)
  id, moment, templateText{locale}, slots[], conditions{register[], mode[],
  ratingBand[], lineLength?, hintUsed?, timeBucket?}, sentiment, budgetCost,
  weight, familyId, status (live | demoted | retired), version

CoachMoment  (config)
  id, budgetCost, cooldownSec, maxPerSession, allowedModes[], allowedRegisters[],
  fallbackChain[]

CoachUserState
  userId, sessionBudgetRemaining, recentLineIds[] (ring buffer), register,
  registerOverride?, chattiness, muted, audioOn, lastMomentAt{momentId -> ts},
  engagementScore (drives adaptive budget)
```