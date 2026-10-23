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
- [ ] Shared content persistence, permission policy, mutation validation,
  publication transactions, idempotence and conflict handling.
- [ ] Pack authoring, immutable pack revisions, independent puzzle access,
  withdrawal behavior and stable old revision access.
- [ ] Attempts, automatic persistence, undo/redo, restart, replay history,
  completions, next puzzle and cross-device pack progression.
- [ ] Shared discovery, authoring shell, pack editor and player shell.
- [ ] Numberlink visual builder, player and previews; pointer, touch, keyboard,
  accessible labels and responsive design-system components.
- [ ] Real app registry, navigation, runtime/sub composition, sync, identity,
  observability, feedback and self-service readiness integration.
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
  Main registries, client registration and shared authoring remain unfinished.
- The first full `bun verify` stopped after 100 successful tasks on
  `@libs/battleship-harness-ts#verify:models:1:4`: the bounded `invFinality`
  proof returned no verdict within 240 seconds. It found no counterexample.
  Diagnostics were archived under the runner's `verify-run-BqTzmB` directory.
  The observability lookup found no matching model trace. This gate still
  needs a successful verdict before completion.
