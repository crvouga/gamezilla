# Model and policy traceability

All 127 Quint files are referenced by regions of the single product machine
and included as complete source cards in the enriched chart. Context models
retain actor choices, data, guards, invariants and offline rules that the
visible graph projects. Event declarations and whole-product helpers remain
in their existing scopes. Complete traversal of the finite chart does not run
these models or replace their automated acceptance evidence.

The table locates the main region for each source. The compiler derives
actual ownership from state references, so a source can inform several
regions. `bun atlas:lint` produces the exact source catalog in
`.cache/product-statechart/contracts.json` and the enriched machine in
`.cache/product-statechart/specs/product.machine.json`. A newly added model
or policy without an owner fails compilation.

| Quint source | Product region |
| --- | --- |
| [specs/auth/outside-accounts.qnt](../../specs/auth/outside-accounts.qnt) | sign-in |
| [specs/auth/private-apple-email.qnt](../../specs/auth/private-apple-email.qnt) | sign-in |
| [specs/billing/events.qnt](../../specs/billing/events.qnt) | billing |
| [specs/billing/membership-lifecycle.qnt](../../specs/billing/membership-lifecycle.qnt) | billing |
| [specs/billing/payment-provider-switch.qnt](../../specs/billing/payment-provider-switch.qnt) | billing |
| [specs/chess-board/board-annotations.qnt](../../specs/chess-board/board-annotations.qnt) | chess-board |
| [specs/chess-board/board-independence.qnt](../../specs/chess-board/board-independence.qnt) | chess-board |
| [specs/chess-board/board-keyboard.qnt](../../specs/chess-board/board-keyboard.qnt) | chess-board |
| [specs/chess-board/board-lifecycle.qnt](../../specs/chess-board/board-lifecycle.qnt) | chess-board |
| [specs/chess-board/board-options.qnt](../../specs/chess-board/board-options.qnt) | chess-board |
| [specs/chess-board/board-premoves.qnt](../../specs/chess-board/board-premoves.qnt) | chess-board |
| [specs/chess-board/board-promotion.qnt](../../specs/chess-board/board-promotion.qnt) | chess-board |
| [specs/games/custom-game-control.qnt](../../specs/games/custom-game-control.qnt) | custom-game |
| [specs/games/custom-game-play.qnt](../../specs/games/custom-game-play.qnt) | custom-game |
| [specs/games/custom-game.qnt](../../specs/games/custom-game.qnt) | custom-game |
| [specs/games/matched-game-spaces.qnt](../../specs/games/matched-game-spaces.qnt) | multiplayer |
| [specs/games/matched-game.qnt](../../specs/games/matched-game.qnt) | multiplayer |
| [specs/games/matched-game-ending.qnt](../../specs/games/matched-game-ending.qnt) | pong |
| [specs/games/opponent-search.qnt](../../specs/games/opponent-search.qnt) | pong |
| [specs/games/puzzle-attempt.qnt](../../specs/games/puzzle-attempt.qnt) | puzzles |
| [specs/chess/puzzle-assistant.qnt](../../specs/chess/puzzle-assistant.qnt) | puzzles |
| [specs/games/puzzle-feed.qnt](../../specs/games/puzzle-feed.qnt) | puzzle-feed |
| [specs/games/puzzle-link.qnt](../../specs/games/puzzle-link.qnt) | puzzle-links |
| [specs/chess/puzzle-loading.qnt](../../specs/chess/puzzle-loading.qnt) | puzzle-ingest |
| [specs/games/puzzle-result-recovery.qnt](../../specs/games/puzzle-result-recovery.qnt) | puzzles |
| [specs/games/puzzle-sound.qnt](../../specs/games/puzzle-sound.qnt) | puzzles |
| [specs/chess/puzzle-sound.qnt](../../specs/chess/puzzle-sound.qnt) | puzzles |
| [specs/db-indexes/index-interruption.qnt](../../specs/db-indexes/index-interruption.qnt) | database-maintenance |
| [specs/db-indexes/index-retirement.qnt](../../specs/db-indexes/index-retirement.qnt) | database-maintenance |
| [specs/friends/events.qnt](../../specs/friends/events.qnt) | friends |
| [specs/friends/friendship.qnt](../../specs/friends/friendship.qnt) | friends |
| [specs/matchmaking/events.qnt](../../specs/matchmaking/events.qnt) | matchmaking |
| [specs/matchmaking/matching.qnt](../../specs/matchmaking/matching.qnt) | matchmaking |
| [specs/pong/pong-local-play.qnt](../../specs/pong/pong-local-play.qnt) | pong |
| [specs/pong/pong-scoring.qnt](../../specs/pong/pong-scoring.qnt) | pong |
| [specs/pong/pong-shared-control.qnt](../../specs/pong/pong-shared-control.qnt) | pong |
| [specs/profile/account-privacy.qnt](../../specs/profile/account-privacy.qnt) | privacy |
| [specs/profile/account-sign-in.qnt](../../specs/profile/account-sign-in.qnt) | identity |
| [specs/profile/events.qnt](../../specs/profile/events.qnt) | identity |
| [specs/profile/username-changes.qnt](../../specs/profile/username-changes.qnt) | profile |
| [specs/puzzles/draft-editing.qnt](../../specs/puzzles/draft-editing.qnt) | puzzle-content |
| [specs/puzzles/edition-rules.qnt](../../specs/puzzles/edition-rules.qnt) | puzzle-content |
| [specs/puzzles/pack-authoring.qnt](../../specs/puzzles/pack-authoring.qnt) | puzzle-content |
| [specs/puzzles/pack-progression.qnt](../../specs/puzzles/pack-progression.qnt) | puzzle-content |
| [specs/puzzles/pack-publication.qnt](../../specs/puzzles/pack-publication.qnt) | puzzle-content |
| [specs/puzzles/publication-recovery.qnt](../../specs/puzzles/publication-recovery.qnt) | puzzle-content |
| [specs/puzzles/puzzle-attempt.qnt](../../specs/puzzles/puzzle-attempt.qnt) | puzzle-content |
| [specs/puzzles/puzzle-authoring.qnt](../../specs/puzzles/puzzle-authoring.qnt) | puzzle-content |
| [specs/puzzles/puzzle-publication.qnt](../../specs/puzzles/puzzle-publication.qnt) | puzzle-content |
| [specs/room/match-clock.qnt](../../specs/room/match-clock.qnt) | room |
| [specs/room/match-recovery.qnt](../../specs/room/match-recovery.qnt) | room |
| [specs/room/ownership.qnt](../../specs/room/ownership.qnt) | room |
| [specs/room/tally-recovery.qnt](../../specs/room/tally-recovery.qnt) | room |
| [specs/room/tally.qnt](../../specs/room/tally.qnt) | room |
| [specs/runtime/app-platform.qnt](../../specs/runtime/app-platform.qnt) | app |
| [specs/sokoban/board-building.qnt](../../specs/sokoban/board-building.qnt) | sokoban |
| [specs/sokoban/publication-proof.qnt](../../specs/sokoban/publication-proof.qnt) | sokoban |
| [specs/sokoban/sokoban-play.qnt](../../specs/sokoban/sokoban-play.qnt) | sokoban |
| [specs/sokoban/starter-pack.qnt](../../specs/sokoban/starter-pack.qnt) | sokoban |
| [specs/spaces/events.qnt](../../specs/spaces/events.qnt) | spaces |
| [specs/spaces/space-hosting.qnt](../../specs/spaces/space-hosting.qnt) | spaces |
| [specs/spaces/space-names.qnt](../../specs/spaces/space-names.qnt) | spaces |
| [specs/spaces/space-recovery.qnt](../../specs/spaces/space-recovery.qnt) | spaces |
| [specs/sync-engine/note-conflicts.qnt](../../specs/sync-engine/note-conflicts.qnt) | notes |
| [specs/sync-engine/note-recovery.qnt](../../specs/sync-engine/note-recovery.qnt) | notes |
| [specs/sync-engine/note-refusal-recovery.qnt](../../specs/sync-engine/note-refusal-recovery.qnt) | notes |
| [specs/sync-engine/note-replication.qnt](../../specs/sync-engine/note-replication.qnt) | notes |
| [specs/synthetic-population/playing-pong.qnt](../../specs/synthetic-population/playing-pong.qnt) | pong |
| [specs/synthetic-population/recognizing-synthetic-users.qnt](../../specs/synthetic-population/recognizing-synthetic-users.qnt) | pong |
| [specs/system/access-sync.qnt](../../specs/system/access-sync.qnt) | access |
| [specs/system/adversarial-examples.qnt](../../specs/system/adversarial-examples.qnt) | product |
| [specs/system/boundary-assumptions.qnt](../../specs/system/boundary-assumptions.qnt) | product |
| [specs/system/client-image.qnt](../../specs/system/client-image.qnt) | product |
| [specs/system/community.qnt](../../specs/system/community.qnt) | product |
| [specs/system/fair-recovery.qnt](../../specs/system/fair-recovery.qnt) | product |
| [specs/system/identity-machine.qnt](../../specs/system/identity-machine.qnt) | product |
| [specs/system/identity.qnt](../../specs/system/identity.qnt) | product |
| [specs/system/membership-machine.qnt](../../specs/system/membership-machine.qnt) | access |
| [specs/system/membership.qnt](../../specs/system/membership.qnt) | product |
| [specs/system/multiplayer.qnt](../../specs/system/multiplayer.qnt) | product |
| [specs/system/notification-machine.qnt](../../specs/system/notification-machine.qnt) | product |
| [specs/system/notifications.qnt](../../specs/system/notifications.qnt) | product |
| [specs/system/offline-replication.qnt](../../specs/system/offline-replication.qnt) | product |
| [specs/system/play.qnt](../../specs/system/play.qnt) | product |
| [specs/system/privacy-lifecycle.qnt](../../specs/system/privacy-lifecycle.qnt) | product |
| [specs/system/privacy.qnt](../../specs/system/privacy.qnt) | product |
| [specs/system/product-state.qnt](../../specs/system/product-state.qnt) | product |
| [specs/system/public-profile.qnt](../../specs/system/public-profile.qnt) | product |
| [specs/system/puzzle-board.qnt](../../specs/system/puzzle-board.qnt) | product |
| [specs/system/recovery.qnt](../../specs/system/recovery.qnt) | product |
| [specs/system/replication.qnt](../../specs/system/replication.qnt) | product |
| [specs/system/system-actions.qnt](../../specs/system/system-actions.qnt) | product |
| [specs/system/universe.qnt](../../specs/system/universe.qnt) | product |
| [specs/system/whole-system.qnt](../../specs/system/whole-system.qnt) | product |

## Decisions, structure and objectives

These contracts constrain the capabilities and appear in their business catalog. The ten DMN files retain their complete source text and produce 47 decision-row cards with exact input conditions and answers. Their full documents preserve decision names, policy semantics and descriptions. Alloy, OpenSLO and the conformance manifest also retain their complete source text. Their presence in the explorer does not claim their required evidence has run.

| Contract | Product region |
| --- | --- |
| [specs/billing/access.dmn](../../specs/billing/access.dmn) | access |
| [specs/chess/assistant-observation.dmn](../../specs/chess/assistant-observation.dmn) | puzzles |
| [specs/games/custom-game-access.dmn](../../specs/games/custom-game-access.dmn) | custom-game |
| [specs/games/custom-game-delivery.openslo.yaml](../../specs/games/custom-game-delivery.openslo.yaml) | custom-game |
| [specs/games/custom-games.als](../../specs/games/custom-games.als) | custom-game |
| [specs/games/daily-puzzle-limit.dmn](../../specs/games/daily-puzzle-limit.dmn) | puzzles |
| [specs/games/matched-games.als](../../specs/games/matched-games.als) | multiplayer |
| [specs/games/matched-game-ready.openslo.yaml](../../specs/games/matched-game-ready.openslo.yaml) | multiplayer |
| [specs/games/matched-game-watch-access.dmn](../../specs/games/matched-game-watch-access.dmn) | multiplayer |
| [specs/chess/puzzle-management-access.dmn](../../specs/chess/puzzle-management-access.dmn) | puzzle-ingest |
| [specs/games/puzzle-progress.als](../../specs/games/puzzle-progress.als) | puzzles |
| [specs/games/puzzle-ready.openslo.yaml](../../specs/games/puzzle-ready.openslo.yaml) | puzzles |
| [specs/games/unfinished-game-limit.dmn](../../specs/games/unfinished-game-limit.dmn) | multiplayer |
| [specs/conformance.yaml](../../specs/conformance.yaml) | product |
| [specs/friends/friendships.als](../../specs/friends/friendships.als) | friends |
| [specs/matchmaking/searches.als](../../specs/matchmaking/searches.als) | matchmaking |
| [specs/profile/accounts.als](../../specs/profile/accounts.als) | privacy |
| [specs/profile/privacy-access.dmn](../../specs/profile/privacy-access.dmn) | privacy |
| [specs/puzzles/puzzle-content-access.dmn](../../specs/puzzles/puzzle-content-access.dmn) | puzzle-content |
| [specs/runtime/availability.openslo.yaml](../../specs/runtime/availability.openslo.yaml) | environment |
| [specs/spaces/hosting-limit.dmn](../../specs/spaces/hosting-limit.dmn) | spaces |
| [specs/spaces/space-roles.dmn](../../specs/spaces/space-roles.dmn) | spaces |
| [specs/spaces/spaces.als](../../specs/spaces/spaces.als) | spaces |
| [specs/sync-engine/note-delivery.openslo.yaml](../../specs/sync-engine/note-delivery.openslo.yaml) | notes |
