# Goal: Build a Scrabble-Like Word Game to Harden the Shared Game Framework

## Primary outcome

Implement a polished **Scrabble-like word-tile game** in the product, using **Word Tiles** as a working title unless the repository already establishes another name.

**The main deliverable is a stronger shared game framework.** Use this game to extend, refactor, and prove reusable support for **compound player actions, private inventories, authoritative random draws, dictionary-backed rules, live and asynchronous multiplayer, and a single game composing multiplayer and puzzle capabilities**.

The game must be a complete product feature, not a framework demonstration. Conversely, do not deliver a standalone word game that bypasses the existing platform. Future games should supply their own rules, observations, assets, bots, and presentation without rebuilding sessions, private delivery, durable turns, reconnects, puzzle packs, or publishing.

Inspect the actual repository. Chess, Connect Four, Battleship, Quoridor, Numberlink, Pong, Hearts, Sokoban, and Light Cycles may be implemented, in progress, or absent. Reuse what exists; do not assume another agent's proposed APIs have landed.

## Working contract

Work in goal mode: inspect, implement, integrate, test, and iterate until the acceptance criteria are demonstrated. Do not stop at an architecture proposal, scaffold, isolated demo, or passing game-only unit tests.

Before editing:

- Read repository instructions and inspect game registration, lifecycle, `room`, rendering/input, persistence/sync, private-state projections, bots, puzzle capabilities, specifications, and CI.
- Record a short ownership map, implementation checklist, relevant baseline checks, and affected existing consumers using established repository conventions.
- Inspect overlapping changes. Coordinate shared-contract work, keep migrations with the changes that require them, and preserve other agents' unrelated work.

### Constraints

- Extend the existing framework. Do not create another game registry, room system, transport, persistence stack, matchmaking service, or puzzle platform.
- Follow existing `apps/`, `libs/`, `pkgs/`, and domain-oriented `specs/` conventions where present. Keep reusable packages product-agnostic and `room` independent of the application sync engine.
- Use strict types, explicit trust-boundary validation, small composable capabilities, and the established functional/Elm-style patterns. Do not introduce a universal rules DSL or service-locator container.
- Internal breaking refactors are allowed and preferred over parallel APIs or compatibility shims. Migrate affected consumers and remove superseded paths. This does not authorize losing saved sessions, changing immutable content, or discarding user data.
- Keep production rules independent of clocks, network access, rendering, and the test harness. Reuse narrow production dependencies for randomness and scheduling; keep `@pkgs/dst` and `SimDeps` harness-only.
- Use the existing renderer, design system, authentication, authorization, entitlements, observability, and error reporting. Ship web; preserve portable domain contracts without adding native applications.
- Extend shared mechanisms only when the game needs them. Board geometry, word scoring, dictionaries, and word-search strategy do not belong in `room` or the generic game core.
- Do not deploy, alter production data, publish packages, rotate secrets, or perform destructive operations without separate authorization.

Use original branding, presentation, and starter content. Treat Word Tiles as a working name, not a cleared commercial name. Do not present this as an official Scrabble product or import third-party logos, artwork, or word lists without documented permission for their intended use.

## 1. Implementation boundaries

| Owner | Responsibilities |
| --- | --- |
| Existing `room` package | Authenticated membership, connection lifecycle, role-scoped delivery, subscriptions, reconnect/resynchronization, and cleanup. No word rules, dictionary lookup, or tile scoring. |
| Shared game framework | Seats/controllers, authoritative command handling, optional private observations, turn/lifecycle orchestration, rule/content identities, bots, results, and reconnect integration. |
| Existing persistence and application adapters | Durable asynchronous sessions, concurrency/idempotency, authorized storage/sync, discovery, custom games, matchmaking, notifications already supported, and history. |
| Shared puzzle subsystem | Drafts, immutable revisions, packs, builder/player shells, validation/evidence workflows, publication, attempts, progression, and offline persistence. |
| Word Tiles domain and UI | Tile configuration, board geometry, placement rules, scoring, passing/exchange, endings, candidate-move editing, word-specific visuals, and puzzle editing tools. |
| Word-domain data/runtime module | Versioned lexicon ingestion, normalization, exact membership, search indexes, and bounded bot move generation. Keep game-adjacent unless actual reuse justifies wider extraction. |

Keep authoritative state, viewer observations, and local interaction state distinct. A tile being dragged onto a tentative board is not an authoritative move. A rack reorder is presentation state, not a turn. A live room connection is not the durable identity or lifetime of an asynchronous match.

Reuse and improve existing private-state contracts from Battleship or Hearts, durable turn handling from existing board games, and puzzle shells from Numberlink/Sokoban. Migrate those consumers when their shared contract changes. Do not use game-ID switches to work around unsuitable shared interfaces.

## 2. Bounded baseline rules

Implement one explicitly versioned English ruleset. The following are product decisions for this implementation, not a claim of official tournament-rule compliance. Encode them in executable specifications and immutable configuration rather than scattering constants through UI and networking code.

### Board, seats, and inventory

- Support **two to four fixed seats**. Use existing matchmaking configurations; two-player matchmaking is sufficient initially, while custom tables must support two, three, and four players.
- Use a **15 × 15 board**, a maximum **seven-tile rack**, and a finite bag containing 100 physical tiles, including two blanks.
- Use this baseline inventory; each symbol's count and points are data:

| Points | Tiles and quantities |
| --- | --- |
| 0 | Blank × 2 |
| 1 | A × 9, E × 12, I × 9, L × 4, N × 6, O × 8, R × 6, S × 4, T × 6, U × 4 |
| 2 | D × 4, G × 3 |
| 3 | B × 2, C × 2, M × 2, P × 2 |
| 4 | F × 2, H × 2, V × 2, W × 2, Y × 2 |
| 5 | K × 1 |
| 8 | J × 1, X × 1 |
| 10 | Q × 1, Z × 1 |

- Choose and check in a symmetric premium-square layout with double/triple-letter and double/triple-word squares. Document the exact map and make the center a double-word square. Validate coordinates and prohibit conflicting premium types. Do not build a layout editor or variants screen.
- Give each physical tile an authoritative identity, or an equivalent conservation-safe representation. Duplicate letters are distinct inventory items; a command cannot spend the same tile twice.
- The authority shuffles, deals seven tiles per player, and selects the initial seat through the existing trusted randomness mechanism. Record enough private state for reproducibility and recovery without exposing future draws.

### Placement legality

A turn places one or more owned rack tiles, passes, or exchanges tiles.

For a placement:

- All newly placed tiles must lie in one row or one column. The resulting span must be contiguous, allowing existing board tiles to fill gaps between new tiles.
- Never overwrite or relocate committed board tiles. Reject out-of-bounds coordinates, duplicate coordinates, duplicate tile references, and tiles not owned by the acting seat.
- The opening move must cover the center and form a word of at least two letters. Later placements must connect orthogonally to the existing board.
- Extract all maximal horizontal and vertical words newly formed or extended by the placement. Validate every affected word of length at least two against the pinned lexicon; at least one such word must exist.
- Handle a single-tile placement that forms two words correctly. Count each distinct word span once. Do not revalidate or rescore unrelated words as though they were newly played.
- A blank receives an A–Z assignment when placed, remains worth zero points, and retains that assignment after commitment. A pending assignment may be changed before submission; a committed blank cannot be reassigned.
- Reject illegal placements atomically: board, racks, bag, scores, turn, randomness, and result state remain unchanged.

Use one rule implementation for authority validation, client affordances, bot legality, and puzzle verification. A client preview is advisory; it never substitutes for authority validation.

### Scoring, exchange, and endings

- Score each affected word independently. Apply letter multipliers to newly placed tiles, then multiply that word's subtotal by all word multipliers under its newly placed tiles. Premiums under previously committed tiles do not activate again.
- A new tile may participate in more than one scored word. A blank contributes zero letter points, but a word multiplier beneath a newly placed blank still applies to that word.
- Add a **50-point bonus once** when a placement uses seven tiles. Using an entire shorter rack does not qualify.
- After a valid placement, refill toward seven tiles from the remaining bag, then advance the turn or resolve completion.
- Passing changes no inventory and scores zero. Exchange requires at least seven tiles in the bag at the start of that action and one or more distinct owned tiles selected. Draw replacements from the pre-exchange bag before returning the selected tiles and reshuffling. Commit the entire operation once.
- Track consecutive accepted zero-point turns, including passes, exchanges, and any valid zero-point placement. A positive-scoring placement resets the count. End after **six consecutive zero-point turns**.
- Also end when the bag is empty and a player empties their rack through a valid placement. Prioritize this going-out ending when both ending conditions would apply.
- On going out, subtract each other player's remaining rack value from their score and add their total to the player who went out. On a scoreless ending, subtract each player's remaining rack value without transferring it to another player.
- Highest adjusted score wins; tied leaders are joint winners. Keep negative scores valid. Completed matches cannot accept further gameplay mutations.

Use the existing explicit resignation and timeout policies, documenting their interaction with inventories, bot takeover, and results. Do not silently remove a seat, redistribute its rack, or classify every interrupted match as a normal scored finish.

## 3. Compound moves and player experience

Provide a shared player shell with game-specific board/rack interaction. Support mouse, touch, and keyboard without requiring drag-and-drop as the only input method.

The player must be able to place and recall tentative tiles, change pending blank assignments, reorder/shuffle their own rack visually, clear the candidate, inspect a private score breakdown, and submit explicitly. Distinguish tentative tiles from committed tiles, including in accessible descriptions. Keep the board usable on small screens with appropriate fit/zoom and readable premium labels.

Submission must be **one atomic command containing the complete placement**, not a sequence of individually committed tile moves. Keep per-pointer movement, hover, rack order, and candidate edits local. Do not broadcast them to opponents or persist them as public gameplay events.

Expose typed validation errors and pending/accepted/rejected states through existing framework patterns. Preserve a recoverable candidate after a transient failure. Tie saved candidates to the base board revision, turn, and rack identity; never silently submit stale tiles into a later turn.

Online committed turns cannot be undone through local editor undo. Candidate undo/redo only changes the uncommitted move. Puzzle retry/undo belongs to the shared attempt model. Do not implement a generic network two-phase-commit protocol just because players preview a move before submission.

Provide scores, active seat, bag count, remaining rack counts, public turn history, exchange/pass controls, completion, and rematch. Include a rules/help view showing this ruleset's word-list identity and ending policy. Reuse existing consumption policies; rack edits, rejected moves, reconnects, and author playtests must not accidentally count as new games.

## 4. Lexicon is a versioned gameplay dependency

A playable production word list is required; a tiny test fixture is not a shipping dictionary.

- Select a word source whose documented terms permit the intended commercial use, redistribution, local/offline storage, and derived indexes. Record provenance, source version, source checksum, applicable notices, and the actual permission basis. Do not assume that an accessible download or a library's license also licenses its bundled corpus.
- Keep acquisition and deterministic preprocessing separate from gameplay. Prefer a pinned build/content artifact over an external word-validation API or a runtime dependency on a mutable upstream service.
- For baseline v1, support ASCII A–Z words of length 2–15. Define deterministic normalization and exact membership. Reject unsupported punctuation and characters rather than silently transforming them into another word. Do not use locale-dependent casing, an LLM, or a guessed spelling heuristic as the authority.
- Pin locale, lexicon version/content hash, and ruleset version in matches and puzzle revisions. Client previews, bots, server decisions, saved sessions, and replay must agree on these identities.
- Load the necessary immutable data before initializing play. Keep I/O outside the pure transition function. A missing or mismatched artifact must produce an explicit recoverable unavailable/update state, not “all words valid” or an empty dictionary.
- Cache the correct artifact for offline play. Avoid downloading the word corpus when opening an unrelated game. Measure bundle, parse, lookup, and memory costs; choose an index based on evidence rather than implementing an elaborate search engine by default.
- Retain or explicitly migrate versions referenced by durable sessions and published puzzles. Updating the default dictionary must not silently change the validity of existing content or previously accepted turns.

The lexicon is public gameplay data. Opponent racks, bag order, and random state are not. Keep those boundaries separate even when the bot uses the same dictionary as the client.

Do not block the whole product on multilingual support, definitions, pronunciations, challenges, or bluffing. Automatic rejection of invalid words is the baseline; no challenge/adjudication workflow is required.

## 5. Authority and private information

Maintain complete state at the authority and derive per-viewer observations **before serialization and delivery**.

A player may receive their own rack and private command outcome; everyone may receive the board, committed words, scores, current seat, bag count, rack counts, and public history. Opponents and spectators must not receive private rack letters, exchanged letters, private draw events, tentative placements, future bag order, RNG state, or reconstructable shuffle seeds.

Apply this consistently to snapshots, incremental messages, reconnects, asynchronous fetches, app synchronization, replay/history endpoints, logs, traces, and error reports. Hiding a rack in the UI is not a privacy boundary. Do not put a full authority snapshot into a client-synced table.

Keep sensitive deterministic reproduction artifacts in restricted debugging paths. Do not automatically reveal all hidden state after completion; default history remains public moves plus each viewer's authorized private information.

Bots receive only their seat's observation and public configuration. They may reason from the published tile distribution and visible tiles, but must not read exact opponent racks or the future bag. Separate internal reproducibility from exposing a seed that would enable cheating.

Add serialization and transport tests for two, three, and four seats, spectators, late joins, reconnects, and wrong-seat requests. At a fixed logical revision, observations with identical public state and the viewer's own rack must not differ merely because inaccessible opponent tiles or bag order differ.

## 6. Live and asynchronous matches

Use the same authoritative commands and rules in both modes. Live play adds room delivery; asynchronous play must not require an always-connected browser or a permanently running simulation loop.

### Durable accepted turns

Persist sufficient authority state to restore the board, all racks, bag/random state, scores, active seat, deadlines, rules/lexicon identity, and command receipts. Use existing storage and transaction mechanisms rather than introducing event sourcing solely for this game.

A command must include the existing equivalent of match identity, authenticated actor/controller, expected turn or revision, and an idempotency key. Check authorization before exposing stored receipts. Reject reuse of a key with a different command body.

Serialize competing commands for the same turn. A committed placement, draw, score update, turn advance, and ending decision must survive together. A lost response followed by retry returns the original result; it cannot draw new replacement tiles or apply points twice. Rejected and duplicate commands do not consume additional randomness.

Acknowledge durable asynchronous turns only after persistence succeeds. Recover correctly from a crash before acknowledgement or between persistence and live notification. Reuse an existing outbox/reconciliation mechanism where present; do not add a new queue service without need. Final results and rewards must finalize idempotently too.

### Connectivity, deadlines, and control

- Rejoining or reopening a match restores the authorized current state, not merely the last local cache. Local candidates remain visibly tentative until accepted.
- Local practice against bots works fully offline after required assets are available. Offline drafting in an online match is allowed, but cannot advance the canonical game. Revalidate against the authority on reconnect; do not merge boards or inventories with last-write-wins.
- Follow existing live disconnect/grace/bot-takeover policies. Label bots and ensure a returning owner and an old bot task cannot both control a seat.
- In asynchronous mode, going offline is normal, not immediate forfeiture or bot takeover. Use durable authoritative deadlines when configured. Stale timeout work must be fenced by the expected turn/controller identity and cannot act after a move has advanced the match.
- Define deadline-versus-move race behavior and test it. Do not depend on the user's device clock for acceptance. Reuse existing scheduling; avoid one permanent process or room per dormant match.
- Persisted sessions must survive a room teardown and authority restart within the repository's documented guarantees. Do not invent distributed host migration for this task.

Integrate existing custom games, invitations, matchmaking, spectator permissions, game history, and notifications where already supported. Do not build a separate correspondence-game application or new notification delivery system.

## 7. Competent bounded bots

Implement offline practice and online bot seats using the same command and observation contracts as humans. Provide a legal, useful baseline, not an LLM integration or a championship-strength solver.

Move generation must consider board anchors, rack multiplicities, blank assignments, all cross-words, and actual scoring. Include legal pass/exchange fallback. Search can use a trie or another measured index; keep that inside word-domain code, not the shared framework.

Bound search by explicit work limits and support cancellation when the turn, controller, or room changes. Keep costly search from freezing the UI or blocking the room worker. Use the existing worker/task mechanism when appropriate. Tests should use deterministic work budgets and seeded tie-breaking rather than timing-dependent answers.

Differentiate difficulty through documented search/selection limits. Bots cannot gain strength from hidden-state access, invalid moves, extra turns, or impossible tile draws. Revalidate their final action at the authority like any other command.

On small boards and fixture dictionaries, compare generated moves with a simple independent exhaustive reference to catch missed cross-words and blank/multiplicity errors. Do not claim global optimality when production search is bounded.

## 8. A narrow puzzle mode through the shared puzzle framework

Include one bounded puzzle capability to prove that this game can compose multiplayer and puzzles without parallel infrastructure: **“Use this rack to score at least N points in one move.”**

A puzzle pins the board, rack, target, rules version, and lexicon version. It needs no opponent, draw order, refill, room, or matchmaking entry. A legal candidate is scored against the frozen initial board; completion requires meeting the target in that single placement. Several lower-scoring placements cannot accumulate toward success. Allow retry from the original position through the shared attempt model.

Use the actual word-game validator and scoring function. A target is a threshold, not a claim that its value is the mathematically best possible score.

### Authoring and publication

- Add game-specific tools to the shared puzzle builder for the fixed board, prefilled tiles, blank assignments, rack, and target. Reuse metadata, autosave, permissions, preview/playtest, publishing controls, and pack editing.
- Validate existing board geometry and words, tile multiplicities across board/rack, blank assignments, resource limits, and content identities. Empty-board challenges are allowed; nonempty boards must form a valid connected position. Premiums under prefilled tiles are already consumed.
- Do not require proof that a valid puzzle position is reachable from a complete historical multiplayer match. Do require that its inventory does not exceed the configured tile set and that its winning move is legal.
- Require a verified placement witness that reaches the target before publication. The publishing authority replays it against the exact gameplay content, target, rules, and lexicon. Author playtesting can supply the witness; exhaustive optimality search is not required.
- Tie evidence to the relevant content hash. Gameplay or target edits invalidate it; unrelated metadata edits need not. Do not expose the author solution in ordinary player payloads by default.
- Reuse mutable drafts, immutable published revisions, pinned pack references, permissions, offline drafts, attempt persistence, and idempotent completion. Playtest attempts must not pollute ordinary progression or entitlements.
- Ship a small original introductory pack with machine-verifiable witnesses and idempotent seeding. Do not import an external puzzle collection without documented reuse rights.

Do not create `word_tiles_packs`, separate publication workflows, or game-specific progression services. If the shared puzzle subsystem is incomplete, implement the minimum genuinely shared foundation required here and report which existing consumers were actually verified; do not claim Numberlink or Sokoban integration that was never exercised.

## 9. Executable verification

Follow the repository's Gherkin/BDD, Quint, PBT, DST, integration, and critical-journey conventions. Run real implementation code beneath test drivers, not a simpler test-only game, room, or sync engine.

### Behavior and integration coverage

Cover first moves; horizontal/vertical placement; existing tiles bridging gaps; disconnected/diagonal/overlapping placements; single-tile double-word formation; invalid cross-words; duplicate tile IDs; blanks; premium reuse; seven-tile bonuses; exchanges at the bag threshold; short refills; passes; both endings; negative scores; joint winners; and rematches.

Exercise actual two-, three-, and four-client sessions, private observations, bots, spectators, late joining, reconnects, lost acknowledgements, duplicate requests, simultaneous device submissions, stale candidates, controller changes, and timeout races. Include restart/recovery of a dormant asynchronous match and stale or unavailable dictionary artifacts.

Exercise the puzzle workflow end to end: create an incomplete draft, edit, playtest, validate a witness, publish, build/publish a pack, play as another user, save/resume, complete, and republish without mutating older referenced content. Verify offline play/editing and conflict recovery through the actual persistence adapters.

### Properties and deterministic simulation

Assert at least:

- **Tile conservation:** every physical tile is in exactly one authoritative location: bag, a rack, or the committed board. Candidate UI copies are not authoritative inventory.
- **Blank integrity:** assignment does not change physical identity or zero value; committed assignments are immutable.
- **Atomicity:** rejected commands leave authoritative state and randomness unchanged; duplicate accepted commands have no second effect.
- **Geometry and words:** accepted placements satisfy connectivity and all affected-word checks, including single-tile and cross-word cases.
- **Scoring:** a small independent reference agrees on bonuses and word spans; old premiums never reactivate. Total cumulative score is not a conserved quantity.
- **Determinism:** identical authority state, pinned artifacts, accepted commands, and random decisions produce equivalent outcomes and authorized observations.
- **Lifecycle:** only the active authorized controller acts, deadlines cannot affect later turns, terminal results finalize once, and terminal game state is stable.
- **Recovery and privacy:** serialization/restore preserves protected state, retries cannot reroll a draw, and unauthorized recipients never receive hidden inventories.
- **Content stability:** lexicon updates, puzzle edits, and pack republishing do not silently mutate existing match or attempt semantics.

Use DST for the real command/persistence/delivery boundary: disconnects, delayed responses, replayed requests, crash points, simultaneous submissions, bot/controller races, and result-write retries. Only inject faults at boundaries where the actual transport/storage semantics permit them. State eventual-progress assumptions explicitly.

Use bounded Quint models for turn ownership, inventory transfers, atomic commit/retry, timeout races, terminal finalization, and puzzle revision/evidence lifecycle. Abstract the dictionary and board to tractable domains; test full word geometry in implementation-level properties. State exploration bounds and connect model actions to implementation tests where supported. Do not describe checking a model as proof of the entire TypeScript implementation.

Capture reproducible failures with configuration/artifact versions, initial state, seeds, commands, and faults while protecting hidden information. Avoid arbitrary sleeps and unbounded search in CI.

## 10. Phases and exit gates

1. **Audit and executable contract.** Inspect existing consumers, choose/document the baseline premium map and lexicon, map ownership, and write behavior specs. **Exit:** bounded shared-change plan, data provenance, baseline checks, and no duplicate platform proposed.
2. **Pure word-game vertical slice.** Implement pinned configuration, lexicon loading, legal placements, scoring, inventory, endings, candidate interaction, and local practice. **Exit:** complete games run through the real app; critical rule properties and independent scoring checks pass.
3. **Shared multiplayer refinement.** Extend command, private-view, seat/controller, and result contracts where needed; migrate affected existing games. **Exit:** private two/three/four-seat contract tests and existing-consumer regressions pass.
4. **Live and asynchronous integration.** Connect custom games, existing matchmaking, durable commands, scoped room delivery, spectators, reconnects, deadlines, and bots. **Exit:** real multi-client play plus authority restart and lost-response retry work without inventory loss, rerolls, leakage, or duplicate turns.
5. **Puzzle composition.** Integrate the one-move challenge, editor/playtest tools, witness validation, packs, publication, and original starter content through shared capabilities. **Exit:** one author publishes a pack and another user plays/resumes/completes it; existing puzzle consumers still work.
6. **Hardening and cleanup.** Complete BDD/PBT/DST/bounded models/critical journeys, profile dictionary and bot budgets, verify offline/version/conflict cases, and remove obsolete code. **Exit:** the definition of done is demonstrated with recorded commands and results.

Run relevant checks at every gate, then the repository's full validation entry point, including `bun check` if that is the actual command. Do not claim execution or success without running it. Report environmental blockers and pre-existing failures separately; never weaken checks to obtain green results.

## 11. Definition of done

- The word game is discoverable and playable through the app, with offline bot practice, two-to-four-player custom games, and existing matchmaking integration.
- Live and asynchronous play share rules and command contracts; acknowledged turns survive restart and retry without duplicate scoring or different draws.
- Compound candidates, cross-word validation, blanks, multipliers, exchange, endings, ties, and responsive accessible controls work end to end.
- Opponent racks and future draws are protected across transport, persistence/sync, spectators, reconnects, history, and diagnostics.
- A documented production lexicon supports authoritative and offline use; matches and puzzles pin their gameplay dependencies.
- The same registered game also provides editable, publishable one-move puzzles and packs through the shared puzzle system.
- Shared improvements have real migrated consumers and implementation-level regression coverage. No word-specific branches or dictionary/scoring logic appear in generic room/session code.
- A future private-inventory board game can reuse seats, command commits, observations, recovery, and results; another puzzle game can reuse authoring, packs, publishing, and progression.
- Verification is reported honestly, performance measurements identify the environment, and unresolved blockers are explicit rather than hidden behind placeholders.

Do not add tournaments, wagering, trade systems, user-uploaded dictionaries, challenge/bluff rules, multilingual product support, a general board-game editor, a new billing model, or a real-time simulation loop. Do not implement other full games to claim reuse.

Finish with a concise report of implemented user workflows, shared contracts changed, consumers migrated, lexicon provenance, checks and outcomes, reproduction artifacts, remaining limitations, and exactly what game-specific code the next comparable game would need.

**Final objective:** deliver a polished word-tile game that proves the product can combine compound turns, hidden finite inventories, versioned rule data, durable multiplayer, and authored puzzles without rebuilding its platform for each game.
