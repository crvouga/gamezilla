# Goal: Build Sokoban to Prove and Harden the Shared Puzzle Framework

## Primary outcome

Implement a polished **Sokoban** game in the product as the second structurally different consumer of the puzzle framework introduced for **Numberlink**.

The main goal is to prove that puzzle definitions, players, builders, packs, draft/published revisions, playtesting, progression, and local-first persistence are genuinely reusable. Extend or refactor the existing framework wherever it encodes Numberlink-specific assumptions. Do not create a separate Sokoban puzzle platform.

Success means a future game such as Unblock Me can supply rules, a puzzle schema, rendering, and game-specific editor tools while reusing the rest. Sokoban's implementation must exercise the shared system through real application workflows, not just compile against its interfaces.

## Working contract

Work in goal mode: inspect, implement, integrate, test, and iterate until the acceptance criteria are demonstrated. Do not stop at a proposal, scaffold, isolated demo, or passing game-only unit tests.

The shared framework is the primary deliverable; the game is the concrete consumer that proves the improvements work. Do not use that priority as permission to build speculative abstractions. Extract mechanisms that this game actually needs, keep its rules local, and migrate existing consumers wherever an improved shared contract applies.

Before changing code:

- Read repository instructions and inspect the actual game registration, session lifecycle, `room`, rendering/input, persistence/sync, bots, specifications, and test infrastructure. Existing code is the source of truth; package names and implementation details may differ from these descriptions.
- Map ownership and dependency direction. Respect existing `apps/`, `libs/`, `pkgs/`, and `specs/` conventions where present. Keep reusable packages product-agnostic; keep the `room` package independent of the application sync engine.
- Identify what already exists, what needs extending, and which existing consumers will change. Record a short implementation checklist and relevant baseline test results using the repository's existing conventions.
- Inspect overlapping changes before editing shared contracts. Coordinate through the existing workflow, keep contract changes and consumer migrations together, and do not overwrite another agent's unrelated work or assume unmerged APIs exist.

### Architectural constraints

- Extend the existing game framework and `room` package. Do not create a second room system, transport, game registry, persistence stack, or test harness.
- Use small, composable capabilities, strict types, and explicit validation at trust boundaries. Do not impose multiplayer, hidden information, puzzles, or simulation ticks on games that do not need them.
- Prefer the existing functional and Elm-style architecture. Do not introduce service-locator containers, giant dependency bags, or a universal engine merely to host this game.
- Internal breaking refactors are allowed and preferred over shims, deprecated aliases, or parallel APIs. Migrate all affected consumers and remove superseded paths. This does not authorize silently discarding persisted data, changing published content, or breaking saved sessions.
- Reuse existing clocks, randomness, scheduling, and deterministic test mechanisms. Keep `@pkgs/dst` and its `SimDeps` harness-only; production mechanics must not import the simulation test harness. Use existing narrow production dependencies and adapt them in tests.
- Keep ephemeral live-match state separate from durable application data. Do not route every gameplay update through the relational/local-first sync engine. Honor existing local-first guarantees where applicable; disconnected clients cannot authoritatively continue a competitive online match.
- Reuse the current design system, renderer, accessibility patterns, observability, error reporting, identity, authorization, and entitlement policies. Do not introduce React, a renderer, billing rules, or another major dependency merely for this task. Ship the web experience; preserve platform-neutral domain contracts without adding native applications.
- Existing features are prerequisites to inspect, not assumptions to pretend are implemented. Build the minimal missing shared capability required by this game; do not silently expand the task into implementing other full games or unrelated platform systems.
- Do not deploy, change production data, rotate secrets, publish packages, or perform destructive repository operations without separate authorization.

### Verification and reporting

Follow the existing Gherkin/BDD, Quint, property-based testing, deterministic simulation, integration, and harness conventions. Keep specifications in the repository's established domain-oriented `specs/` layout. Use the real implementation beneath test drivers; do not replace the framework or sync engine with a simplified test-only implementation.

Use Quint for finite abstractions of the relevant lifecycle and protocol. State exploration bounds and fairness/network assumptions. Connect meaningful model actions and observations to implementation tests where supported. Model checking a specification is not proof that the TypeScript implementation is correct; do not describe it that way.

Use existing deterministic failure capture and replay: record seeds, initial state/configuration, inputs/actions, faults, and relevant version metadata. Avoid arbitrary sleeps and nondeterministic test oracles. Test only fault modes supported by the transport or explicitly introduced at application boundaries; do not invent packet-level guarantees.

Run the relevant checks after each phase and the established full validation command at completion, including `bun check` if that is the actual repository entry point. Do not claim a check passed unless you ran it. Report environmental blockers and pre-existing failures separately; do not weaken tests to obtain a green result.

Finish with a concise report: implemented workflows, shared contracts changed, existing consumers migrated, commands and results, deterministic reproduction artifacts, remaining limitations, and a short explanation of what a developer would implement to add the next comparable game.

## 1. Implementation boundaries

| Owner | Responsibilities |
| --- | --- |
| Shared puzzle domain | Stable puzzle identity, game/rules/schema identity, immutable revisions, drafts, validation results, pack references, attempts, progression, and publication contracts. |
| Shared authoring and player UI | Browser/detail pages, pack editor, draft lifecycle, metadata, autosave/status, validation presentation, preview/playtest, publication controls, player shell, completion, and pack navigation. |
| Existing persistence/sync and API adapters | Local storage, authorized synchronization, optimistic concurrency, atomic publication, idempotent operations, discovery, and durable progress. |
| Sokoban | Board schema, movement/pushing, completion, optional deadlock analysis, solution replay, board rendering, input mapping, editor palette, and authored starter content. |

Do not introduce Numberlink-specific branches into shared code or import Numberlink internals from Sokoban. Shared puzzle definitions must remain game-owned typed payloads behind validated capability contracts; the framework must not assume every puzzle is a grid, a path, a sequence of moves, or uniquely solvable.

Reuse the existing Numberlink puzzle player and builder shells. Refactor both consumers together when changing shared APIs. If the Numberlink feature is not implemented yet, build the minimal common foundation needed for Sokoban and demonstrate a structurally different definition through a contract fixture; report that limitation rather than claiming two production games were verified. Do not implement an entire additional game in this task.

Sokoban is primarily single-player and must not require a `room`, opponent, matchmaking entry, or server tick loop to play. Preserve the ability for games such as chess to combine multiplayer and puzzle capabilities without forcing either capability on every game.

## 2. Bounded Sokoban rules and interaction

Implement a conventional box-pushing ruleset as the explicit product baseline:

- A board has static terrain: walls, traversable floor, goal locations, and optionally outside/void cells. A goal is a property of traversable terrain, not a competing entity type.
- There is exactly one player, at least one crate, and the same number of crates and goals. The player and crates occupy traversable cells; initial entity positions do not overlap. Crates and the player may start on goals.
- A move is one orthogonal step. The player may enter an empty floor/goal cell or push one adjacent crate if the cell immediately beyond it is traversable and empty. No pulling, diagonal movement, passing through walls, or pushing a chain of crates.
- Complete the puzzle when every crate occupies a goal. Define zero-move completion for an initially solved valid board and ensure it finalizes at most once.
- Count successful player steps as moves and successful crate pushes separately. Illegal inputs do not change state or increment either count. Undo/redo restores the counts associated with the restored position.
- Restart returns to the exact published initial definition and resets the current run, without deleting previous completion records.

Support keyboard, touch/swipe or directional buttons, and mouse-accessible controls. Keep controls responsive and predictable. Undo and redo must support a complete attempt; a new action after undo discards the redo branch. Persist enough history to preserve the advertised undo/resume behavior, with explicit resource limits.

Use the existing rendering system. Provide distinguishable crates, goals, crates-on-goals, and player position without depending on color alone. Fit and zoom the board appropriately, respect reduced-motion settings, and keep animation separate from logical movement and completion.

Do not add ice, teleporters, multiple players, procedural generation, multiplayer races, or an advanced hint system to this initial implementation.

## 3. Puzzle and pack authoring

Build Sokoban's editor as game-specific tools inside the shared builder, not as a bespoke screen flow.

Provide board sizing with explicit handling of cropped entities, terrain/goal painting, player placement, crate placement/removal, erase, undo/redo, metadata, validation feedback, and an accurate thumbnail/preview. A draft may be structurally incomplete; the editor must be able to save and reopen it without pretending it is playable.

The shared infrastructure must own draft identity, loading, autosave, dirty/sync/conflict status, navigation protection, metadata, validation presentation, playtest entry/exit, publication controls, and permissions. Sokoban owns the palette, board manipulations, and rules-specific diagnostics.

Playtesting must use the actual player and game rules against a frozen draft snapshot. Keep playtest attempts out of normal progression, achievements, public results, and consumption limits. Returning from a playtest must not modify the puzzle layout. Edits after a successful playtest invalidate evidence when the gameplay definition or rules version changes.

Reuse one pack builder for Numberlink and Sokoban: create/edit metadata, add/remove/reorder puzzles, create a puzzle from the pack workflow, preview, save drafts, and publish. Baseline packs are ordered collections for one game. Preserve a deliberate existing policy where it already differs; do not silently add mixed-game pack support.

Do not create a second `sokoban_packs` domain, duplicate publication endpoints, or game-specific copies of progression and pack navigation.

## 4. Validation and solvability without false guarantees

Separate validation concerns explicitly:

1. **Structural validity:** schema, dimensions/resource limits, legal terrain/entities, one player, crate/goal counts, and no overlapping entities.
2. **Gameplay evidence:** whether the actual rules can replay a valid sequence from the initial state to completion.
3. **Optional analysis:** deadlock diagnostics or a bounded solver, which may return `solvable`, `unsolvable` only with a conclusive result, or `unknown`/`budget-exceeded`.

For baseline publication, require structural validity and a verified solution witness. A witness can be recorded by an author completing a playtest or produced by an optional solver. The publishing authority must replay it against the exact definition and rules version; do not trust a client-supplied `solvable: true` flag or a completion screenshot.

Tie evidence to the gameplay content hash and rules version, not merely the mutable draft ID. Metadata-only changes need not invalidate unchanged gameplay evidence. Apply size/action/time limits before processing untrusted submissions. Do not send hidden author solution data to ordinary player payloads by default.

A solver is **not** a prerequisite for this task: manual playtest evidence is a complete, practical publication path. Avoid introducing an expensive search service merely to validate puzzles. Never report timeout as proof of unsolvability. Simple deadlock warnings may be useful, but unproven heuristics must not falsely reject publishable levels.

Keep this evidence policy capability-based. Sokoban's move-sequence witness must not become the universal required solution representation for Numberlink or future puzzle games. Reuse each game's verifier behind the shared publication workflow.

## 5. Revisions, publishing, and permissions

Use the existing immutable-published-revision/mutable-draft model, extending it only where actual gaps exist.

- Editing a published puzzle creates or changes a working draft; it never mutates the revision currently being played.
- Publishing validates and atomically creates/activates a revision, with idempotent retries. Enforce ownership, content limits, revision preconditions, and game-specific validation on the authority.
- Published pack revisions pin an ordered set of exact puzzle revisions. Updating a puzzle must not silently change a published pack. Pin the relevant rules/schema identity too, and explicitly handle incompatible future rule changes.
- Require referenced puzzle revisions to be eligible for publication and accessible to the intended audience. Do not silently publish private child drafts just because a pack is published. Use the existing atomic multi-item publication policy only if it is already explicit and tested.
- A pack cannot grant access its author does not have. Drafts remain private to their authorized authors/editors even when their IDs are known.
- Replacing a public revision does not delete older revisions referenced by attempts, published packs, or results. Reject unsafe deletion or use the repository's established retention mechanism.

Use the repository's existing withdrawal policy where defined. Otherwise distinguish removal from new discovery/starts from preservation of existing attempt/history references. A withdrawn puzzle must not leave an advertised pack with a silently broken new-start workflow: expose availability or hide the affected entry/pack through the shared discovery layer without mutating its immutable content. Existing downloaded public content cannot be made unreadable retroactively; do not promise offline revocation.

Add explicit behavior specs for every availability/access decision rather than leaving it to incidental database queries.

## 6. Attempts, progression, and offline behavior

Support individual puzzle play and the full pack flow: browse, open, play, save, leave, resume, complete, continue to the next item, and review pack progress.

Bind each attempt to an immutable puzzle revision and its rules version. Where needed, also retain pack revision context. Persist position, counters, history, and lifecycle state consistently. Reset/replay creates a fresh run or resets only the active run according to the existing attempt model; it must not remove prior achievements.

Completion must be idempotent. Historical completion for a revision should not regress because a user restarts, undoes, replays, or synchronizes an older in-progress attempt. A new puzzle revision does not inherit old completion automatically. Derive progress for a pack revision from its exact referenced puzzle revisions and the established shared completion policy.

Previously downloaded puzzles and packs, local play, saved attempts, editor drafts, and pack editing must work offline. Show saved-locally versus synchronized status accurately. Do not claim publication succeeded without authoritative acknowledgement; saving a draft offline is sufficient, and a queued publish intent must be revalidated against its captured revision before execution if queuing is supported.

Do not merge two independent Sokoban action streams, two board-edit histories, or pack reorderings using naïve field-level last-write-wins. Reuse existing safe concurrency mechanisms. Where none exists, use base-revision/optimistic-concurrency checks and preserve the losing edit or attempt as a recoverable branch/copy rather than silently losing work. Do not build a speculative CRDT platform.

Deliver a small original starter pack with distinct introductory layouts and machine-replayable solution witnesses. Do not copy an external level collection or depend on an unknown license. Seed content idempotently through the established fixture/content mechanism.

## 7. Executable verification

### Behavior and integration

Cover the complete authoring-to-playing workflow through the real application: create an incomplete draft, edit, autosave/reload, validate, playtest, publish, create/reorder/publish a pack, browse as another user, play, resume, complete, and continue.

Verify draft privacy, wrong-owner publication, invalid witnesses, stale evidence after board edits, duplicate publish requests, failed/partial publication, old attempts after republishing, pinned pack contents, withdrawal availability, and offline/reconnect conflicts. Test the same shared authoring/player workflows with Numberlink where implemented.

### Properties and simulation

Assert at least:

- Legal moves preserve terrain, crate count, and valid non-overlapping positions; illegal moves do not mutate state.
- Pushes move exactly one crate and the player by the specified cells; no crate can be pulled or pass through a wall.
- Completion agrees with the rules, including crates-on-goals and initially solved boards.
- Undo/redo and serialization round trips preserve state, counters, and advertised history semantics.
- Solution witnesses are valid only for the appropriate gameplay definition/rules and are checked through the real transition function.
- Published revisions are immutable; pack references remain stable; a draft edit does not affect a player.
- Publishing and completion retries do not create duplicate logical results.
- Recoverable synchronization cannot silently discard conflicting drafts or regress historical completion.

Use small generated boards and legal action sequences for rule properties. Use DST for actual authoring/progression sync and publish fault scenarios, not a fake parallel data model. Explore puzzle/draft/publication, revision pinning, and attempt-completion lifecycles in bounded Quint models with clear implementation correspondence.

Profile editor and player behavior at documented board/resource limits. Keep solver/validation work from freezing the UI or monopolizing an API worker. Performance evidence must identify the tested environment; do not invent measurements.

## 8. Phases and exit gates

1. **Audit and shared contract review.** Trace Numberlink authoring, player, packs, publishing, and progress. Identify assumptions Sokoban exposes. Exit: specs, ownership map, and a bounded refactor plan.
2. **Puzzle framework refinement.** Implement/migrate shared definition, editor/player, validation/evidence, and revision contracts where required. Exit: Numberlink regressions and shared contract tests pass; no game-specific fork is introduced.
3. **Sokoban vertical slice.** Build deterministic rules, renderer, input, undo/redo, local attempts, and the editor/playtest adapter. Exit: create and solve a local draft through the real shared UI.
4. **Publishing and packs.** Integrate verified witnesses, immutable revisions, pack building, discovery, navigation, and original starter content. Exit: one author publishes a pack and a second user plays it end to end.
5. **Offline, conflicts, and hardening.** Complete sync/recovery, permissions, bounded models, BDD/PBT/DST/integration harness, and performance checks. Exit: durable progress and drafts survive restart, disconnect, retry, and content revision without silent data loss.

## 9. Definition of done

- Sokoban is discoverable, playable, editable, publishable, and usable in packs through the real app.
- Numberlink and Sokoban share the relevant puzzle browser, player/builder shells, pack builder, publication lifecycle, persistence, and progression.
- Both games retain genuinely game-specific rules, definition schemas, visuals, and editor tools.
- Authoring evidence is verified, published content is immutable, and old attempts/pack references remain meaningful.
- Offline play/editing and conflict recovery are tested through actual persistence/sync adapters.
- Existing games still work, and shared API refactors include all consumer migrations.
- Adding Unblock Me would not require rebuilding puzzle packs, drafting, publishing, player navigation, progression, or local persistence.
