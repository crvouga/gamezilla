# Model and policy traceability

All 72 Quint files are referenced by composed capabilities and included as complete source cards in the enriched product chart. Context models retain actor choices, data, guards, invariants and offline rules that the visible graph projects. Event declarations and whole-product helpers remain in their existing scopes. Complete traversal of the finite chart does not run these models or replace their automated acceptance evidence.

The table locates the main capability for each source. The compiler derives actual ownership from module references, so a source can inform several capabilities. `bun atlas:lint` produces the exact source catalog in `.cache/product-statechart/contracts.json` and the capability catalogs in `.cache/product-statechart/specs/product.machine.json`. A newly added model or policy without an owner fails compilation.

| Quint source | Exploration module |
| --- | --- |
| [specs/auth/outside-accounts.qnt](../../specs/auth/outside-accounts.qnt) | [sign-in](sign-in.machine.yaml) |
| [specs/auth/private-apple-email.qnt](../../specs/auth/private-apple-email.qnt) | [sign-in](sign-in.machine.yaml) |
| [specs/billing/events.qnt](../../specs/billing/events.qnt) | [billing](billing.machine.yaml) |
| [specs/billing/membership-lifecycle.qnt](../../specs/billing/membership-lifecycle.qnt) | [billing](billing.machine.yaml) |
| [specs/billing/payment-provider-switch.qnt](../../specs/billing/payment-provider-switch.qnt) | [billing](billing.machine.yaml) |
| [specs/chess-board/board-annotations.qnt](../../specs/chess-board/board-annotations.qnt) | [chess-board](chess-board.machine.yaml) |
| [specs/chess-board/board-independence.qnt](../../specs/chess-board/board-independence.qnt) | [chess-board](chess-board.machine.yaml) |
| [specs/chess-board/board-keyboard.qnt](../../specs/chess-board/board-keyboard.qnt) | [chess-board](chess-board.machine.yaml) |
| [specs/chess-board/board-lifecycle.qnt](../../specs/chess-board/board-lifecycle.qnt) | [chess-board](chess-board.machine.yaml) |
| [specs/chess-board/board-options.qnt](../../specs/chess-board/board-options.qnt) | [chess-board](chess-board.machine.yaml) |
| [specs/chess-board/board-premoves.qnt](../../specs/chess-board/board-premoves.qnt) | [chess-board](chess-board.machine.yaml) |
| [specs/chess-board/board-promotion.qnt](../../specs/chess-board/board-promotion.qnt) | [chess-board](chess-board.machine.yaml) |
| [specs/chess/custom-game-control.qnt](../../specs/chess/custom-game-control.qnt) | [custom-game](custom-game.machine.yaml) |
| [specs/chess/custom-game-play.qnt](../../specs/chess/custom-game-play.qnt) | [custom-game](custom-game.machine.yaml) |
| [specs/chess/custom-game.qnt](../../specs/chess/custom-game.qnt) | [custom-game](custom-game.machine.yaml) |
| [specs/chess/multiplayer-spaces.qnt](../../specs/chess/multiplayer-spaces.qnt) | [multiplayer](multiplayer.machine.yaml) |
| [specs/chess/multiplayer.qnt](../../specs/chess/multiplayer.qnt) | [multiplayer](multiplayer.machine.yaml) |
| [specs/chess/puzzle-attempt.qnt](../../specs/chess/puzzle-attempt.qnt) | [puzzles](puzzles.machine.yaml) |
| [specs/chess/puzzle-feed.qnt](../../specs/chess/puzzle-feed.qnt) | [puzzle-feed](puzzle-feed.machine.yaml) |
| [specs/chess/puzzle-link.qnt](../../specs/chess/puzzle-link.qnt) | [puzzle-links](puzzle-links.machine.yaml) |
| [specs/chess/puzzle-loading.qnt](../../specs/chess/puzzle-loading.qnt) | [puzzle-ingest](puzzle-ingest.machine.yaml) |
| [specs/chess/puzzle-result-recovery.qnt](../../specs/chess/puzzle-result-recovery.qnt) | [puzzles](puzzles.machine.yaml) |
| [specs/chess/puzzle-sound.qnt](../../specs/chess/puzzle-sound.qnt) | [puzzles](puzzles.machine.yaml) |
| [specs/db-indexes/index-interruption.qnt](../../specs/db-indexes/index-interruption.qnt) | [database-maintenance](database-maintenance.machine.yaml) |
| [specs/db-indexes/index-retirement.qnt](../../specs/db-indexes/index-retirement.qnt) | [database-maintenance](database-maintenance.machine.yaml) |
| [specs/friends/events.qnt](../../specs/friends/events.qnt) | [friends](friends.machine.yaml) |
| [specs/friends/friendship.qnt](../../specs/friends/friendship.qnt) | [friends](friends.machine.yaml) |
| [specs/matchmaking/events.qnt](../../specs/matchmaking/events.qnt) | [matchmaking](matchmaking.machine.yaml) |
| [specs/matchmaking/matching.qnt](../../specs/matchmaking/matching.qnt) | [matchmaking](matchmaking.machine.yaml) |
| [specs/profile/account-privacy.qnt](../../specs/profile/account-privacy.qnt) | [privacy](privacy.machine.yaml) |
| [specs/profile/account-sign-in.qnt](../../specs/profile/account-sign-in.qnt) | [identity](identity.machine.yaml) |
| [specs/profile/events.qnt](../../specs/profile/events.qnt) | [identity](identity.machine.yaml) |
| [specs/profile/username-changes.qnt](../../specs/profile/username-changes.qnt) | [profile](profile.machine.yaml) |
| [specs/room/match-clock.qnt](../../specs/room/match-clock.qnt) | [room](room.machine.yaml) |
| [specs/room/match-recovery.qnt](../../specs/room/match-recovery.qnt) | [room](room.machine.yaml) |
| [specs/room/ownership.qnt](../../specs/room/ownership.qnt) | [room](room.machine.yaml) |
| [specs/room/tally-recovery.qnt](../../specs/room/tally-recovery.qnt) | [room](room.machine.yaml) |
| [specs/room/tally.qnt](../../specs/room/tally.qnt) | [room](room.machine.yaml) |
| [specs/runtime/app-platform.qnt](../../specs/runtime/app-platform.qnt) | [app](app.machine.yaml) |
| [specs/spaces/events.qnt](../../specs/spaces/events.qnt) | [spaces](spaces.machine.yaml) |
| [specs/spaces/space-hosting.qnt](../../specs/spaces/space-hosting.qnt) | [spaces](spaces.machine.yaml) |
| [specs/spaces/space-names.qnt](../../specs/spaces/space-names.qnt) | [spaces](spaces.machine.yaml) |
| [specs/spaces/space-recovery.qnt](../../specs/spaces/space-recovery.qnt) | [spaces](spaces.machine.yaml) |
| [specs/sync-engine/note-conflicts.qnt](../../specs/sync-engine/note-conflicts.qnt) | [notes](notes.machine.yaml) |
| [specs/sync-engine/note-recovery.qnt](../../specs/sync-engine/note-recovery.qnt) | [notes](notes.machine.yaml) |
| [specs/sync-engine/note-refusal-recovery.qnt](../../specs/sync-engine/note-refusal-recovery.qnt) | [notes](notes.machine.yaml) |
| [specs/sync-engine/note-replication.qnt](../../specs/sync-engine/note-replication.qnt) | [notes](notes.machine.yaml) |
| [specs/system/access-sync.qnt](../../specs/system/access-sync.qnt) | [access](access.machine.yaml) |
| [specs/system/adversarial-examples.qnt](../../specs/system/adversarial-examples.qnt) | [product](product.machine.yaml) |
| [specs/system/boundary-assumptions.qnt](../../specs/system/boundary-assumptions.qnt) | [product](product.machine.yaml) |
| [specs/system/client-image.qnt](../../specs/system/client-image.qnt) | [product](product.machine.yaml) |
| [specs/system/community.qnt](../../specs/system/community.qnt) | [product](product.machine.yaml) |
| [specs/system/fair-recovery.qnt](../../specs/system/fair-recovery.qnt) | [product](product.machine.yaml) |
| [specs/system/identity-machine.qnt](../../specs/system/identity-machine.qnt) | [product](product.machine.yaml) |
| [specs/system/identity.qnt](../../specs/system/identity.qnt) | [product](product.machine.yaml) |
| [specs/system/membership-machine.qnt](../../specs/system/membership-machine.qnt) | [access](access.machine.yaml) |
| [specs/system/membership.qnt](../../specs/system/membership.qnt) | [product](product.machine.yaml) |
| [specs/system/multiplayer.qnt](../../specs/system/multiplayer.qnt) | [product](product.machine.yaml) |
| [specs/system/notification-machine.qnt](../../specs/system/notification-machine.qnt) | [product](product.machine.yaml) |
| [specs/system/notifications.qnt](../../specs/system/notifications.qnt) | [product](product.machine.yaml) |
| [specs/system/offline-replication.qnt](../../specs/system/offline-replication.qnt) | [product](product.machine.yaml) |
| [specs/system/play.qnt](../../specs/system/play.qnt) | [product](product.machine.yaml) |
| [specs/system/privacy-lifecycle.qnt](../../specs/system/privacy-lifecycle.qnt) | [product](product.machine.yaml) |
| [specs/system/privacy.qnt](../../specs/system/privacy.qnt) | [product](product.machine.yaml) |
| [specs/system/product-state.qnt](../../specs/system/product-state.qnt) | [product](product.machine.yaml) |
| [specs/system/public-profile.qnt](../../specs/system/public-profile.qnt) | [product](product.machine.yaml) |
| [specs/system/puzzle-board.qnt](../../specs/system/puzzle-board.qnt) | [product](product.machine.yaml) |
| [specs/system/recovery.qnt](../../specs/system/recovery.qnt) | [product](product.machine.yaml) |
| [specs/system/replication.qnt](../../specs/system/replication.qnt) | [product](product.machine.yaml) |
| [specs/system/system-actions.qnt](../../specs/system/system-actions.qnt) | [product](product.machine.yaml) |
| [specs/system/universe.qnt](../../specs/system/universe.qnt) | [product](product.machine.yaml) |
| [specs/system/whole-system.qnt](../../specs/system/whole-system.qnt) | [product](product.machine.yaml) |

## Decisions, structure and objectives

These contracts constrain the capabilities and appear in their business catalog. The ten DMN files retain their complete source text and produce 47 decision-row cards with exact input conditions and answers. Their full documents preserve decision names, policy semantics and descriptions. Alloy, OpenSLO and the conformance manifest also retain their complete source text. Their presence in the explorer does not claim their required evidence has run.

| Contract | Exploration module |
| --- | --- |
| [specs/billing/access.dmn](../../specs/billing/access.dmn) | [access](access.machine.yaml) |
| [specs/chess/assistant-observation.dmn](../../specs/chess/assistant-observation.dmn) | [puzzles](puzzles.machine.yaml) |
| [specs/chess/custom-game-access.dmn](../../specs/chess/custom-game-access.dmn) | [custom-game](custom-game.machine.yaml) |
| [specs/chess/custom-game-delivery.openslo.yaml](../../specs/chess/custom-game-delivery.openslo.yaml) | [custom-game](custom-game.machine.yaml) |
| [specs/chess/custom-games.als](../../specs/chess/custom-games.als) | [custom-game](custom-game.machine.yaml) |
| [specs/chess/daily-puzzle-limit.dmn](../../specs/chess/daily-puzzle-limit.dmn) | [puzzles](puzzles.machine.yaml) |
| [specs/chess/multiplayer-games.als](../../specs/chess/multiplayer-games.als) | [multiplayer](multiplayer.machine.yaml) |
| [specs/chess/multiplayer-ready.openslo.yaml](../../specs/chess/multiplayer-ready.openslo.yaml) | [multiplayer](multiplayer.machine.yaml) |
| [specs/chess/multiplayer-watch-access.dmn](../../specs/chess/multiplayer-watch-access.dmn) | [multiplayer](multiplayer.machine.yaml) |
| [specs/chess/puzzle-management-access.dmn](../../specs/chess/puzzle-management-access.dmn) | [puzzle-ingest](puzzle-ingest.machine.yaml) |
| [specs/chess/puzzle-progress.als](../../specs/chess/puzzle-progress.als) | [puzzles](puzzles.machine.yaml) |
| [specs/chess/puzzle-ready.openslo.yaml](../../specs/chess/puzzle-ready.openslo.yaml) | [puzzles](puzzles.machine.yaml) |
| [specs/chess/unfinished-game-limit.dmn](../../specs/chess/unfinished-game-limit.dmn) | [multiplayer](multiplayer.machine.yaml) |
| [specs/conformance.yaml](../../specs/conformance.yaml) | [product](product.machine.yaml) |
| [specs/friends/friendships.als](../../specs/friends/friendships.als) | [friends](friends.machine.yaml) |
| [specs/matchmaking/searches.als](../../specs/matchmaking/searches.als) | [matchmaking](matchmaking.machine.yaml) |
| [specs/profile/accounts.als](../../specs/profile/accounts.als) | [privacy](privacy.machine.yaml) |
| [specs/profile/privacy-access.dmn](../../specs/profile/privacy-access.dmn) | [privacy](privacy.machine.yaml) |
| [specs/runtime/availability.openslo.yaml](../../specs/runtime/availability.openslo.yaml) | [environment](environment.machine.yaml) |
| [specs/spaces/hosting-limit.dmn](../../specs/spaces/hosting-limit.dmn) | [spaces](spaces.machine.yaml) |
| [specs/spaces/space-roles.dmn](../../specs/spaces/space-roles.dmn) | [spaces](spaces.machine.yaml) |
| [specs/spaces/spaces.als](../../specs/spaces/spaces.als) | [spaces](spaces.machine.yaml) |
| [specs/sync-engine/note-delivery.openslo.yaml](../../specs/sync-engine/note-delivery.openslo.yaml) | [notes](notes.machine.yaml) |
