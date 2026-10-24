# Numberlink implementation

Scope: [the requested implementation](GAMEZILLA_NUMBERLINK_PROMPT.md), including
the reusable puzzle framework, real authoring and playing workflows, local-first
storage, publishing, progression, and executable verification. This ledger tracks
unfinished work; it is not a second product definition.

## Architecture

- Extend the existing game registry to compose independent turn-game and puzzle
  capabilities. A puzzle-only game supplies no seats, opponent, clock or result
  fiction. Chess may provide both capabilities. Keep existing games' durable
  names and stored records intact.
- Extend the existing `game-puzzle` family for shared content, drafts, immutable
  revisions, packs, attempts and progression. The existing rated line-based feed
  remains one supported puzzle experience; author-created puzzles use the same
  registration, sub composition, UI components and sync engine.
- Shared contracts exchange opaque definitions, actions and states. Definition
  validation, initial state, accepted actions, completion and serialization come
  from the game. Solver, hint, generator, editor and preview are independent
  capabilities. Verify contracts against a non-grid puzzle consumer as well as
  Numberlink.
- Numberlink owns its definition, paths, endpoint editing, rendering, pointer and
  keyboard controls, and bounded solver. One rule layer serves all consumers.
- Immutable puzzle revisions own their complete definition and metadata. Pack
  revisions pin ordered puzzle revision identities. Working drafts use explicit
  expected revisions; conflicting edits are preserved and surfaced, never
  silently overwritten. A publication operation has a stable identity.
- Attempts pin one puzzle revision and retain independent histories. Competing
  device edits must remain recoverable; completion comes from accepted actions,
  not a client-supplied flag. Playtests use the real player without normal
  attempts or progression. Withdrawal hides discovery but preserves attempts.
- All data uses package-owned tables, `defineQuery`, `defineMutation`, derived
  topics and the existing session sync. Ownership and access are permissions
  decisions. No new REST data API or infrastructure service.
- Shared UI owns discovery, metadata, builder lifecycle, draft conflicts,
  publication, pack editing, progression and the player shell. Game UI supplies
  only its editor, board and previews through closed component contracts.

## Remaining delivery

- [ ] Product contracts: shared publication, packs, attempts, progression,
  ownership, offline/recovery, Numberlink rules, and complete app journeys.
- [ ] Quint lifecycle models with implementation replay and invariants for
  publication, stable references, attempts and progression.
- [x] Numberlink definitions, path rules, codecs, bounded solver and properties.
- [ ] Independent puzzle capabilities in shared game and client registration;
  composable with existing turn games, with a structurally different consumer.
  Numberlink now enters both normal registries as a standalone puzzle game.
  Turn catalogs, automation and conformance enrollment derive only the games
  that actually offer a turn engine; no multiplayer capability is invented.
- [ ] Shared content persistence, permission policy, mutation validation,
  publication transactions, idempotence and conflict handling.
  The shared storage and sync path includes choosing a kept draft as a fresh
  working copy, stale-choice refusal and duplicate-choice protection.
- [ ] Pack authoring, immutable pack revisions, independent puzzle access,
  withdrawal behavior and stable old revision access.
- [ ] Attempts, automatic persistence, undo/redo, restart, replay history,
  completions, next puzzle and cross-device pack progression.
  The shared domain path and four assembled app journeys pass, including
  a fresh signed-in device. Critical models and browser-bundle execution
  remain open.
- [ ] Shared discovery, authoring shell, pack editor and player shell.
  Shared screens now compose the real mutation, query, identity and permission
  hooks. Creation, metadata autosave, validation, publication and completion
  scenarios drive them in the counting reference app. Four normal Numberlink
  app journeys also pass. Server-refusal recovery, browser-bundle execution
  and the full release gate remain open. Bounded hydration and normal
  Numberlink registry enrollment are implemented.
- [ ] Numberlink visual builder, player and previews; pointer, touch, keyboard,
  accessible labels and responsive design-system components.
  Game components and automated input contracts are implemented; assembling
  the registered Numberlink client supplies them to the shared saved-content
  workflows. Four full app journeys have executable bindings and pass in
  the product harness; browser-bundle and UI-quality checks remain open.
- [ ] Real app registry, navigation, runtime/sub composition, sync, identity,
  observability, feedback and self-service readiness integration.
- [x] Bound discovery and retained-history subscriptions before offering them
  in the normal app, so a device does not hydrate the entire public catalog
  or every saved copy at once.
  Selected content uses explicit edition, pack, document and personal-history
  subscriptions; catalogue and history pages contain at most 32 entries.
- [ ] Review public wake fanout and private working-head metadata as part of
  the remaining sync and application integration audit.
- [ ] Executable Gherkin, Quint, properties and app integration coverage,
  including offline/reconnect, conflicts, duplicate/partial operations,
  unauthorized publication and existing multiplayer regression coverage.
- [ ] Spec audit, generated inputs/catalogs, documentation, full `bun verify`,
  and applicable deeper verification. No manual verification evidence.

Completion must be audited against every section of the request, rather than
inferred from this ledger or from a narrow test run.

## Current evidence

- Numberlink's 19 path and completion scenarios were undefined before binding
  and now pass through the repository's Gherkin runner and deterministic
  rule harness. These are domain-rule checks, not assembled-app checks.
- Changed framework packages passed 15 Turbo tasks covering typechecking,
  lint, code tests and the Numberlink spec part. Properties cover malformed
  external data, state/definition codecs, conserved cells, atomic gestures,
  solver witnesses and comparison with independent small-board enumeration.
- The opaque `PuzzleContent` contract and branded `defineGame` registration
  accept a standalone Numberlink definition. `defineTurnGame` can also supply
  the same capability beside its multiplayer capabilities. A test-only
  Sokoban corridor exercises push-based opaque states through the contract.
  Client registration also accepts standalone puzzle rendering and the same
  capability beside a turn game. Main registry enrollment remains unfinished.
  The shared authoring and player screens are implemented and exercised in the
  reference app.
- The first full `bun verify` stopped after 100 successful tasks on
  `@libs/battleship-harness-ts#verify:models:1:4`: the bounded `invFinality`
  proof returned no verdict within 240 seconds. It found no counterexample.
  Diagnostics were archived under the runner's `verify-run-BqTzmB` directory.
  The observability lookup found no matching model trace. This gate still
  needs a successful verdict before completion.
- All 66 shared Puzzles scenarios passed through actual sync engines,
  SQLite stores, server replay, queries and virtual network ports, using
  the structurally different counting reference app. They cover drafts,
  stable publication, ordered packs, private playtests, attempts, history,
  restart, progression, offline reopening, reconnect and divergent work.
- Eighteen Turbo typecheck, lint and code-test tasks passed across the
  shared puzzle, harness, permissions, turn-game and sync packages.
  Properties check opaque history codecs, persistent history values and
  undo/redo reversibility. The spec ownership gate passed.
- Integration found and pinned two sync defects: successful writes returned
  zero affected rows, and offline mutation requests delayed reconnection.
  The wrapper now reports actual affected rows; the uploader follows the
  injected lifecycle and cancels stale in-flight waits when going offline.
- The spec vocabulary correction is committed separately. All 66 scenarios
  pass after rebinding, and the standard repository spec gate passes.
  Critical Quint models, complete coverage audits, actual app integration
  and full verification remain open.
- Rules are bound into the Puzzles sub's mutation factories for local changes
  and server replay, keeping the sync engine independent of game vocabulary.
  Standalone capability composition and missing client-part refusals are
  covered. Twenty-four focused typecheck, lint and test tasks passed; five
  assembled registry/runtime typechecks passed. All 66 lifecycle scenarios
  pass with these same factories, without special harness environment wiring.
  The five registry/runtime lints and full sync-engine harness code-test task
  also pass, including its domain-vocabulary guard and refusal-isolation test.
- A second full `bun verify` reached its 600-second global deadline while the
  Apple clock typecheck was scheduled. It returned no complete gate verdict;
  diagnostics are in the runner's `verify-run-SfIazX` archive. Neither full
  verification attempt is a pass.
- Numberlink's player, editor and preview compose the design system. The
  shared `PathGridBoard` handles capture, crossed-cell sampling, stable cell
  buttons and keyboard focus. Numberlink owns provisional drawing and uses
  its rules for both preview and committed actions. The editor preserves
  endpoints on refused resizing and retains unfinished editable definitions.
  Seventeen focused checks and all 19 Numberlink rule scenarios pass. Two
  endpoint-editing regressions have pinned literal inputs; restoring the
  faulty handlers makes both tests fail. The corrected 17-task run passes,
  as do the i18n and package-registration gates.
  These components are not yet enrolled in the app's shared content screens.
- Private-work access is declared as six conformance capabilities and a
  complete 36-case decision table. It passes policy, replay/private-query,
  and mounted-client checks alongside all 66 shared lifecycle scenarios
  (73 checks together). Thirteen permission and shared-harness tasks and
  the standard spec gate pass. Client and server decisions share one
  resource-role resolver. A pinned client regression fails with the old
  space-only role resolution and passes with ownership facts included.
- Kept draft copies can become a fresh working copy without changing either
  source or an existing edition. A stale choice refuses without writing,
  and a repeated old choice cannot undo a later edit. The two new examples
  were undefined before binding and now pass through the sync engine. All
  68 shared scenarios plus seven access-table checks pass, along with 12
  focused code/type/lint tasks. App screens and lifecycle models remain open.
  The updated decision binding also covers choosing a kept draft. Its
  typecheck/lint rerun, the standard spec gate and ownership gate pass;
  the strict gate still reports only the existing external wording pairs.
- Shared discovery, edition details, pack overview and preview, authoring,
  metadata autosave, kept-copy selection, validation, publishing, playtests,
  history controls, restart and saved-attempt screens use the normal game
  capability boundary and design system. They contain no Numberlink-specific
  branches. Existing creation, metadata, validation, publication and completion
  scenarios now drive the real shared screens over the counting reference
  app's SQLite store and sync engine. All 75 shared checks pass, as do nine
  focused typecheck, lint and code-test tasks and the i18n, package and readiness
  gates. The screens are not yet offered by a registered app game.
- The metadata scenario exposed an editor-lifetime defect: the document watch
  could deliver a new head before the draft watch delivered its row. Keeping
  the workspace mounted preserves consecutive description and difficulty
  inputs. The failure is recorded at 2026-10-23T15:55:49.145Z in the shared
  harness report's test trace. A literal regression now passes. A second
  regression keeps an earlier available pack edition startable after a later
  edition is published. Restoring each faulty condition makes its own test
  fail; the corrected code tests pass.
- The normal puzzle sub no longer holds content-wide session queries. Shared
  screens subscribe to the current game, requested pages, selected immutable
  editions, pack references and the person's current attempt. The wire-level
  budget check seeds 1,025 puzzles plus their editions and 1,025 additional
  draft copies, then reads bounded pages without clipping. It uses the same
  pile example data with the native in-process SQLite port for a fast large
  fixture; the sync/reference scenarios keep their existing SQL ports.
- Cold entry is exercised with the counting reference app's session configured
  to load no puzzle content. The shared screen discovers, starts, reopens and
  completes a real saved attempt through its own subscriptions. The empty
  offline library can still create a private draft. Eighteen focused typecheck,
  lint and test tasks and all 75 lifecycle/access checks pass. Normal Numberlink
  enrollment, refused-write recovery, critical models and the release gate
  remain open.
- A pinned 35-attempt input gives every attempt the same timestamp. Restoring
  ascending local identity order makes loading the next descending server page
  lose entries; matching the server's cursor order makes the screen load all
  35. The reference snapshot also keeps its table keys stable when its first
  pack appears. Restoring that fault or ignoring injected offline events makes
  the corresponding regression fail. Connectivity status is fixed separately
  in `cfe664ddc`.
- Numberlink is enrolled in the production shared and client registries.
  The same registry still feeds the room host and app sub composition, while
  a derived turn-only registry feeds multiplayer rules, automation and
  conformance enrollment. The registration test was red before enrollment.
  All 25 focused typecheck, lint and test tasks pass across nine registry,
  runtime and puzzle packages, including the existing turn conformance suites.
  The shared puzzle lifecycle and access run still passes all 75 checks.
- Assembled query indexability found that the bounded document lookup's
  owner/public disjunction produced an unindexable workload path. Reading its
  bounded identity batch through the primary key, then filtering private
  documents before returning rows or bodies, preserves access and passes the
  full app query check. A named regression records that failure. The app's
  explicit composition test includes the new puzzle tables, queries and
  mutations as well as the existing multiplayer setup table and mutation.
- All four Numberlink app journeys pass together through ordinary navigation,
  identity, permissions, SQLite reads, local mutations and server replay.
  They cover visual authoring, validation and real playtests, publication,
  changed pack order, undo/redo, restart, reopening, another signed-in device,
  completing and continuing a pack, and old editions after republication.
  The offline journey creates a puzzle inside a new pack, edits and reorders
  private work, completes an available puzzle, reopens both devices offline,
  then shares the retained publication and completion with a fresh device.
  The live runner uses the same bindings; its browser execution is still open.
- App-journey development pinned and fixed two regressions in separate commits:
  a scoped tap could select a sibling's identically named child control, and
  opening pack preview could unmount a pending reorder. Their literal examples
  remain part of ordinary verification.
- The affected puzzle, Numberlink, runtime, product, Gherkin and tool package
  typechecks, lints and code tests pass. All 75 shared lifecycle/access checks
  also pass. The standard spec, spec-ownership, i18n, package and readiness
  gates pass. A separate literal regression fixes the static checker's loss
  of nested journey registrations; new harnesses are included in spec-cache
  inputs and the existing UI-quality report graph. These focused results do
  not replace the full release gate or the outstanding browser execution.
- The full gate on `caa722e0a` stopped at its enforced dependency audit after
  66.7 seconds. Newly reported advisories affected Happy DOM, Serialize
  JavaScript, Undici and Atlas's separate Zod 3 dependency. Updating the first
  three to their patched releases leaves only the Atlas-owned Zod finding.
  The same issue is already tracked at
  [atlas#16](https://github.com/crvouga/atlas/issues/16); the current npm Atlas
  release still requests Zod 3. No advisory suppression, report-only mode or
  forced Zod major override is introduced. The full gate remains blocked on
  a corrected upstream dependency graph.
  With the available updates installed, 15 affected DOM/UI/harness tasks,
  both browser bundle builds, all 75 shared checks and all four app journeys
  pass. This dependency repair is committed separately from the app journeys.
- Preparing live cross-device verification found that requesting another
  monitoring sign-in always minted a different account. A pinned HTTP example
  was red before the fixture gained a server-signed, callback-bound continuation.
  A second device uses the normal callback to join that same monitoring account;
  another journey still starts fresh. The continuation stays in the runner,
  expires on the injected clock and rejects tampering, callback changes and
  rotated secrets. The auth/vendor/product typechecks, lints and code tests
  pass. This repairs the live fixture; it is not browser-execution evidence.
- Automated stack-browser execution now passes the authoring/discovery,
  cross-device continuation and earlier-edition journeys. The fourth journey
  reaches offline creation and completion, then fails when the guest reopens:
  the app shows a space-joining screen instead of its saved workspace.
  The failure is recorded under the full offline Numberlink scenario name in
  the runtime harness report at 2026-10-24T09:57:34.545Z, trace
  `ea216bfecc6bd9774e7e672bde3d529e`. This is
  a frozen Vite test build against the production Worker handler and owned
  simulated services; production-bundle and full release evidence remain open.
- Those browser runs exposed independently reproducible defects. Outside
  SQLite reads could observe an intermediate transaction state; root queries,
  prepared executions and worker operations now queue behind whole
  transactions. Acknowledgement generation fences are checked again after
  the merge and database queues grant a response its turn. Literal regressions
  cover both queues and the native, Mockingbird and worker SQL adapters.
  All 25 affected SQL/sync/harness tasks passed before the later puzzle fixes;
  the final sync fence typecheck, lint and code-test tasks also pass.
- Saved positions and private draft copies survived snapshots, but their
  pending replay previously skipped restoring the current head. Replay now
  conditionally restores that head without moving back from a later choice.
  Selecting a kept position creates a fresh continuation identity, so revisiting
  a state never revisits an old head identity. Fresh stale choices still refuse
  atomically. Pinned examples cover draft saves, kept-draft choices, moves,
  kept-position choices, identity reuse and old replay after later editing.
- Identical incoming Numberlink row snapshots could cancel a provisional
  gesture. Primitive input equality now preserves it; a pinned keyboard
  example failed before this fix. The counting reference app now supplies the
  complete providers required by central permission-denial surfaces. Fourteen
  focused puzzle/Numberlink typecheck, lint and code-test tasks, all 75 shared
  checks, and all four in-process app journeys pass. The isolated browser
  offline-reopening failure remains under investigation.
- Offline-browser diagnostics preserve the same account and find its saved
  rows on the first reopening, but a following navigation encounters an old
  owner's handles. The previously installed SQLite WASM initializer removes
  its pool directory when initialization fails. Upstream added explicit
  preservation and corrected failed-acquisition cleanup; SQLite WASM is now
  pinned to 3.54.1-build1 and the adapter enables preservation. The interim
  local preflight is deleted. See the
  [upstream report](https://sqlite.org/forum/info/5664cd4baee50236) and
  [documented option](https://sqlite.org/wasm/doc/tip/persistence.md).
  Further pinned examples
  cover retry after owner release, a queued broker connect outliving its
  disconnect, and a Web Lock granted after the fallback owner page unloads.
  Nine web-SQLite typecheck, lint and code-test tasks pass after the upgrade,
  including client, shared and asset-builder checks. Before the upgrade,
  the broader harness, runtime and tool packages passed 12 tasks; the product
  app's typecheck and lint also passed. Stack-browser execution remains the outstanding
  check for the complete offline flow.
