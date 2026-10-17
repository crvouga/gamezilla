# Model and policy traceability

All 72 Quint files are referenced by regions of the single product machine
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
| [specs/chess/multiplayer-spaces.qnt](../../specs/chess/multiplayer-spaces.qnt) | multiplayer |
| [specs/chess/multiplayer.qnt](../../specs/chess/multiplayer.qnt) | multiplayer |
| [specs/chess/puzzle-attempt.qnt](../../specs/chess/puzzle-attempt.qnt) | puzzles |
| [specs/chess/puzzle-feed.qnt](../../specs/chess/puzzle-feed.qnt) | puzzle-feed |
| [specs/chess/puzzle-link.qnt](../../specs/chess/puzzle-link.qnt) | puzzle-links |
| [specs/chess/puzzle-loading.qnt](../../specs/chess/puzzle-loading.qnt) | puzzle-ingest |
| [specs/chess/puzzle-result-recovery.qnt](../../specs/chess/puzzle-result-recovery.qnt) | puzzles |
| [specs/chess/puzzle-sound.qnt](../../specs/chess/puzzle-sound.qnt) | puzzles |
| [specs/db-indexes/index-interruption.qnt](../../specs/db-indexes/index-interruption.qnt) | database-maintenance |
| [specs/db-indexes/index-retirement.qnt](../../specs/db-indexes/index-retirement.qnt) | database-maintenance |
| [specs/friends/events.qnt](../../specs/friends/events.qnt) | friends |
| [specs/friends/friendship.qnt](../../specs/friends/friendship.qnt) | friends |
| [specs/matchmaking/events.qnt](../../specs/matchmaking/events.qnt) | matchmaking |
| [specs/matchmaking/matching.qnt](../../specs/matchmaking/matching.qnt) | matchmaking |
| [specs/profile/account-privacy.qnt](../../specs/profile/account-privacy.qnt) | privacy |
| [specs/profile/account-sign-in.qnt](../../specs/profile/account-sign-in.qnt) | identity |
| [specs/profile/events.qnt](../../specs/profile/events.qnt) | identity |
| [specs/profile/username-changes.qnt](../../specs/profile/username-changes.qnt) | profile |
| [specs/room/match-clock.qnt](../../specs/room/match-clock.qnt) | room |
| [specs/room/match-recovery.qnt](../../specs/room/match-recovery.qnt) | room |
| [specs/room/ownership.qnt](../../specs/room/ownership.qnt) | room |
| [specs/room/tally-recovery.qnt](../../specs/room/tally-recovery.qnt) | room |
| [specs/room/tally.qnt](../../specs/room/tally.qnt) | room |
| [specs/runtime/app-platform.qnt](../../specs/runtime/app-platform.qnt) | app |
| [specs/spaces/events.qnt](../../specs/spaces/events.qnt) | spaces |
| [specs/spaces/space-hosting.qnt](../../specs/spaces/space-hosting.qnt) | spaces |
| [specs/spaces/space-names.qnt](../../specs/spaces/space-names.qnt) | spaces |
| [specs/spaces/space-recovery.qnt](../../specs/spaces/space-recovery.qnt) | spaces |
| [specs/sync-engine/note-conflicts.qnt](../../specs/sync-engine/note-conflicts.qnt) | notes |
| [specs/sync-engine/note-recovery.qnt](../../specs/sync-engine/note-recovery.qnt) | notes |
| [specs/sync-engine/note-refusal-recovery.qnt](../../specs/sync-engine/note-refusal-recovery.qnt) | notes |
| [specs/sync-engine/note-replication.qnt](../../specs/sync-engine/note-replication.qnt) | notes |
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
| [specs/chess/daily-puzzle-limit.dmn](../../specs/chess/daily-puzzle-limit.dmn) | puzzles |
| [specs/chess/multiplayer-games.als](../../specs/chess/multiplayer-games.als) | multiplayer |
| [specs/chess/multiplayer-ready.openslo.yaml](../../specs/chess/multiplayer-ready.openslo.yaml) | multiplayer |
| [specs/chess/multiplayer-watch-access.dmn](../../specs/chess/multiplayer-watch-access.dmn) | multiplayer |
| [specs/chess/puzzle-management-access.dmn](../../specs/chess/puzzle-management-access.dmn) | puzzle-ingest |
| [specs/chess/puzzle-progress.als](../../specs/chess/puzzle-progress.als) | puzzles |
| [specs/chess/puzzle-ready.openslo.yaml](../../specs/chess/puzzle-ready.openslo.yaml) | puzzles |
| [specs/chess/unfinished-game-limit.dmn](../../specs/chess/unfinished-game-limit.dmn) | multiplayer |
| [specs/conformance.yaml](../../specs/conformance.yaml) | product |
| [specs/friends/friendships.als](../../specs/friends/friendships.als) | friends |
| [specs/matchmaking/searches.als](../../specs/matchmaking/searches.als) | matchmaking |
| [specs/profile/accounts.als](../../specs/profile/accounts.als) | privacy |
| [specs/profile/privacy-access.dmn](../../specs/profile/privacy-access.dmn) | privacy |
| [specs/runtime/availability.openslo.yaml](../../specs/runtime/availability.openslo.yaml) | environment |
| [specs/spaces/hosting-limit.dmn](../../specs/spaces/hosting-limit.dmn) | spaces |
| [specs/spaces/space-roles.dmn](../../specs/spaces/space-roles.dmn) | spaces |
| [specs/spaces/spaces.als](../../specs/spaces/spaces.als) | spaces |
| [specs/sync-engine/note-delivery.openslo.yaml](../../specs/sync-engine/note-delivery.openslo.yaml) | notes |
