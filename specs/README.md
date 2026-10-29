# Specifications

`specs/` is the executable definition of the product. This file is its one
rulebook, in two parts:

- **[Part 1 · Strategy](#part-1--strategy)**: why the specs exist, what
  "production-ready" and "product-equivalent" mean, and every kind of
  evidence a release needs.
- **[Part 2 · Standard](#part-2--standard)**: how this repository writes,
  binds, runs and audits each kind of spec, rule by rule.

The strategy says what must be true; the standard says how it is made true
here. When they disagree, the standard is wrong: fix it.

# Part 1 · Strategy

*Executable specifications as the definition of product correctness and
production readiness*

**Core principle.** `specs/` is the implementation-independent
executable definition of the product and of the evidence required to
release it. A complete rewrite that passes is product-equivalent; a
release artifact that passes is production-ready; and every required
verdict is produced automatically with zero manual testing.

## 1. Governing Goals

### Product contract inventory

The inventory includes what people do in the app and what the team does
with its developer tools. Developer workflows describe choices and visible
outcomes; their implementation belongs in the repository and package
briefings. An entry without a complete executable contract remains a
release gap under Goal 1. Listing an entry does not prove it.

The launch covers the capabilities currently offered in the app. Planned
capabilities become release obligations when they are offered; they are not
required additions for this launch. In particular, Streak, Storm, Rush and
additional team authoring tools are planned capabilities.

| Surface | Contract home | Contract that closes it |
| --- | --- | --- |
| Accounts, profiles and sign-in methods | [`profile/`](profile/), [`auth/`](auth/) | Closed by [`account-deletion.feature`](profile/account-deletion.feature), [`personal-data-export.feature`](profile/personal-data-export.feature), [`personal-data-retention.feature`](profile/personal-data-retention.feature), [`account-privacy.qnt`](profile/account-privacy.qnt) and [`account-sign-in.qnt`](profile/account-sign-in.qnt). Production sign-in offers Google and refuses Apple in [`sign-in.feature`](auth/sign-in.feature); methods a person manages are [`sign-in-methods.feature`](profile/sign-in-methods.feature). Reactions to a confirmed deletion are [`deleted-account-payments.feature`](billing/deleted-account-payments.feature), [`deleted-account-progress.feature`](games/deleted-account-progress.feature), [`deleted-account-friendships.feature`](friends/deleted-account-friendships.feature), [`deleted-account-spaces.feature`](spaces/deleted-account-spaces.feature) and [`privacy-retention.feature`](runtime/privacy-retention.feature). |
| Memberships, payments and paid access | [`billing/`](billing/) | Closed by [`grace-ends.feature`](billing/grace-ends.feature) and [`grace-and-refunds.qnt`](billing/grace-and-refunds.qnt): paid access lasts 7 days of grace and is free after that, online or offline, including signing in again. A refund ends paid access at once in [`refunds.feature`](billing/refunds.feature). Confirmed deletion stops future charges, and payment retention expires, in [`deleted-account-payments.feature`](billing/deleted-account-payments.feature). |
| Spaces and their people | [`spaces/`](spaces/) | Closed by [`space-add-person.feature`](spaces/space-add-person.feature), [`space-remove-person.feature`](spaces/space-remove-person.feature) and [`adding-people.qnt`](spaces/adding-people.qnt). Only the host adds or removes another person. The host leaves rather than removing themselves. Removal sticks while either person is offline. A removed person may join again through the public link while the space is open; an ended space refuses; reopening the app does not join them. |
| Friendships, requests and blocking | [`friends/`](friends/) | Closed by [`friend-request-decline-cancel.feature`](friends/friend-request-decline-cancel.feature) and [`friendship.qnt`](friends/friendship.qnt): a declined request refuses another ask until a day has passed, and cancelling does not start that wait. Account deletion is [`deleted-account-friendships.feature`](friends/deleted-account-friendships.feature). Asking, accepting, declining, cancelling, removing, blocking and unblocking are the status transitions. |
| Inbox choices and outcomes | [`friends/`](friends/), [`games/matched-game-result-notices.feature`](games/matched-game-result-notices.feature) | Closed by [`inbox-items.feature`](friends/inbox-items.feature) and [`inbox-items.qnt`](friends/inbox-items.qnt): opening marks an item read only with a connection, marking all read and archiving do the same, a chosen list only filters, and a day passing keeps every item where it is. A missing connection refuses the change. Dismissing a daily game's result notice, including the offline refusal, is [`matched-game-result-notices.feature`](games/matched-game-result-notices.feature). |
| Chess puzzles, progress and watching | [`chess/`](chess/) | Closed by [`puzzle-accessibility.feature`](chess/puzzle-accessibility.feature) for hearing a chess puzzle's moves and pieces and playing its moves by their squares; [`puzzle-assistant.feature`](chess/puzzle-assistant.feature) for encouragement; [`puzzle-assistant-accessibility.feature`](chess/puzzle-assistant-accessibility.feature) for speech; [`puzzle-assistant.qnt`](chess/puzzle-assistant.qnt) for the assistant following the attempt. How any game's puzzle attempt is played, and its feed, ratings, stats, game log, refused actions, daily puzzle limit, guest play, progress-erasure, playing offline, results across devices, watching, puzzle links, sounds and the keyboard and listening, are every game's (below); chess keeps the Puzzle Assistant explaining why nothing happens from an earlier position in [`puzzle-refusals.feature`](chess/puzzle-refusals.feature), chess's own puzzle themes, such as "fork", in the feed in [`puzzle-feed.feature`](chess/puzzle-feed.feature), castling either way in [`solve-flow.feature`](chess/solve-flow.feature), a shown solution ending in checkmate in [`solve-show-solution.feature`](chess/solve-show-solution.feature), where a picked-up piece can go in [`solve-move-rules.feature`](chess/solve-move-rules.feature), a first hint pointing at the piece in [`puzzle-controls.feature`](chess/puzzle-controls.feature), a review in algebraic notation in [`puzzle-review.feature`](chess/puzzle-review.feature), the sound of a capture in [`puzzle-sound.feature`](chess/puzzle-sound.feature) and [`puzzle-sound.qnt`](chess/puzzle-sound.qnt), and only a legal checkmate counting as one in [`puzzle-objective.feature`](chess/puzzle-objective.feature). |
| App navigation, preferences and accessibility | [`runtime/`](runtime/) | Closed by [`device-layouts.feature`](runtime/device-layouts.feature), [`accessibility.feature`](runtime/accessibility.feature) and [`settings.feature`](runtime/settings.feature): turning a phone or tablet, or narrowing a computer, keeps place, preferences and reachability; listening and the keyboard alone can do what the app offers. An interrupted theme choice and running into trouble keep the saved preference and the place in [`interrupted-preference.feature`](runtime/interrupted-preference.feature) and [`preference-recovery.qnt`](runtime/preference-recovery.qnt). |
| Shared notes, rooms and matchmaking examples | [`sync-engine/`](sync-engine/), [`room/`](room/), [`matchmaking/`](matchmaking/) | Closed by the observable note, room and matchmaking features and by [`note-replication.qnt`](sync-engine/note-replication.qnt), [`note-recovery.qnt`](sync-engine/note-recovery.qnt), [`note-conflicts.qnt`](sync-engine/note-conflicts.qnt), [`note-refusal-recovery.qnt`](sync-engine/note-refusal-recovery.qnt), [`tally.qnt`](room/tally.qnt), [`tally-recovery.qnt`](room/tally-recovery.qnt), [`match-clock.qnt`](room/match-clock.qnt), [`match-recovery.qnt`](room/match-recovery.qnt), [`ownership.qnt`](room/ownership.qnt) and [`matching.qnt`](matchmaking/matching.qnt). Guards a person or the team can see stay. How quickly a shared note shows is [`note-delivery.openslo.yaml`](sync-engine/note-delivery.openslo.yaml). |
| Every game | [`games/`](games/) | Closed by [`game-choices.feature`](games/game-choices.feature), [`custom-games.feature`](games/custom-games.feature), [`game-turns.feature`](games/game-turns.feature), [`finding-an-opponent.feature`](games/finding-an-opponent.feature) and [`game-history.feature`](games/game-history.feature). A matched game's turns, aborting, draw offers, rematch and end are [`matched-game-turns.feature`](games/matched-game-turns.feature), [`matched-game-abort.feature`](games/matched-game-abort.feature), [`matched-game-draw-offers.feature`](games/matched-game-draw-offers.feature), [`matched-game-rematch.feature`](games/matched-game-rematch.feature) and [`matched-game-over.feature`](games/matched-game-over.feature). Finding an opponent across devices and spaces, at a clock choice, after a custom game and with blocks is [`finding-an-opponent-devices.feature`](games/finding-an-opponent-devices.feature), [`finding-an-opponent-clock-choices.feature`](games/finding-an-opponent-clock-choices.feature), [`finding-an-opponent-after-a-custom-game.feature`](games/finding-an-opponent-after-a-custom-game.feature) and [`matched-game-blocking.feature`](games/matched-game-blocking.feature). A matched game's sides, clock, daily games and their clock, a clock low on time, ratings, results by the game's own rules and a victory on time needing a side that can still win are [`matched-game-sides.feature`](games/matched-game-sides.feature), [`matched-game-clock.feature`](games/matched-game-clock.feature), [`matched-game-daily.feature`](games/matched-game-daily.feature), [`matched-game-daily-clock.feature`](games/matched-game-daily-clock.feature), [`matched-game-low-on-time.feature`](games/matched-game-low-on-time.feature), [`matched-game-ratings.feature`](games/matched-game-ratings.feature), [`matched-game-results.feature`](games/matched-game-results.feature), [`matched-game-rules-draw.feature`](games/matched-game-rules-draw.feature) and [`matched-game-cannot-win.feature`](games/matched-game-cannot-win.feature). A daily game's turn notices, turn reminders and result notices are [`matched-game-turn-notices.feature`](games/matched-game-turn-notices.feature), [`matched-game-turn-reminders.feature`](games/matched-game-turn-reminders.feature) and [`matched-game-result-notices.feature`](games/matched-game-result-notices.feature). Keeping a matched game without a connection, after time away, through a pause and with the account is [`matched-game-offline.feature`](games/matched-game-offline.feature), [`matched-game-recovery.feature`](games/matched-game-recovery.feature), [`matched-game-interruption.feature`](games/matched-game-interruption.feature) and [`matched-game-ownership.feature`](games/matched-game-ownership.feature). Watching it from either space, reviewing its earlier positions, copying its game record, and playing it with the keyboard alone and by listening are [`matched-game-watchers.feature`](games/matched-game-watchers.feature), [`matched-game-review.feature`](games/matched-game-review.feature), [`matched-game-record.feature`](games/matched-game-record.feature) and [`matched-game-accessibility.feature`](games/matched-game-accessibility.feature). Setting up a custom game — creating it, choosing, claiming and releasing sides, invitations, readiness and starting — is [`custom-game-creation.feature`](games/custom-game-creation.feature), [`custom-game-sides.feature`](games/custom-game-sides.feature), [`custom-game-open-places.feature`](games/custom-game-open-places.feature), [`custom-game-invitations.feature`](games/custom-game-invitations.feature) and [`custom-game-readiness.feature`](games/custom-game-readiness.feature). Playing it — its clock, draw offers, claiming the win from someone away, cancelling, leaving, the space ending and a rematch — is [`custom-game-clock.feature`](games/custom-game-clock.feature), [`custom-game-draw-offers.feature`](games/custom-game-draw-offers.feature), [`custom-game-away.feature`](games/custom-game-away.feature) and [`custom-game-completion.feature`](games/custom-game-completion.feature); a victory needing a side that can still win is [`custom-game-cannot-win.feature`](games/custom-game-cannot-win.feature), and a rematch keeping the earlier custom game is [`custom-game-rematch.feature`](games/custom-game-rematch.feature). Keeping it through a lost connection, on the host's device alone, across a person's devices and through a pause is [`custom-game-connection.feature`](games/custom-game-connection.feature), [`custom-game-offline.feature`](games/custom-game-offline.feature), [`custom-game-devices.feature`](games/custom-game-devices.feature) and [`custom-game-interruption.feature`](games/custom-game-interruption.feature). Who may watch and play it, blocking, signing in and out, account deletion and personal-data exports, and the keyboard and listening are [`custom-game-access.feature`](games/custom-game-access.feature), [`custom-game-blocking.feature`](games/custom-game-blocking.feature), [`custom-game-identity.feature`](games/custom-game-identity.feature), [`custom-game-privacy.feature`](games/custom-game-privacy.feature) and [`custom-game-accessibility.feature`](games/custom-game-accessibility.feature). A custom game's state under any sequence of choices is [`custom-game.qnt`](games/custom-game.qnt); its play, clock, being away and cancelling are [`custom-game-play.qnt`](games/custom-game-play.qnt); people and bots on either side are [`custom-game-control.qnt`](games/custom-game-control.qnt); the host playing alone with no connection is [`custom-game-local.qnt`](games/custom-game-local.qnt); which stored custom games are legal is [`custom-games.als`](games/custom-games.als); who may do what in one is [`custom-game-access.dmn`](games/custom-game-access.dmn); and choices reaching other people promptly is [`custom-game-delivery.openslo.yaml`](games/custom-game-delivery.openslo.yaml). A matched game's state under any sequence of choices — pairing, sides, clocks, offers, rematches, ratings, account deletion and devices offline — is [`matched-game.qnt`](games/matched-game.qnt); a daily game with its turn notices, turn reminders and result notices is [`matched-game-daily.qnt`](games/matched-game-daily.qnt); reviewing an earlier position and copying the game record on one's own board is [`matched-game-own-board.qnt`](games/matched-game-own-board.qnt); one matched game shown in two spaces, with watchers, idle people and copying, is [`matched-game-shared.qnt`](games/matched-game-shared.qnt) and [`matched-game-spaces.qnt`](games/matched-game-spaces.qnt); keeping its clocks and result through an interruption of shared play is [`matched-game-clock-recovery.qnt`](games/matched-game-clock-recovery.qnt); which stored matched games are legal is [`matched-games.als`](games/matched-games.als); who may watch one is [`matched-game-watch-access.dmn`](games/matched-game-watch-access.dmn); the one unfinished matched game is [`unfinished-game-limit.dmn`](games/unfinished-game-limit.dmn); and a matched game becoming ready promptly is [`matched-game-ready.openslo.yaml`](games/matched-game-ready.openslo.yaml). Every device in a space following its host's game choice, which a guest or an offline device cannot change, is [`space-follows-the-host.feature`](games/space-follows-the-host.feature) and [`space-follow.qnt`](games/space-follow.qnt). A game offering puzzles plays them as a feed with rating changes in [`puzzle-play.feature`](games/puzzle-play.feature); opening, answering and calling out moves in [`solve-flow.feature`](games/solve-flow.feature); who may move and when in [`solve-move-rules.feature`](games/solve-move-rules.feature); retries, hints and showing the solution in [`puzzle-controls.feature`](games/puzzle-controls.feature) and [`solve-show-solution.feature`](games/solve-show-solution.feature); an attempt surviving leaving and closing the app in [`puzzle-attempt-resume.feature`](games/puzzle-attempt-resume.feature); the puzzle clock and skipping in [`puzzle-skip-clock.feature`](games/puzzle-skip-clock.feature); and reviewing a puzzle's line in [`puzzle-review.feature`](games/puzzle-review.feature). Customizing the feed, its account gate, its choices sticking and running dry are [`puzzle-feed.feature`](games/puzzle-feed.feature), [`puzzle-feed-gates.feature`](games/puzzle-feed-gates.feature), [`puzzle-feed-sticks.feature`](games/puzzle-feed-sticks.feature) and [`puzzle-exhaust.feature`](games/puzzle-exhaust.feature); choosing the next puzzle for skill-matching is [`puzzle-selection.feature`](games/puzzle-selection.feature); the puzzle rating is [`puzzle-rating.feature`](games/puzzle-rating.feature); the stats and game log are [`puzzle-stats-summary.feature`](games/puzzle-stats-summary.feature) and [`puzzle-stats.feature`](games/puzzle-stats.feature); saved feed choices on two devices are [`puzzle-feed.qnt`](games/puzzle-feed.qnt); and the next puzzle being ready promptly is [`puzzle-ready.openslo.yaml`](games/puzzle-ready.openslo.yaml). Actions a puzzle refuses once it is over, from an earlier position, before a retry or out of the hints' order are [`puzzle-refusals.feature`](games/puzzle-refusals.feature). The daily puzzle limit, one allowance for every game offering puzzles that rated puzzles of another game count toward, and its invitation to sign in are [`puzzle-quota.feature`](games/puzzle-quota.feature), [`puzzle-limits-by-kind.feature`](games/puzzle-limits-by-kind.feature), [`puzzle-limit-upgrade.feature`](games/puzzle-limit-upgrade.feature) and [`daily-puzzle-limit.dmn`](games/daily-puzzle-limit.dmn); a guest playing puzzles and keeping their progress are [`puzzle-guest-play.feature`](games/puzzle-guest-play.feature) and [`puzzle-guest-carryover.feature`](games/puzzle-guest-carryover.feature); erasing a deleted account's puzzle progress is [`deleted-account-progress.feature`](games/deleted-account-progress.feature); and one first result per puzzle, agreeing in the game log and puzzle rating, is [`puzzle-progress.als`](games/puzzle-progress.als). A puzzle attempt's state under any sequence of choices, with a friend watching and devices offline, is [`puzzle-attempt.qnt`](games/puzzle-attempt.qnt). Playing puzzles without a connection, for days, and keeping each first result once across closing the app and two devices are [`puzzle-offline.feature`](games/puzzle-offline.feature), [`puzzle-offline-days.feature`](games/puzzle-offline-days.feature), [`puzzle-interruption-recovery.feature`](games/puzzle-interruption-recovery.feature), [`puzzle-outcome-sync.feature`](games/puzzle-outcome-sync.feature) and [`puzzle-result-recovery.qnt`](games/puzzle-result-recovery.qnt); friends watching and arriving while a puzzle is under way are [`puzzle-spectator.feature`](games/puzzle-spectator.feature) and [`puzzle-late-watcher.feature`](games/puzzle-late-watcher.feature); sharing and opening a puzzle link is [`puzzle-link.feature`](games/puzzle-link.feature) and [`puzzle-link.qnt`](games/puzzle-link.qnt); the app's sounds in puzzles and reviews are [`puzzle-sound.feature`](games/puzzle-sound.feature) and [`puzzle-sound.qnt`](games/puzzle-sound.qnt); and a puzzle's results heard by listening and its choices made with the keyboard alone are [`puzzle-accessibility.feature`](games/puzzle-accessibility.feature). A move that wins for the solver solving the puzzle off its line, offline too, is [`puzzle-objective.feature`](games/puzzle-objective.feature), for games whose known puzzles include one won another way; finding an opponent and a matched game leaving the space's puzzle and the puzzle rating alone, for games offering puzzles as well as finding an opponent, are [`puzzle-matched-play.feature`](games/puzzle-matched-play.feature); a custom game leaving the puzzle rating alone, for games offering puzzles as well as custom games, is [`puzzle-custom-play.feature`](games/puzzle-custom-play.feature). A game with a private setup, which each side prepares in secret before play, has it in a custom game and a matched game as [`custom-game-private-setup.feature`](games/custom-game-private-setup.feature) and [`matched-game-private-setup.feature`](games/matched-game-private-setup.feature) say: only its own person sees it, everyone sees who is ready, and play shows only what each move revealed; its state under any sequence of choices is [`private-setup.qnt`](games/private-setup.qnt). A game with secret choices, which every side makes in secret at the same point of play, has them as [`secret-choices.feature`](games/secret-choices.feature) says: everyone sees who has chosen, only its own person sees what, a choice is final for its round, and all of a round's choices take effect together once the last side has chosen. In a custom game with more than two sides, a stand-in plays for a participant away for 60 seconds until they take back their side, as [`multi-seat-stand-ins.feature`](games/multi-seat-stand-ins.feature) says; a victory the game's rules give to several sides together is [`shared-victories.feature`](games/shared-victories.feature); their state under any sequence of choices is [`secret-choices.qnt`](games/secret-choices.qnt). Each scenario and model holds for every game that offers what it shows, and runs once for each of them; a game added later is held to them without a copy. A game's own rules stay in its own context. |
| Connect Four | [`connect-four/`](connect-four/) | Classic drops and endings are specified in [`play-connect-four.feature`](connect-four/play-connect-four.feature) and [`connect-four-play.qnt`](connect-four/connect-four-play.qnt); Hard bots in [`connect-four-bots.feature`](connect-four/connect-four-bots.feature) and accessible play in [`connect-four-accessibility.feature`](connect-four/connect-four-accessibility.feature). Custom games, turns, opponents, matched games and history are those of every game. The complete-game journey is [`connect-four-game.feature`](journeys/connect-four-game.feature), with availability in [`connect-four-health.feature`](connect-four/connect-four-health.feature). |
| Battleship | [`battleship/`](battleship/) | Classic fleets, shots, sinkings and victory are specified in [`battleship-fleet-placement.feature`](battleship/battleship-fleet-placement.feature), [`battleship-start.feature`](battleship/battleship-start.feature), [`battleship-shots.feature`](battleship/battleship-shots.feature), [`battleship-sinking.feature`](battleship/battleship-sinking.feature), [`battleship-hidden-fleets.feature`](battleship/battleship-hidden-fleets.feature), [`battleship-fleet-setup.qnt`](battleship/battleship-fleet-setup.qnt) and [`battleship-play.qnt`](battleship/battleship-play.qnt); bots in [`battleship-bots.feature`](battleship/battleship-bots.feature) and accessible play in [`battleship-accessibility.feature`](battleship/battleship-accessibility.feature). Custom games, turns, opponents, matched games, history and private setups are those of every game; Battleship offers no puzzles. The complete-game journey is [`battleship-game.feature`](journeys/battleship-game.feature), with availability in [`battleship-health.feature`](battleship/battleship-health.feature). |
| Hearts | [`hearts/`](hearts/) | Four-player Hearts is specified in [`hearts-hands.feature`](hearts/hearts-hands.feature), [`hearts-passing.feature`](hearts/hearts-passing.feature), [`hearts-tricks.feature`](hearts/hearts-tricks.feature), [`hearts-breaking.feature`](hearts/hearts-breaking.feature) and [`hearts-scoring.feature`](hearts/hearts-scoring.feature); people, bots, finding an opponent and rematches in [`hearts-custom-games.feature`](hearts/hearts-custom-games.feature); stand-ins in [`hearts-away.feature`](hearts/hearts-away.feature); and accessible play in [`hearts-accessibility.feature`](hearts/hearts-accessibility.feature). Custom games, turns, secret choices, stand-ins, rematches, history and shared victories are those of every game; Hearts offers no puzzles and is not offered for finding an opponent. |
| Test-world views and checkpoints | [`developer-tools/test-world-views.feature`](developer-tools/test-world-views.feature), [`developer-tools/checkpoints.feature`](developer-tools/checkpoints.feature), [`developer-tools/checkpoints.qnt`](developer-tools/checkpoints.qnt) | Closed by those contracts. An interrupted save is not a checkpoint. A failed restore keeps the world the team already had. Closing and opening the testing tool returns the world it kept and does not bring back a deleted checkpoint. Restoring one checkpoint leaves every other saved world alone. |
| Data notebooks | [`developer-tools/data-notebook.feature`](developer-tools/data-notebook.feature), [`developer-tools/data-notebook.qnt`](developer-tools/data-notebook.qnt) | Closed by those contracts. The team can change a saved question, put a later question ahead of an earlier one, and see an automatic answer when the notebook opens. An answer shows at most 5000 rows. |
| Release checks | [`developer-tools/release-check.feature`](developer-tools/release-check.feature), [`conformance.yaml`](conformance.yaml), [`sync-engine/note-delivery.openslo.yaml`](sync-engine/note-delivery.openslo.yaml) | Closed by [`release-check.feature`](developer-tools/release-check.feature): a pass needs a current automated pass for this edition; failed, unknown, missing, skipped, not run, stale and manual evidence refuse it, and an earlier edition's pass cannot approve a changed edition. The quantitative rate the product already promises is [`note-delivery.openslo.yaml`](sync-engine/note-delivery.openslo.yaml): at least 19 of every 20 shared notes show within 200ms. [`availability.openslo.yaml`](runtime/availability.openslo.yaml) stands in at 99 of every 100 checks and is not that promise. |
| Investigation trails and recovery | [`runtime/request-records.feature`](runtime/request-records.feature), [`profile/finding-a-person.feature`](profile/finding-a-person.feature), [`runtime/privacy-retention.feature`](runtime/privacy-retention.feature), [`runtime/investigation.qnt`](runtime/investigation.qnt), [`runtime/privacy-recovery.qnt`](runtime/privacy-recovery.qnt) | Closed by those contracts. The team can read a trail from the last 30 days, cannot read one that expired or was never written, and a person is never shown a trail. Name, place and time lookup is [`finding-a-person.feature`](profile/finding-a-person.feature). Recovery keeps an active person's saved data and cannot revive a deleted account. |
| Building, changing and releasing an environment | [`runtime/declared-environment.feature`](runtime/declared-environment.feature), [`runtime/connected-services.feature`](runtime/connected-services.feature), [`runtime/environment-release.feature`](runtime/environment-release.feature), [`runtime/environment-release.qnt`](runtime/environment-release.qnt) | Closed by [`environment-release.feature`](runtime/environment-release.feature) and [`environment-release.qnt`](runtime/environment-release.qnt). A failed preparation tells the team and still opens the environment. A release finishes only after a passing release check. A newer check of the same change replaces one still running, and one release does not replace another's check. Stopping a release that has started does not undo it. The standing checks that an environment stays as planned, and that outside services still answer, remain [`declared-environment.feature`](runtime/declared-environment.feature) and [`connected-services.feature`](runtime/connected-services.feature). |

Each cell cites the contract that closed that obligation. A cell that
again names open work is a release gap under Goal 1. The audit must keep
each cell on a verified contract or an explicit product decision before a
release can claim completeness.

These are the non-negotiable goals of the specification system. Every
design decision in this strategy is subordinate to them.

### Goal 1 --- Specs must prove the product is production-ready

> **If every required spec and automated conformance check passes for a
> release artifact, that artifact is production-ready by definition.**

A green result cannot merely mean "the tests we wrote passed." Every
required product obligation and every required class of release evidence
must have current machine-verifiable evidence. Missing, unknown,
skipped, stale, unsupported, or unexecuted obligations fail the release.

### Goal 2 --- Specs must enable a complete rewrite with an equivalent product

We must be able to delete the entire implementation and rebuild the
application from scratch using different languages, frameworks,
databases, protocols, architecture, and deployment technology while
leaving `specs/` unchanged.

> **If the rewrite passes the complete specification and conformance
> system, the rewrite is product-equivalent by definition.**

The specifications therefore describe product semantics and observable
obligations, never incidental implementation structure.

### Goal 3 --- Zero manual testing

> **A human should never manually test the application. Every check
> required for correctness, equivalence, release, or production
> readiness must be automated.**

Humans may define requirements, author specs, review changes,
investigate failures, and improve automation. Humans are never part of
the verification mechanism.

Manual QA, human sign-off, clicking through flows, visual inspection by
eye, manual smoke tests, manual accessibility checks, and manual
production verification cannot satisfy a release obligation.

For required obligations, `UNKNOWN`, `SKIPPED`, `NOT RUN`, `MANUAL`,
`UNAUTOMATED`, stale evidence, missing evidence, and missing adapters
all count as **FAIL**.

### Consequences

These goals require closed-world product conformance: a complete
inventory of product surfaces, executable obligations, automated
runners/adapters, generated negative cases, supported-environment
coverage, cross-spec consistency, live conformance where required, and
traceability from every obligation to current machine-generated
evidence.

The objective is not "high test coverage." It is:

> **Complete automated evidence that this artifact implements the
> specified product and is ready for production.**

## 2. Specification Stack

  ----------------------------------------------------------------------
  **Specification**   **Owns**                     **Primary question**
  ------------------- ---------------------------- ---------------------
  Ubiquitous language Canonical product concepts   What does this
                      and terminology              concept mean?

  Gherkin             Observable journeys and      What does an actor
                      outcomes                     observe?

  DMN                 Decisions, entitlements,     Given these facts,
                      feature gates, usage limits, what is the answer?
                      calculations                 

  Quint               State machines, concurrency, What can happen over
                      temporal properties, sync    time?
                      behavior                     

  Alloy               Structural and relational    What product
                      invariants                   worlds/snapshots are
                                                   valid?

  OpenSLO             Quantitative reliability and How well must the
                      performance objectives       product work over
                                                   time?

  Product statechart  The connected product map    Where can a person go,
                      and guided journeys          and what can happen next?

  Accessibility specs User-observable              Can supported users
                      accessibility requirements   operate the product
                                                   accessibly?

  Optional            Public product languages and Which external
  grammar/schema      interchange formats          inputs/formats are
                                                   valid?
  ----------------------------------------------------------------------

## 3. Repository Boundary and Flat Layout

**Admission rule.** A requirement belongs in `specs/` only if it can
remain unchanged after deleting the implementation and rebuilding the
product with a different language, database, framework, and
architecture.

The directory structure is intentionally flat. With the root-level
exceptions for the whole-product conformance manifest and product map,
every bounded-context specification lives
directly at:

``` text
specs/<bounded-context>/<some-spec>
```

There are no type-based subdirectories such as `behavior/`,
`decisions/`, `dynamics/`, `structure/`, `permissions/`, `objectives/`,
or `tests/`. The bounded context says **which part of the product owns
the truth**; the file extension says **what kind of specification it
is**.

Canonical shape:

``` text
specs/
  conformance.yaml
  product.machine.json
  journeys.yaml
  atlas.yaml

  membership/
    ubiquitous-language.yaml
    subscribe.feature
    cancel.feature
    permissions.dmn
    usage-limits.dmn
    membership.quint
    membership.als
    availability.openslo.yaml

  games/
    ubiquitous-language.yaml
    play-game.feature
    save-game.feature
    permissions.dmn
    usage-limits.dmn
    game.quint
    game.als
    availability.openslo.yaml

  identity/
    ubiquitous-language.yaml
    sign-up.feature
    sign-in.feature
    account.quint
    account.als
    availability.openslo.yaml

  system/
    ubiquitous-language.yaml
    purchase-membership.feature
    product.quint
    product.als
    product.openslo.yaml
```

`system` is treated like another bounded context. It owns only product
truths that genuinely span bounded contexts and should not become a
miscellaneous dumping ground.

The specification language is identified by extension:

``` text
*.feature       Gherkin: observable behavior
*.dmn           DMN: decisions, permissions, entitlements, limits
*.quint         Quint: dynamics and temporal properties
*.als           Alloy: structural/relational invariants
*.openslo.yaml  OpenSLO: quantitative quality objectives
*.machine.json  statechart: the connected whole-product map
*.ebnf          grammar, only when a public product language exists
*.schema.json   public interchange format, only when the format is product truth
```

Additional specification languages may be introduced later without
changing the directory hierarchy. A new language simply adds another
file extension under the owning bounded context.

The product statechart is the one cross-context exception: exactly one
`product.machine.json` lives at the root, with `journeys.yaml` holding its
guided paths and `atlas.yaml` naming the map. The machine links existing
product contracts and does not restate them. Automated traversal rejects an
unreachable state, transition or journey, and the Atlas explorer receives
this one machine rather than a catalog of separate capability charts.

**Flatness is a repository invariant.** Automated repository validation
must reject nested specification taxonomy directories. Apart from the
declared whole-product files, shared kernel and rulebook, a spec file must be
directly under exactly one bounded-context directory.

**Outside `specs/`:** database schemas, SQL queries, internal
APIs/events, JWT claims, framework code, migrations, deployment
manifests, vendor telemetry queries, test drivers,
implementation-specific fixtures, generated tests, generated conformance
vectors, and conformance adapters.

## 4. Verification Layers

### 4.1 Specification validity

-   DMN decisions are complete for their declared input space and do not
    contain unintended conflicting rules.

-   Quint invariants and temporal properties are model-checked; relevant
    actions and interleavings are explored.

-   Alloy assertions are checked within explicit scopes, and generated
    instances are reviewed for missing constraints.

-   OpenSLO objectives are well-formed and reference defined product
    indicators.

-   The conformance manifest detects missing, orphaned, or unexercised
    specifications.

### 4.2 Implementation conformance

Implementation-specific adapters translate between product concepts and
the implementation. Adapters may know TypeScript, Postgres, SQLite,
APIs, UI controls, or framework internals; specs may not.

> specification → oracle/reference evaluation → expected\
> implementation adapter → running implementation → actual\
> expected == actual

### 4.3 Assembled-system acceptance

Black-box Gherkin journeys exercise the assembled product.
Cross-bounded-context journeys verify that individually correct
components compose into the correct product.

### 4.4 Live production conformance

-   Production-safe Gherkin scenarios run as black-box synthetics.

-   Alloy-derived structural audits check live persisted state.

-   DMN decisions may be shadow-evaluated or sampled against production
    decisions.

-   Quint-derived trace/state checks validate observed lifecycle
    behavior where practical.

-   OpenSLO evaluates reliability and latency over time.

## 5. Entitlements, Permissions, and Usage Limits

**Canonical source: DMN.** The permission specification defines
Guest/Free/Plus entitlements, feature gates, per-game limits, and final
expected decisions from product facts. The implementation remains
independent and is tested against the DMN oracle.

  -----------------------------------------------------------------------
  **Tier**   **Capability**   **Game**   **Usage**     **Expected**
  ---------- ---------------- ---------- ------------- ------------------
  Guest      game.play        Trivia     below limit   ALLOW

  Guest      game.play        Trivia     at limit      DENY

  Free       game.save        \-         \-            ALLOW

  Free       game.customize   \-         \-            DENY

  Plus       game.customize   \-         \-            ALLOW

  Plus       game.play        Any        very large    ALLOW / unlimited
  -----------------------------------------------------------------------

**Generated cases.** Enumerate finite dimensions and generate boundary
representatives for numeric limits. For limit L, include 0, 1, L-1, L,
L+1, plus relevant time-window boundaries.

-   Entitlement/configuration resolution agrees with the specification.

-   Application permission decision (can(...) or equivalent) agrees with
    DMN.

-   Server enforcement: ALLOW succeeds; DENY is impossible at the real
    operation boundary.

-   Client gating is correct where feature visibility/availability is
    product behavior.

-   Denied operations produce no forbidden persistence effects.

> DMN permission case\
> ├─ expected decision\
> ├─ DB/config resolution ✓\
> ├─ application can(...) ✓\
> ├─ server operation ✓\
> ├─ client feature gate ✓\
> └─ resulting state ✓

## 6. State, Concurrency, and Local-First Sync

**Quint owns valid evolution.** It models operations, retries,
concurrency, offline edits, synchronization, conflict handling, and
temporal guarantees without encoding Postgres, SQLite, networking, or
sync implementation.

-   Usage cannot exceed a product limit through concurrent operations.

-   Retrying an acknowledged operation cannot create a duplicate product
    effect.

-   Finished games cannot return to active states unless explicitly
    allowed.

-   Acknowledged durable actions are not silently lost.

-   Offline/server changes follow defined conflict semantics.

-   When synchronization quiesces, server and clients eventually
    converge where convergence is promised.

## 7. Structural Invariants: Postgres and SQLite

**Alloy owns valid snapshots.** Alloy describes product relationships,
cardinalities, reachability, uniqueness, containment, and other
structural invariants. It does not know database tables.

> domain.als\
> product invariants\
> │\
> ┌──────────┴──────────┐\
> ▼ ▼\
> Postgres adapter SQLite adapter\
> │ │\
> ▼ ▼\
> server snapshot client snapshot\
> └──── valid product world? ────┘

-   Every game has exactly one owner.

-   A game's owner is also a participant.

-   A user has at most one mutually exclusive active membership where
    required.

-   Containment relationships cannot contain cycles.

-   Entitlements and usage records reference valid product concepts.

-   Every persisted Postgres or SQLite snapshot represents a legal
    product world.

**Production scaling.** Small/test snapshots may be projected into an
Alloy-compatible model. Large production datasets should be audited
through implementation-specific queries/evaluators derived from the
invariant semantics. Generated SQL is adapter code, never product
specification.

## 8. Behavioral Acceptance and Synthetics

**Gherkin owns observable behavior.** Do not duplicate DMN decision
matrices or Quint invariants as hundreds of scenarios. Gherkin focuses
on meaningful actor journeys, outcomes, failures, and cross-context
behavior.

> @synthetic\
> Scenario: Guest can start an available game\
> Given I am a guest with remaining game usage\
> When I start an available game\
> Then the game starts successfully

The tag is exactly `@synthetic`. It names no environment. The same scenario
runs in dev or production because the runner is pointed there, not because
the spec says so.

## 9. Reliability and Performance

**OpenSLO owns quantitative objectives.** State product-level success
and latency objectives without embedding Prometheus, Datadog,
cloud-provider, or other observability implementation queries.

-   Availability/success-rate objectives for critical journeys.

-   Latency objectives for user-observable operations.

-   Rolling windows and error budgets where these are product
    requirements.

-   Synthetics and telemetry adapters provide measurements used to
    evaluate objectives.

## 10. Accessibility, Security, Privacy, Recovery, and Time

  ----------------------------------------------------------------------
  **Concern**           **Typical      **Examples**
                        mechanism**    
  --------------------- -------------- ---------------------------------
  Accessibility         ACT/WCAG +     Keyboard operation, focus
                        Gherkin        behavior, accessible names

  Security properties   DMN + Quint +  Denied capabilities remain
                        adversarial    impossible; cross-user private
                        Gherkin        data is not observable

  Privacy               Quint +        Deletion/export/retention
                        Gherkin        lifecycle

  Recovery/durability   Quint +        Acknowledged operations survive
                        Gherkin        failures; retries are idempotent

  Time semantics        DMN + Quint    Usage-window reset boundaries,
                                       expiration, exact boundary
                                       behavior
  ----------------------------------------------------------------------

## 11. Closed-World Completeness

**Mandatory for the production-readiness claim.** The verifier must
prove not only that known specs pass, but that required product concepts
have not escaped specification.

-   Every product capability is declared in the product/conformance
    manifest.

-   Every permission-bearing capability has a complete decision
    specification.

-   Every declared permission has required enforcement adapters.

-   Every public product operation is traceable to its relevant
    capability, journey, or model.

-   Every required spec file has an active runner.

-   Unknown, skipped, missing, unimplemented, or unverified required
    coverage fails conformance.

-   Adding a new capability without updating required specs causes CI to
    fail.

## 12. Conformance Manifest

A root manifest defines which dimensions are mandatory and prevents
accidental removal of a verifier from producing a false green build.

> product:\
> contexts: \[identity, games, membership\]\
> tiers: \[guest, free, plus\]
>
> conformance:\
> behavior: required\
> decisions: required\
> dynamics: required\
> structure: required\
> accessibility: required\
> objectives: required
>
> production_readiness:\
> require:\
> - specification-validity\
> - implementation-conformance\
> - permission-enforcement\
> - assembled-system-acceptance\
> - production-safe-synthetics\
> - required-quality-gates

## 13. Pipeline

> product verify
>
> 1.  SPECIFICATION\
>     vocabulary / manifest PASS\
>     DMN completeness & consistency PASS\
>     Quint model checking PASS\
>     Alloy model checking PASS
>
> 2.  IMPLEMENTATION\
>     generated decision conformance PASS\
>     permission enforcement PASS\
>     model-based / trace conformance PASS\
>     Postgres structural conformance PASS\
>     SQLite structural conformance PASS\
>     accessibility conformance PASS
>
> 3.  SYSTEM\
>     Gherkin acceptance journeys PASS\
>     cross-context journeys PASS\
>     global invariants PASS
>
> 4.  RELEASE / LIVE\
>     production-safe synthetics PASS\
>     required live-state audits PASS\
>     OpenSLO readiness policy PASS
>
> 5.  COMPLETENESS\
>     declared capabilities 100%\
>     permission coverage 100%\
>     required adapters 100%\
>     required conformance checks 100%
>
> PRODUCT CONFORMANCE: PASS\
> PRODUCTION READINESS: PASS

## 14. What 'Production Ready' Means

**Definition.** A candidate is production-ready when every required
specification is valid, every required implementation and
assembled-system conformance check passes, required completeness is
100%, and all release-time quality gates defined by the conformance
manifest are satisfied.

**Important limitation.** This definition is only as complete as the
product specification and the closed-world rules that require coverage.
Unforeseen platform/runtime vulnerabilities and implementation-specific
engineering hazards still require release engineering controls; those
controls may be mandatory gates without becoming product semantics.

**Operational principle.** There is no silent 'unknown'. For a required
dimension, PASS requires evidence; absence of evidence is FAIL.

## 15. Strong Equivalence Requirements

For this strategy, passing means more than "the tests we happened to
write are green." The specification must define the complete observable
equivalence boundary.

Two implementations are product-equivalent when no actor or supported
environment represented by the specification can distinguish them except
where the specification explicitly permits variation.

The following are therefore required whenever they are part of the
product:

-   public API, CLI, webhook, deep-link, import/export, plugin, or other
    externally promised contracts;
-   supported client/server version combinations and compatibility
    promises;
-   data export/import and user-owned artifact round trips;
-   supported browsers, operating systems, device classes, locales,
    timezones, and offline/online modes;
-   exact time-window, expiration, timezone, numeric precision, currency
    rounding, ordering, tie-breaking, Unicode, and locale semantics when
    observable;
-   deterministic behavior or explicitly allowed
    nondeterminism/randomness;
-   failure, retry, cancellation, timeout, recovery, durability, and
    graceful-degradation semantics;
-   privacy, deletion, retention, tenant isolation, and cross-user
    confidentiality properties;
-   accessibility behavior;
-   quantitative reliability, latency, freshness, and capacity promises.

Internal representation remains irrelevant.

## 16. Allowed Nondeterminism

A rewrite must not be rejected merely because it chooses a different
result where the product intentionally permits several results.
Conversely, unspecified nondeterminism must not become an accidental
escape hatch.

For every observable nondeterministic behavior, specify one of:

-   the exact allowed set of outcomes;
-   an ordering/tie-breaking constraint;
-   an invariant all outcomes must satisfy;
-   a statistical/distributional requirement;
-   an explicit statement that the value/order is unspecified and
    therefore outside equivalence.

This applies to random games, recommendations, generated content,
concurrency races whose winner is intentionally unspecified, ordering of
equivalent results, and timing ranges.

## 17. Public Contracts and Data Portability

If a contract is promised to an external consumer, it is product truth
even when expressed using a technical protocol.

Specify and verify as applicable:

-   public APIs and protocols;
-   public events/webhooks;
-   CLI behavior;
-   stable URLs/deep links;
-   import/export formats;
-   extension/plugin contracts;
-   supported compatibility/version promises.

If users can create durable artifacts, verify export completeness,
import validity, round-trip semantics where promised,
ownership/visibility preservation, and absence of silent corruption or
loss.

Internal APIs, internal events, database schemas, and migration
mechanics remain outside `specs/`.

## 18. Supported Environment Matrix

The conformance manifest must define where the equivalence claim
applies.

Examples include:

-   supported browser policy;
-   supported native OS versions;
-   device classes where behavior materially differs;
-   offline and online operation;
-   supported client/server version skew;
-   locales and timezones;
-   accessibility modes.

Every declared environment must run the applicable conformance suite.
Unsupported environments are explicitly outside the product contract
rather than silently untested.

## 19. Cross-Spec Consistency

Multiple DSLs describe one product. Their claims must not contradict
each other.

The verifier should detect contradictions such as:

-   DMN denies an action that Gherkin requires to succeed under
    identical facts;
-   Quint admits a state Alloy declares structurally impossible;
-   a Gherkin journey depends on a capability absent from the manifest;
-   OpenSLO measures an operation not present in the product inventory;
-   the same ubiquitous-language term is given incompatible meanings.

Use stable canonical identifiers across specifications so these checks
can be automated.

## 20. Test-Oracle Independence

For strong conformance, the reference specification implementation and
the product implementation should be independent.

For example, DMN may compute the expected permission result while the
TypeScript/Rust application implements permissions separately. If
production simply executes generated code from the same DMN, comparing
that code back to the DMN tests the generator/integration, not an
independent implementation.

Generated implementations are allowed, but the strength and purpose of
that check must be explicit.

## 21. Validate the Conformance System Itself

A green suite is meaningful only if it detects realistic violations.

Regularly run mutation/fault-seeding experiments against disposable
builds:

-   invert a permission;
-   change a usage-limit boundary;
-   remove server enforcement;
-   break client gating;
-   violate an Alloy invariant;
-   alter a Quint transition;
-   break sync conflict handling;
-   corrupt a public output;
-   introduce latency/error degradation.

The appropriate conformance check must fail. Mutation machinery is test
infrastructure and remains outside `specs/`.

## 22. Release Engineering Gates

Some production-readiness requirements are implementation-specific and
therefore cannot honestly be product semantics, but **must still be
required by the conformance manifest** for the statement "ready for
production."

Examples:

-   dependency/vulnerability policy;
-   secrets/configuration validation;
-   build/release artifact integrity;
-   required backup/restore verification;
-   deployment rollback/recovery verification;
-   platform-specific security hardening;
-   required operational observability;
-   schema/migration safety checks for the chosen implementation.

The manifest defines that these evidence classes are mandatory; their
implementation-specific checks live outside `specs/`.

This preserves the boundary:

> `specs/` defines the product and the evidence required to call an
> implementation production-ready. Implementation-specific tooling
> supplies that evidence.

## 23. Closed-World Closure Rules

The following rules are non-negotiable for the "full stop" equivalence
claim:

1.  Every externally meaningful capability is declared.
2.  Every declared capability has all applicable behavioral, decision,
    state, structural, quality, security, privacy, accessibility, and
    compatibility obligations linked to it.
3.  Every required obligation has a runner and an implementation adapter
    where necessary.
4.  Every supported environment executes the applicable obligations.
5.  Every public contract is inventoried and verified.
6.  Every required negative/forbidden behavior is tested at the real
    enforcement boundary.
7.  Every required result is PASS; `unknown`, `skipped`, `not run`,
    missing, stale, or unsupported evidence is FAIL.
8.  Adding implementation-visible product surface without adding it to
    the manifest is a build failure.
9.  Removing a spec runner or adapter without removing the corresponding
    product obligation is a build failure.
10. The repository validator enforces
    `specs/<bounded-context>/<some-spec>` and rejects nested type-based
    spec directories.
11. The conformance report records the exact spec revision,
    implementation artifact, environment, and evidence used for the
    verdict.

## 24. Final Production-Readiness Definition

A specific release artifact is **equivalent and production-ready** when:

-   the specification is valid and internally consistent;
-   the closed-world inventory is complete;
-   all applicable executable product specs pass against that artifact;
-   all supported environment/platform matrices pass;
-   all permissions and negative cases are enforced at actual product
    boundaries;
-   all state, concurrency, recovery, local-first, and structural
    properties pass;
-   all public contracts and data-portability promises pass;
-   all accessibility, security, privacy, and quality obligations pass;
-   all required implementation-specific release-engineering evidence
    passes;
-   all required live/release-environment checks pass;
-   there are no unknown, skipped, missing, stale, or unverified
    required obligations.

Under those rules:

> **`PRODUCT CONFORMANCE: PASS` is the definition of "this rewrite is
> product-equivalent and ready for production."**

The remaining limitation is logical rather than procedural: no finite
specification can guarantee that humans have imagined every requirement
or every future vulnerability. The closed-world inventory, cross-spec
consistency checks, mutation testing, and mandatory release evidence
exist to make omissions detectable rather than silently green.

## 25. Zero Manual Testing Policy

**Manual testing is prohibited as a source of product-conformance or
production-readiness evidence. A human should never need to manually
test the application.**

Every test, check, audit, inspection, acceptance criterion, release
gate, and production-readiness obligation must be executable
automatically and produce machine-verifiable evidence.

This applies to all layers of the product:

-   user journeys and acceptance behavior;
-   permissions, entitlements, feature gates, and usage limits;
-   client behavior and UI state;
-   server enforcement;
-   Postgres and local SQLite state;
-   local-first synchronization and conflict behavior;
-   accessibility;
-   public contracts and compatibility;
-   import/export and data portability;
-   security and privacy properties;
-   failure, retry, recovery, and durability behavior;
-   performance, reliability, capacity, and SLOs;
-   supported browsers, native platforms, locales, timezones, and other
    declared environments;
-   deployment/release checks and live production conformance.

Humans may author specifications, review product requirements,
investigate failures, and improve automation. Humans must **not** be
required to click through flows, visually inspect screens, run ad hoc
scenarios, compare outputs by eye, or sign off that behavior "looks
correct" in order for a release to pass.

The rule is:

> **If a property matters enough to affect product equivalence or
> production readiness, it must be specified and automatically
> verifiable.**

If a requirement currently appears to require manual testing, that is
treated as an automation gap. The release does not receive credit for
the requirement until an automated verifier exists.

Examples:

-   Instead of manually checking whether a button is hidden, query/drive
    the rendered client and assert the observable UI state
    automatically.
-   Instead of manually testing keyboard navigation, automate focus
    traversal and accessibility assertions.
-   Instead of visually checking layouts, use automated semantic,
    geometry, screenshot/differential, or other machine-verifiable
    checks where layout is product-significant.
-   Instead of manually exercising a permission, generate the case from
    DMN and execute the real operation automatically.
-   Instead of manually inspecting production data, run Alloy-derived
    invariant audits automatically.
-   Instead of manually checking offline synchronization, generate and
    execute Quint-derived traces automatically.
-   Instead of manually smoke-testing production, run production-safe
    Gherkin synthetics automatically.
-   Instead of manually deciding whether latency is acceptable, evaluate
    OpenSLO objectives automatically.

### 25.1 No Human Sign-Off Escape Hatch

The conformance system must not contain statuses such as:

``` text
manual verification required
QA sign-off required
visually verified
tested by hand
works on my machine
approved after exploratory testing
```

for any required production-readiness obligation.

A required obligation may resolve only to machine-evidenced states such
as:

``` text
PASS
FAIL
```

`UNKNOWN`, `SKIPPED`, `NOT RUN`, `UNAUTOMATED`, `MANUAL`, stale
evidence, or missing evidence are all treated as **FAIL** for production
readiness.

### 25.2 Exploratory Work Does Not Count as Testing Evidence

Humans can explore the product while designing features or investigating
defects, but exploratory interaction is not part of the verification
strategy and can never satisfy a release gate.

Any defect discovered manually must result in an automated regression
specification/test before it is considered permanently covered. The
long-term artifact is the executable specification or automated
conformance check, not the human reproduction procedure.

### 25.3 Automation Completeness Is Itself a Gate

The conformance manifest must require automation coverage for every
mandatory obligation.

Conceptually:

``` yaml
production_readiness:
  manual_testing_allowed: false

  require:
    - automated-specification-validity
    - automated-implementation-conformance
    - automated-permission-enforcement
    - automated-system-acceptance
    - automated-accessibility-conformance
    - automated-security-and-privacy-properties
    - automated-release-environment-conformance
    - automated-production-synthetics
    - automated-live-state-audits
    - automated-quality-objectives

  fail_on:
    - manual
    - unknown
    - skipped
    - not-run
    - missing-evidence
    - stale-evidence
    - missing-automation
```

The verifier must fail when a new capability, environment, or
requirement is introduced without an automated way to verify its
applicable obligations.

### 25.4 Consequence for the Equivalence Claim

The final standard is therefore stronger:

> **A rewrite is product-equivalent and production-ready only when the
> complete, closed-world specification suite and every required release
> gate pass automatically, with zero manual testing or human
> verification required.**

A human may decide *what the product should mean*. A human may inspect
why automation failed. But a human is never part of the mechanism that
determines whether the implementation conforms.

The production-readiness verdict must be reproducible from source
specifications, the release artifact, declared environments, and
machine-generated evidence alone.

# Part 2 · Standard

Product acceptance behavior lives in specs: Gherkin features, Quint models,
DMN decision tables, Alloy structures and OpenSLO objectives, plus the
whole-product statechart, its guided journeys and the conformance manifest
that says which contracts a release needs. A spec is the product's contract in the product's language — what
people can do and what they observe — and never says how the product is
built, so it stays true through any rewrite. Everything else (units,
algorithms, wire shapes, storage, performance) is a code test under
[`README.md`](../README.md#correctness-machinery).

This is the one rulebook for specs, step definitions and spec commits. The
skills are the procedure; they cite these rule IDs and never restate them.
Change a rule here, and only here.

| Skill | Role | Use for |
| --- | --- | --- |
| [`spec-upsert`](../.agents/skills/spec-upsert/SKILL.md) | spec writer | discovering and writing new or changed behavior, with a coverage map of the aggregate it touches |
| [`spec-implement`](../.agents/skills/spec-implement/SKILL.md) | implementer | red first, then thin step definitions and model bindings over the harness, then the product change; demotions to code tests |
| [`spec-audit`](../.agents/skills/spec-audit/SKILL.md) | spec auditor | checking specs and steps against this standard: findings with evidence, coverage maps, a verdict, safe mechanical fixes |
| [`port-bdd-to-gherkin`](../.agents/skills/port-bdd-to-gherkin/SKILL.md) | porter | moving legacy `@pkgs/harness-root-shared-ts` tests into features and Quint models with a parity ledger, then deleting them |

Every rule has an ID, a **severity**, and a one-line **why**. Before deleting
or softening a rule, answer its why.

- **Blocking**: the spec is wrong. Audit fails; nobody may wave it through.
- **Warning**: probably wrong. Audit passes, but the report lists it and the
  writer either fixes it or answers it in the `spec:` commit body.

### Layout

```text
specs/README.md                            this rulebook
specs/conformance.yaml                     the manifest: capabilities, contracts, environments, release evidence
specs/ubiquitous-language.yml              the shared kernel: terms every context may use
specs/product.machine.json                 the one connected statechart for the entire product
specs/journeys.yaml                        guided paths through that product statechart
specs/atlas.yaml                           the product map's Atlas title and description
specs/<domain>/ubiquitous-language.yml     the context's ubiquitous language
specs/<domain>/<feature>.feature           Gherkin: concrete scenarios
specs/<domain>/<model>.qnt                 Quint: a feature's state under any sequence of actions
specs/<domain>/events.qnt                  Quint: the facts the context publishes to others
specs/<domain>/<decision>.dmn              DMN: who may do what, and usage limits
specs/<domain>/<structure>.als             Alloy: which stored worlds are legal
specs/<domain>/<objective>.openslo.yaml    OpenSLO: how well, measured over time
```

One directory per domain, no subdirectories, every feature tagged with its
directory's `@domain`. The three product-map files above are the only
whole-product source files besides the conformance manifest and shared
kernel. Nothing else lives in `specs/`: a grammar (`.ebnf`) or
a public format (`.schema.json`) is refused until a runner checks it, since an
unrun spec is a false green. The package whose steps run a domain lists it in its
`package.json` `specDomains` (each domain in exactly one package) and adds
`$TURBO_ROOT$/specs/<domain>/**` to its `test:spec` inputs. Step definitions
live in that package's `tests/steps/`, model bindings in `tests/quint/`,
decision, structure and objective bindings in `tests/dmn/`, `tests/alloy/`
and `tests/openslo/` (one `<stem>.binding.ts` per spec file, each naming it
with `spec: '<stem>'`; that folder's `index.ts` loads every
`*.binding.ts` and `*.steps.ts`, so a new file needs no registration), and
the steps are listed in generated, gitignored `STEPS_CATALOG.md` files
([index](../docs/STEPS_CATALOG.md); `bun install` writes them,
`bun run spec:catalog` refreshes them).

`specs/` contains no TypeScript or JavaScript.
Step definitions, model bindings, adapters and runners live
outside this tree and point to the canonical specs.

Canonical product Gherkin and Quint specifications exist only in this tree. A
`.feature` never lives beside application code. A `.qnt` may remain under a
package's `tests/` only when it is not a product specification:
`// @spec-meta` marks a fixture that tests verification or implementation
machinery. Product interpretations and their shared model helpers live in
`specs/system/`, alongside the other product specifications.
`// @spec-interpretation` identifies a composition of the domain rules and is
followed by `// Sources: specs/<domain>[, specs/<domain>...]`. The sources remain
the authority; a composition may not silently become another product definition.
Its `@spec-meta` modules supply finite bounds or diagnostic checks.

A package registers these composed models through `quintCampaignDomains`.
Its `test` and `test:contract` Verify leaves run the campaign and hash both
the campaign directory and every declared source domain. Campaigns check all
modules through their import roots, exercise safety and temporal obligations,
and test fault sensitivity; they do not require aggregate replay bindings or
redeclare the source domains' vocabulary. The location gate permits marked
campaign modules only in a registered, singly owned campaign domain, validates
every source domain, and continues to refuse product interpretations outside
`specs/`. Framework fixtures remain in their package's `tests/`.

### Bounded contexts

Every `specs/<domain>/` is a bounded context with its own ubiquitous
language; every word of its specs — feature text, story, Quint names — comes
from that language. "Aggregate", "command" and "event" are modeling ideas
here, never classes or queues.

| DDD concept | Where it lives |
| --- | --- |
| Bounded context | `specs/<domain>/` |
| Ubiquitous language | `specs/<domain>/ubiquitous-language.yml` |
| Shared kernel | `specs/ubiquitous-language.yml` (person, device, the app, connection, the team) |
| Aggregate and its invariants | `specs/<domain>/<aggregate>.qnt`: its actions are the commands, its `inv*` vals the invariants |
| Commands and domain events | Gherkin `When` (a command) and `Then` (what happened); past-tense Quint event types |
| Published language | the terms a glossary marks `published: true`, plus `specs/<domain>/events.qnt` (`module events`, types and values only) |
| Context integration | Gherkin in the consuming context, in borrowed terms; its Quint imports only `../<upstream>/events` |

#### The glossary

```yaml
# specs/spaces/ubiquitous-language.yml
context: Spaces
purpose: >-
  Live places people host and join to play together.
terms:
  - term: space
    definition: >-
      A live place one person hosts and others join. It is open until its
      host ends it or leaves.
    avoid: [room, lobby room, session]  # synonyms people reach for
    model: [Place, place]                # the Quint names this term is
    published: true                      # other contexts may borrow it
  - term: host
    definition: The person whose space it is.
    forms: [hosts, hosting, hosted]      # inflections (plurals are implied)
    model: [host, hostOf]
  - term: Plus member
    from: billing                        # borrowed: billing defines it
    model: [unlimited]                   # this context's own Quint name for it
  - term: checkmate
    source: FIDE Laws of Chess, Article 5.1.1
```

- A term has a `definition`, an outside `source`, or `from: <domain>`, which
  borrows the lender's definition and `avoid`. A borrowed term's `model` names
  are this context's own: the lender's Quint names never cross the boundary.
- A kernel term is never redefined, but `from: kernel` gives it this
  context's own `model` names.
- Definitions say what the product does, never how it is built.
- Only `published: true` terms may be borrowed, and a context must borrow a
  published term to use it. Its other terms bind no other context.
- The kernel stays small: a term belongs there only when every context means
  exactly the same thing by it.

#### Context map

| Context | `specs/` | Owns | Kind |
| --- | --- | --- | --- |
| Identity | `profile` | who a person is to the product: guests, accounts, signing in and out, sign-in methods, usernames, avatars, profiles, the devices on an account, account deletion, personal-data exports and retention | supporting |
| Billing | `billing` | Plus: memberships, trials, renewals, paid access, grace, refunds, the billing portal | generic (the provider does the paying) |
| Spaces | `spaces` | live spaces: hosting, joining, leaving, ending, links, the lobby, presence, the hosting limit | core |
| Friends | `friends` | friendships: friend requests, the inbox, blocking, people search, the friends list | supporting |
| Chess | `chess` | chess puzzles played in a space and private multiplayer chess: chess's puzzle catalogue and themes, chess's own rules in puzzles and the Puzzle Assistant, multiplayer boards, turns and results | core |
| Games | `games` | what every game in a space offers alike: the game's choices, custom games with people and bots, private setups, secret choices, stand-ins for people away from games with more than two sides, shared victories, turns, finding an opponent, matched games (aborting, resigning, draw offers and rematches), puzzles for every game offering them (playing them as a feed, solving, hints, retries, showing the solution, resuming an attempt, the puzzle clock, reviewing a puzzle's line, the feed and its settings, choosing the next puzzle, puzzle ratings, stats and game logs, refused puzzle actions, the daily puzzle limit, guests' puzzles, erasing a deleted account's puzzle progress, playing offline, results across devices, watching, puzzle links, sounds, the keyboard and listening, winning a puzzle another way, and other play leaving puzzles alone), history, review and statistics | core |
| Connect Four | `connect-four` | Connect Four's own board, drops, winning alignments, draws and bots | supporting |
| Numberlink | `numberlink` | Numberlink's rectangular board, matching endpoints, paths, coverage and completion | supporting |
| Sokoban | `sokoban` | Sokoban's rectangular board of walls, floor, goals and outside squares, the worker, crates, moves, pushes and completion, building a board, the proof a board needs before publication, and the starter pack | supporting |
| Puzzles | `puzzles` | author-created puzzle and pack drafts, validation, playtests, stable published editions, personal attempts and pack progression for any game offering puzzle content | core |
| Battleship | `battleship` | Battleship's own boards, fleets, placing ships, shots, hits, misses, sinkings, victory and bots | supporting |
| Quoridor | `quoridor` | Classic Quoridor and Four-Player King of the Hill: the board, pawns, movement, jumps, walls, paths and goals | supporting |
| Word Tiles | `word-tiles` | Word Tiles for two, three and four: the board, bonus squares, tiles and blanks, racks and the bag, placing words from the word list, scores, passing, exchanging, endings, private racks and one-move challenges | supporting |
| Hearts | `hearts` | Hearts's own cards, deals, hands, passing, tricks, hearts being broken, penalty points, scores and winners | supporting |
| Pong | `pong` | Pong's court, paddles, ball, points, score, serves and victory | supporting |
| Light Cycles | `light-cycles` | Light Cycles Duel, Trio and Quad: the arena, riders, trails, steering, crashes, rounds, round wins, victory, riders whose people are away, bots and practice | supporting |
| Auth | `auth` | how outside accounts at Google and Apple, and sign-in links sent to an email address, get people into accounts: matching and confirming accounts, connecting and removing sign-in methods, asking for and opening a sign-in link, stolen sign-ins, how long a sign-in lasts, Google or Apple having trouble | generic (Google, Apple and the mailbox say who is signing in) |
| Room | `room` | the room framework's example game room: a tally friends keep together, owning the room and turning someone away, a timed match, who is present | supporting |
| Matchmaking | `matchmaking` | waiting for a match, one wait at a time, rating ranges, pairing people up, being matched, stopping a wait | supporting |
| Sync engine | `sync-engine` | notes people write and share across devices and shared spaces, even offline | supporting |
| Database indexing | `db-indexes` | automatic index ownership, planning, retirement, interrupted maintenance and recovery | technical maintenance |
| App | `runtime` | the app itself: opening it, tabs, Settings, addresses, updates, reconnecting, and the promises a live environment keeps about reaching and answering people | generic |
| Developer tools | `developer-tools` | the team's testing tool, test worlds, checkpoints, data notebooks, test runs, test reports, recorded moments, and release checks | supporting |
| Product feedback | `feedback` | bugs, feature requests, gaps and polish, with recordings and diagnostics that help the team reproduce trouble | supporting |
| Synthetic Population | `synthetic-population` | persistent automated opponents, their activities, recovery, disclosure and authorized observation and control | supporting |
| Journeys | `journeys` | the critical journeys across every context | — |

Relationships — upstream contexts publish; downstream contexts borrow their
terms and import only their `events.qnt`:

```text
Identity ──► Billing, Spaces, Friends, Chess, App, Journeys, Auth (account, sign in, sign out, sign-in method, Google, Apple)
Identity ──► Billing, Spaces, Friends, Chess, App (account deletion, personal data, retention, recently proven account)
Identity ──► Friends (no longer allowed, stand-in name, stop allowing), Spaces (username, rename themselves, stand-in name, stop allowing, start allowing), Chess (username, rename themselves, stand-in name, stop allowing)
Identity ──► Games (guest, sign in, sign out, account, Google, recently proven account, username, rename themselves, account deletion, personal data, personal-data export)
Billing  ──► Spaces (the hosting limit), Chess (the daily puzzle limit), Games (free account, paid access, Plus member), Journeys
Spaces   ──► Friends (a friend's open space), Chess (a space plays a puzzle), Games (a space plays a game, create a space, leave, end a space), Connect Four (a space plays Connect Four), Battleship (a space plays Battleship), App, Journeys
Spaces   ──► Quoridor (a space plays Quoridor)
Spaces   ──► Hearts (a space plays Hearts)
Friends  ──► Spaces (a friend's space in the lobby), Chess (friends watch, turn notices and result notices in the inbox), Games (block someone), App (people search), Journeys
App      ──► Identity (trail, run into trouble), Games (keyboard, listen to the app, sounds), Journeys (tabs)
App      ──► Developer tools (address, version of the app, keyboard, control, place in the app)
App      ──► Battleship (keyboard, control, listen to the app)
Developer tools ──► App (the testing tool)
Friends, Spaces ──► Developer tools (friend, space)
Matchmaking ──► Chess (a complete matchmaking match), Games (pair people up), Hearts (pair people up)
Chess    ──► Journeys (a game of chess, a puzzle, multiplayer chess, a Custom Game)
Battleship ──► Journeys (Battleship)
Quoridor ──► Journeys (Quoridor, Classic Quoridor, Four-Player King of the Hill)
Games    ──► Connect Four (game), Battleship (game, custom game)
Games    ──► Quoridor (game, custom game, ready, start)
Games    ──► Word Tiles (game, custom game, bot)
Puzzles  ──► Word Tiles (puzzle, publish)
Games    ──► Hearts (game, custom game, custom game readiness, start a custom game, bot, stand-in, take back their side, secret choice, rematch, shared victory, the game's choices)
Games    ──► Journeys (bot)
App      ──► Quoridor (keyboard, control)
Identity ──► Sokoban (guest)
App      ──► Puzzles (version of the app)
Puzzles  ──► Sokoban (puzzle, author, draft, playtest, publish, edition, pack, attempt, resume, pack progress, rules change)
Sokoban  ──► Journeys (Sokoban, starter pack)

App      ──► Hearts (keyboard, control, listen to the app)
Games    ──► Pong (game, custom game, under way, bot, move list)
Matchmaking ──► Pong (pair people up)
Spaces   ──► Pong (space, join)
Games    ──► Journeys (bot, rematch)
Pong     ──► Journeys (Pong, paddle, score, target score)
Games    ──► Synthetic Population (game)
Pong     ──► Synthetic Population (Pong)
Games    ──► Light Cycles (game, custom game, custom game readiness, bot, start a custom game, under way)
Matchmaking ──► Light Cycles (pair people up)
Spaces   ──► Light Cycles (space, join)
Identity ──► Light Cycles (guest, sign in)
App      ──► Light Cycles (keyboard)
Battleship ──► Synthetic Population (Battleship)
Room, Sync engine: stand alone; Matchmaking publishes complete matches to Chess (Sync engine's "shared space" is not a Spaces space)
Database indexing: stands alone; publishes no product terms or events
```

Published language:

| Context | Published terms | `events.qnt` |
| --- | --- | --- |
| Identity (`profile`) | guest, account, sign in, sign out, sign-in method, username, avatar, profile, rename themselves, Google, Apple, personal data, account deletion, personal-data export, retention, recently proven account, no longer allowed, stand-in name, stop allowing, start allowing | `IdentityEvent`: `SignedIn`, `SignedOut`, `UsernameChanged`, `AccountDeletionConfirmed` |
| Billing (`billing`) | Plus, Plus member, free account, paid access, billing plans, payment record | `BillingEvent`: `PaidAccessStarted`, `PaidAccessEnded` |
| Spaces (`spaces`) | space, host, join, leave, create a space, end a space, open space, return to a space, lobby, space link, hosting limit, idle | `SpaceEvent`: `SpaceOpened`, `PersonJoined`, `PersonLeft`, `SpaceEnded` |
| Friends (`friends`) | friend, friends list, people search, block someone, inbox | `FriendshipEvent`: `BecameFriends`, `FriendshipEnded` |
| Chess (`chess`) | game, chess, board, puzzle, solve, multiplayer chess, multiplayer result, Custom Game, Custom Game move list | — |
| Games (`games`) | game, the game's choices, custom game, bot, custom game readiness, start a custom game, under way, rematch, secret choice, make a secret choice, stand-in, take back their side, shared victory, move list | — |
| Connect Four (`connect-four`) | Connect Four | — |
| Battleship (`battleship`) | Battleship | — |
| Quoridor (`quoridor`) | Quoridor, Classic Quoridor, Four-Player King of the Hill | — |
| Sokoban (`sokoban`) | Sokoban, starter pack | — |
| Word Tiles (`word-tiles`) | Word Tiles, Word Tiles for three, Word Tiles for four | — |
| Hearts (`hearts`) | Hearts | — |
| Pong (`pong`) | Pong, paddle, score, target score | — |
| Light Cycles (`light-cycles`) | Light Cycles, Light Cycles Duel, Light Cycles Trio, Light Cycles Quad | — |
| App (`runtime`) | Settings, tabs, address, version of the app, trail, run into trouble, keyboard, control, place in the app | — |
| Developer tools (`developer-tools`) | the testing tool | — |
| Matchmaking (`matchmaking`) | matchmaking match, pair people up | `MatchmakingEvent`: `MatchFormed` |
| Auth (`auth`) | email address, mailbox, sign-in link, ask for a sign-in link | — |
| Room, Sync engine, Journeys | — | — |

- Publish product concepts, not common words: "open space", never "open".
- The same word may mean different things in different contexts ("notice",
  "member", "move"); each defines its own.
- Events are past-tense facts the upstream already decided
  (`PaidAccessEnded`), never requests.

### What belongs in a spec

All executable specifications live in `specs/`, each in its own bounded
context. Technical maintenance contracts belong here too: `db-indexes`
defines the database operator's observable contract in its own language,
separate from app behavior. Its glossary owns that language; it neither
borrows nor publishes app concepts. Package tests retain pure computations
and low-level adapter contracts, not a second location for specifications.
The glossary declares `profile: maintenance`; app is the default. Only
technical words explicitly declared by a maintenance glossary are admitted
by the wording gate, and its model headers must use the matching profile.

A scenario earns its place when a person, or the team running the product,
could observe the outcome from outside (A0). Every behavior test is a spec: a
test that acts as a person would and checks what they see is a scenario or a
Quint model, never a `*.test.ts`.

| The check is about… | Home |
| --- | --- |
| What a person can do and see: flows, rules, permissions, what persists, offline behavior, what other people see and when | **Gherkin scenario** |
| A promise the team observes about a live environment | **A `@synthetic` feature in the context that owns it** |
| A flow that must never break anywhere people use the app | **Gherkin in `specs/journeys/`** |
| How a feature's observable state evolves under any sequence of actions | **Quint model** |
| A pure computation: formula, parser, validation table, ordering | **property test** (`assertProperty`) |
| Stateful internals: sync, convergence, exactly-once, idempotence, fault recovery | **model-based property test** |
| Storage rows, wire formats, request shapes, which component calls which | **contract test** through the package's reads |
| One literal case that must never change (a bug's input, a decided value) | **example regression test**, or a `@regression:<id>` scenario when the bug was observable |
| Who may do what, feature gates, usage limits, what a denial asks for | **DMN decision table** |
| Which stored worlds are legal: ownership, uniqueness, cardinality, no cycles | **Alloy structure** |
| How well, over time: success rates, latency people notice | **OpenSLO objective** |
| Timing, load, bundle size, budgets | **gate script** |

When one idea has both a behavior and exhaustive cases, keep one scenario for
the rule people see and put the case table in a property test.

### Quint models

A feature pins examples; a [Quint](https://quint-lang.org/) model states the
rules — what each action does to what a person can observe, from any state it
is allowed in. Quint draws the walks from the model, and the product must
agree with it after every step; there are no product random walks outside a
model.

A model is an aggregate: a module named after its file in snake_case
(`space-hosting.qnt` → `module space_hosting`) with

- a header comment in plain product language: who is in it, what they can
  do, what they see;
- state variables a person can observe (a derived observable is a variable
  every action updates through one helper);
- `action init` and `action step`, the step choosing among the actions, with
  `nondet` arguments named for the action's arguments;
- invariants as `val inv<Name>`.

The product is offline-first, so every app aggregate (not a context's `events.qnt`)
says in its header what a person sees with no connection, starts connected,
lets one device lose that connection and get it back, and has an invariant
for what stays true while the connection is gone. A variable a person can
observe has to be named by some invariant. An invariant that is literally
`true` or `false`, or that names no state, proves nothing.

A technical maintenance model declares `// @model-profile: maintenance`
in its header. It models operator actions and database states rather than
app devices. All structural checks, nontrivial invariants, initialization,
action reachability, trace replay and bounded verification still apply;
device connectivity checks apply to the default offline-first app profile.
A local surface whose behavior has no connection dependency declares
`// @model-profile: local` and describes that independence in its header.
It retains every structural and conformance obligation without inventing
connection-dependent commands. Unknown or duplicate profiles fail the shape check.

Quint reads `x' = a and b` as `(x' = a) and b`: bracket an assignment's
right-hand side. An `init` that can never hold draws empty traces, which the
runner refuses. `next` is a builtin, so no action may be called that.

How a model runs in the package's `test:spec`:

1. The model's shape is checked (`@pkgs/quint/shape`): the rules above, before
   any trace is drawn. A failure names the line. The same check runs in
   `bun run spec:verify` and before Apalache, which is not started on a model
   that fails it.
2. Quint draws traces (`quint run --mbt`, bundled, no network) from the
   property seed `FC_SEED` (default `424242`), so the verdict is a function of
   the code; `PBT_RANDOM=1` explores other seeds. A model that breaks its own
   invariant fails here. A model with no invariant fails here too.
3. Each trace is one test: a fresh harness, every step's action through the
   binding (`tests/quint/<model>.binding.ts`: one entry per action, `init`
   included, plus `observe`, which reads the model's variables back without
   acting), then the product's state must equal the model's, re-read on
   virtual time for up to 15 s. Every action is an `s.apply`, so the system's
   standing properties hold after every step too.
4. One more test fails when no trace takes some bound action.
5. On the first slice only, Quint type checks the model.

Separately, each package's models check (`verify:models`) has Apalache
(pinned in `mise.toml`, never downloaded) model-check every invariant over
every interleaving up to the binding's `verifySteps` steps (default 4). The
verdict depends on the model's text alone, so it runs apart from the suite and
again only when that package's models or bindings change. A model with no
invariant proves nothing and fails.

A failure prints the step, the differing variables, the harness calls and the
whole trace; drawn traces are in
`<package>/.cache/harness-report/<all|part-k>/quint/<model>/`.

### DMN decisions

A decision table answers "may this person do this?" from product facts, the
same question the product's permission layer answers, computed independently
(strategy §§ 5, 20). Each table:

- declares every input's domain (`inputValues`: listed values, or a whole
  number range), so the gate can prove the table **complete** (every
  combination answered) and **consistent** (no combination answered twice,
  hit policy `UNIQUE`);
- names capabilities exactly as `conformance.yaml` lists them, and states a
  refusal's reason in the context's words;
- puts a numeric limit's threshold in the rules, so the generated cases hit
  0, 1, L-1, L, L+1 and the domain's ends.

The binding (`tests/dmn/<stem>.binding.ts`) gives one **layer** per boundary
the product enforces the decision at: the application's decision, the
server's refusal of the real operation (a denied operation changes nothing),
and the client's gate. Every generated case runs through every layer that
governs it and must give the table's answer; a layer that governs no case
fails.

### Alloy structures

A structure states what every stored snapshot of the product must look like,
with no time in it (time is Quint's): sigs, fields with multiplicities, named
`fact`s in product words, `assert` + `check` for their consequences, and a
`run … expect 1` showing a legal world exists. No `var`, no numbers, no
strings. Every sig and field is a `model` name of a glossary term.

Alloy 6 (pinned in `mise.toml`) checks every command in the file. The binding
(`tests/alloy/<stem>.binding.ts`) then gives snapshot adapters (the server's
database, a device's database), each turning stored rows into atoms and
relations; Alloy itself decides whether each snapshot is a legal world. An
adapter with no snapshots fails.

### OpenSLO objectives

An objective file holds `SLI` and `SLO` documents (`openslo/v1`). An
indicator's `metricSource` is `{ type: product, spec: { measures: <what, in
product words> } }`, never a vendor query. Windows are rolling. Budgeting is
by occurrences, except for the team's checks from outside, which are judged
by time slices (`Timeslices`: one run of a check is a moment, and a bad hour
counts once). A `# live` objective is judged over `7d` and names how much it
matters in `metadata.labels` as `tier`: `"0"` for playing
(reaching the app, signing in, spaces, moves, saving, live updates), `"1"`
for what matters without stopping play, `"2"` for what supports it. Every
file passes the OpenSLO reference validator (`oslo validate`): a display
name is at most 63 characters and a label key has no `/`. The binding
(`tests/openslo/<stem>.binding.ts`) measures each indicator: in `bun check`
on the harness, and for live domains in `health:objectives`, which the
hourly Health workflow runs after its checks. An objective whose first
non-empty line is `# live` is measured only against a deployment. The
harness does not run it and does not require its binding; `health
--objectives` does. The marker is what makes it live, not `liveDomains`.
A rolling window remembers past failures, so live objectives never gate a
deploy (a fix must be able to ship); they gate the production-readiness
verdict. No samples in the window is a failure, never a pass.

### The conformance manifest

`specs/conformance.yaml` closes the world (strategy §§ 11, 12, 18, 22, 23):

| Section | Holds | The gate requires |
| --- | --- | --- |
| `product.contexts` | every `specs/<domain>/` | exactly the directories present |
| `product.capabilities` | everything a person may or may not do, with the decision that answers it | each named by exactly one decision table, every table's capabilities listed; the permission layer's catalog maps onto exactly these |
| `product.public contracts` | promises to people outside the product | each proven by bound specs |
| `conformance` | each kind of spec, `required` | at least one spec of the kind, every one bound |
| `environments` | where the product must behave as specified | each exercised by bound specs or a gate |
| `production readiness` | the evidence classes a release needs; `fail on` | each with an automated source; `manual testing allowed: false`; `fail on` lists every non-pass state |
| `release gates` | evidence about how the product is built | each an existing, gating check |

What proves each entry is binding-side knowledge (`libs/tools-harness-ts/conformance/`),
never named here (D1). `bun run conformance` prints the verdict per layer
from the evidence the runners recorded (`.cache/harness-report/*/evidence/`):
the spec text's hash, the package, and every obligation's `pass` or `fail`.
There is no third status: missing or stale evidence is a failure.

### Live domains

`specs/journeys/` (critical journeys) describe the deployed product and also
run on the harness. `@libs/runtime` runs the journeys against the simulated
app in `bun check`. A `@synthetic` feature is a standing promise about a live
environment, written in the context that owns it
([`README.md`](../README.md#correctness-machinery)). The harness does not run it.
`@apps/product-ts` runs the journeys plus every `@synthetic` feature in its
`health` task, and only the `@synthetic` features in its `synthetic` task
([`README.md`](../README.md#correctness-machinery)). Which resource keeps
a promise is the step definitions' business. A domain is run by at most one
package through `specDomains` and at most one through `liveDomains`.
`liveDomains` stays `journeys`: a synthetic feature is not a second owner of
its context. Which environment can run a live scenario (production only, the
relay, observability on) is binding-side knowledge: `HOST_LIMITS` in
`apps/product-ts/scripts/health.ts`, keyed by feature and scenario name. Specs
carry no host tags (B15, D1).

### Terms this standard uses

| Term | Here it means |
| --- | --- |
| Bounded context | One `specs/<domain>/` directory |
| Language of a context | The terms (and their `forms`) in `specs/<domain>/ubiquitous-language.yml`, its borrowed terms (`from: <domain>`), and the shared kernel `specs/ubiquitous-language.yml` |
| Aggregate | One Quint model, `specs/<domain>/<model>.qnt` |
| Command | An `action` of a model other than `init`, `step` and `_`-helpers that a person performs ("block", "subscribe") |
| World event | An `action` that happens to people rather than being done by them: a fault, time passing, a provider's behavior ("the connection drops", "a day passes") |
| Status | An observed model variable with a small set of named values a person can see: a sum type, a `str` whose values the doc comment lists, or a `bool` |
| Model-only | A world event or invariant no person can observe on its own (fault injection, bookkeeping such as bounds). The model's traces cover it; it needs no scenario, and B17 forbids one |
| Invariant | A model's `val inv<Name>` |
| Domain event | A variant of a type in `specs/<domain>/events.qnt` |
| Policy | A reaction in a downstream context to an upstream domain event, per the [context map](#context-map)'s relationships |
| Cast | The named people step definitions know: Alice, Bob, Carol, Dave, Eve (and White and Black at a chess board) |
| Refusal | A `Then` saying the `When`'s command did not take effect or is not allowed. The closed list of markers: "refused", "cannot", "can't", "no longer can", "is not offered", "is told", "fails"/"failed", "not allowed", "still" (the state is unchanged). Anything else is not a refusal — "stops showing", "does not show", "is signed out" are usually the command's effect |

### A. Language — the ubiquitous language is law

**A0 · A business person understands every line of an app spec.** *Blocking.
No glossary override for app concepts.* Technical maintenance contexts use
the operator's language under [What belongs in a spec](#what-belongs-in-a-spec).
Hand the feature, the context's glossary and the model's header comment to a
product owner who has never seen the code or studied software. They must
understand every line, with nothing to look up, and recognise every scenario
as something a person does with the product or sees in it. The test is about
concepts, not only words: a technical idea in plain words still fails.
Fails: servers, rooms or services crashing, restarting or being down; a
network that stalls; messages that are garbled, resent, delivered twice or
out of order; retries, queues, caches, indexes, lookups, "live updates",
"catching up", "the app fetches"; timings a person cannot notice (anything
under a second, anything in ms); versions, schemas, protocols, sessions,
keys, providers' error cases. Passes: what a person does and sees — "Alice's
phone is offline", "Alice closes the app and opens it again", "Bob sees
Alice's note within a few seconds", "Alice is told signing in with Google
failed".
When the rule behind a technical case is something people see, state that
rule and let the Quint model or a code test carry the technical cases (a
fault an operator injects is a `_`-prefixed model helper, never glossary
vocabulary). A technical maintenance context keeps its specifications in its
own folder under `specs/`, with operator vocabulary isolated from app specs.
A glossary term is held to A0 too; defining a technical word does not make
it plain.
*Why: the spec is the one description of the product the business can read
and sign off; a line they cannot read is a line nobody outside engineering
agreed to.*

**A1 · Every domain word resolves to the language.** *Blocking.*
Every domain noun, verb, state and event in a feature's prose (title,
description, `Rule:` lines, scenario titles, steps) is a term of the
context's language or one of that term's `forms`, spelled and cased exactly.
A regular plural (`+s`/`+es`) is implied; any other inflection must be listed
in `forms`. A borrowed term carries its lender's `forms`. A term's
`someone`/`something` slot matches any cast name or term in that place, and a
term's words may be split by its object ("Alice looks up Bob" is *look
someone up*; "Bob accepts Alice's friend request" is *accept a friend
request*). A short name a definition mentions ("Search" for short) is not a
form until `forms` lists it.
A word is a **domain word** when any glossary in `specs/` defines it as a
term or form, or when it names a thing the product keeps or a status it
shows. Otherwise it is plain English and needs no entry: cast names, numbers
and durations, quoted example values, and words like sees, is shown, can,
still, again, within, stops. A domain word defined only in another context
is A4, not plain English.
*Why: a word nobody defined is read a different way by every agent and every
port.*

**A2 · No synonyms.** *Blocking.* A word a glossary lists under `avoid`, or
any other stand-in for an existing term ("unfriend" for *remove a friend*,
"room" for *space*), is never used.
`avoid` lists are per context: a word one context avoids may be another
context's own term. When a context defines its own word for a kernel concept
("cut off" for *offline*), it lists the kernel word under `avoid`.
*Why: two words for one thing reads as two things.*

**A3 · New vocabulary needs a person's yes.** *Blocking.*
A term that is not in the language stops the work. The writer either uses an
existing term, or proposes the addition — term, definition in product
words, `forms`, `avoid`, and `model` if a Quint name needs it — and waits for
the person to confirm it before writing any spec that uses it. It is then
added in the same `spec:` commit.
*Why: the language grows by decision, not by accident.*

**A4 · Foreign terms only through the published language.** *Blocking.*
A term another context owns appears only if that context marks it
`published: true` and this context's glossary borrows it (`from: <domain>`).
Quint models import only `./events` or `../<upstream>/events`.
*Why: a context that reaches into another's private words couples to its
insides.*

Cross-context specs live in the **downstream (consuming) context**, never in
the upstream one and never in a shared folder. You tell them apart from
in-context specs by what they use: each borrowed term they use is listed
with `from:` in their context's glossary, and each policy they illustrate
appears in the coverage map (C5) under its upstream event. `specs/journeys/`
is the one context whose whole job is crossing contexts; it borrows like any
other.

**A5 · No technical vocabulary in app specs.** *Blocking.*
No storage (database, table, row, column, record, cache, schema, migration),
transport (API, endpoint, route, request/response, HTTP, status code, JSON,
payload, header, cookie, token, WebSocket, URL, redirect, callback, OAuth),
identifiers (ID, UUID, key, hash), code (class, method, function, module,
file path, framework or vendor names), architecture (server, client,
backend, service, worker, queue, harness), or UI mechanics (screen, page, view,
widget, button, link text, field, form, modal, dialog, click, tap, press,
swipe, scroll, type into, navigate), or testing (harness, sim, mock, fake,
stub, fixture, seed). The only exception: a glossary term or form that names
something people see in the product ("Settings", "tabs", "billing portal",
"space link"), and it still passes A0.
*Why: feature text must still be true, word for word, after any rewrite of
the implementation.*

**A6 · A named person or glossary role acts.** *Blocking.*
Every actor is someone from the cast, a glossary role ("a guest", "the
host", "the team"), or a glossary term for something that happens to people
("Google", "the connection"). Never "I", "the user", "the system", "the
app does" as a hidden narrator, unless the glossary defines that term.
*Why: a rule without a "who" can't be checked against the person it serves.*

### B. Gherkin structure

**B1 · Feature title is a capability.** *Blocking if it breaks A1/A5;
otherwise a warning.* A short noun or verb phrase in the context's language
("Block and unblock", "The daily rated puzzle allowance"). Never "Tests for
…", a file name, or a component.
*Why: the titles are the product's table of contents.*

**B2 · Feature description is one job story.** *Blocking.*
House style: `When <situation>, <who> wants <motivation>, so <outcome>.` —
one sentence, optionally one or two more that say why it matters. The rules
themselves go in `Rule:` lines, not in the description.
*Why: one fixed shape makes the why impossible to skip and easy to check;
rules buried in prose never get a scenario.*

`@synthetic` features state standing promises checked now, and
`specs/journeys/` states whole journeys. Both are exempt from B4, B5 and C;
a `@synthetic` feature is also exempt from B17 where the team is the
observer the policy names.

**B3 · Every scenario sits under a `Rule:`.** *Blocking.*
Each `Rule:` line states one business rule in the context's language
(EARS phrasing is welcome: "While a friend request waits, the asker can
cancel it"). A feature with one rule still writes it.
*Why: the rule is what a scenario illustrates, and the coverage map (C) keys
on it.*

**B4 · Every rule shows both sides.** *Blocking.*
A `Rule:` has at least one scenario where the rule lets something happen
and one where it stops something (a refusal). When a rule cannot be broken
by anything a person does, the Rule's description says so on its first
line: `No counter-example: <why>`.
*Why: a rule shown only working never proves it stops anything.*

**B5 · Exactly one `When`.** *Blocking.*
Each scenario has one `When` step and no `And`/`But` after it before the
first `Then`. No scenario acts after a `Then`. Only `specs/journeys/` is
exempt: there the chain is the behavior.
*Why: one event per scenario means it fails for exactly one reason.*

**B6 · `Given` is a fact, not an action.** *Blocking.*
Present, perfect or past declarative: "Alice and Bob are friends", "Alice
has blocked Bob", "Alice's app became outdated while offline". Something
arranged to happen later is also stated as a present fact ("the next live
update to Bob is garbled"), never with "will". Never a present-tense action
("Alice opens the inbox", "the team declares a lookup").
*Why: context describes the world; how it got that way is the step
definition's business.*

**B7 · `When` is one command or event, in the present.** *Blocking.*
A person's intent ("Alice blocks Bob", "Alice tries to sign in with
Google") or something that happens to them ("Alice's billing period ends",
"Alice's app comes back online"). One: no "and" joining two acts ("starts
renaming and leaves without saving"), no repetition ("solves 10 puzzles a
day for 3 days" — that history is a `Given`), and not a mere look ("views
the billing plans") when the behavior happened in the `Given`s.
*Why: the When is the command under test; everything else is setup or
outcome.*

**B8 · `Then` is an outcome someone can observe.** *Blocking.*
What a person, or the team from outside, can now see, have, or do; or a
refusal. A refusal under a Rule that illustrates an invariant names the
reason the person is told, in the language ("is told the daily puzzle limit
is reached"); when the rule is that they are *not* told (a blocked person),
it shows what they see instead. Never stored state, internal queues or
counts, "the database contains", transport state ("the app is still
connected"), or exact app copy. A display value the glossary itself defines
("1500?") is not copy.
*Why: an outcome nobody can observe isn't product behavior — it is a code
test.*

**B9 · Declarative, not procedural.** *Blocking.*
Every step states intent or a fact a product owner would recognize. Quoted
text is only data a person supplies or names (a note title, a username,
search text) — never the app's own wording. A step that could only be
written by knowing the implementation is wrong.
*Why: procedure and copy change with every redesign; intent does not.*

**B10 · Scenario titles state the outcome.** *Blocking.*
A complete sentence, present tense, naming what happens under the rule
("A blocked person cannot find the blocker"), unique in its context. Never
"Test …", "Case 2", "works", or a procedure ("Alice clicks then …").
*Why: the titles alone should read as the spec's index.*

**B11 · Background only for context every scenario needs.** *Blocking.*
Only `Given` steps, at most four, each used by every scenario under it
(feature- or rule-level). If one scenario does not need it, move the
Background into the `Rule:`s that do, or split the feature. The same
opening `Given` in every scenario of a rule with two or more scenarios, or of
the whole feature, belongs in a Background (warning).
*Why: hidden context that some scenarios ignore misleads the reader about
what the rule depends on.*

**B12 · Outlines vary a business dimension.** *Blocking.*
A `Scenario Outline` only when one column is a business dimension that
changes the outcome (a plan, a status, a rating band). An ordered dimension
includes its boundary on both sides (19 and 20 puzzles, not 5 and 12). At
most six rows; more is a property test. Every column must be a business
dimension: a column that varies a gesture, an error code, or a technical
failure mode fails the outline even beside a business column.
*Why: a big or technical table is a code test disguised as a spec.*

**B13 · Plausible domain data.** *Blocking.*
Names from the cast, amounts, dates and text a real person would use. Never
foo, bar, baz, test, lorem, a run of one letter (`xxxx`), `user1`, `123`,
or seed values. A number is fine when the rule turns on it (100% accuracy,
20 puzzles).
*Why: placeholder data hides which values matter to the rule.*

**B14 · Reuse phrasings; never coin a second one.** *Blocking.*
Before writing a new step, search the context's features and the step
catalogs ([index](../docs/STEPS_CATALOG.md)). If a phrasing already means it, use it
verbatim. A new phrasing with the meaning of an existing one — including
every near-duplicate `spec:verify --strict-duplicates` reports — is an error.
Two definitions with the same body have one meaning. "X" and "X within N
seconds" are different claims (at once vs eventually) and may both exist. A
near-duplicate with a truly different meaning is reworded until the gate
stops pairing them ("sees the note once" → "sees the note exactly once"),
never waved through.
*Why: two phrasings of one act split the vocabulary and the step code.*

**B15 · Known tags only.** *Blocking.*
Allowed, and nothing else:

| Tag | Where | Meaning |
| --- | --- | --- |
| `@domain:<dir>` | feature line, required | the bounded context; equals the directory |
| `@regression:<bug-id>` | scenario | pins an observable bug in `known-bugs/<bug-id>.json` |
| `@synthetic` | feature line, exact | the whole feature is a standing live check; the harness does not run it |

Aggregate and kind (command, invariant, event, policy) are never tags: the
coverage map (C) derives them from the Quint model and the `Rule:`.
*Why: tags select runs; a tag nobody reads is a claim nobody checks.*

**B16 · Brief.** *Blocking over 8 steps (the gate); warning over 5.*
*Why: a long scenario is a script or several rules.*

**B17 · Behavior only.** *Blocking.*
A rule nobody outside the code could observe — a formula's exact output, a
validation table, a sync invariant, a stored row, a wire shape — is not a
scenario. It goes to the home "What belongs in a spec" gives it
([what belongs in a spec](#what-belongs-in-a-spec)).
*Why: a spec that tests internals breaks on refactors and still says nothing
about the product.*

### C. Coverage — each aggregate is complete

The coverage map is built per aggregate (Quint model) from the model and the
features of its context. An **illustrating scenario** for a model name is one
whose step uses the glossary term whose `model` lists that name (in the
context's own glossary; a borrowed term's local `model` list wins). A row is
`covered` (cite `file:line`), `MISSING`, or `model-only` (cite the `///`
comment that shows no person observes it). Coverage is judged by scenario,
whether or not it sits under a `Rule:` — a missing Rule is B3's finding,
never double-counted here.

**C1 · Every command has a happy path.** *Blocking.*
Each command has a scenario whose `When` uses its term and whose `Then`
includes a step that is not a refusal. A `Given` does not count. A world
event needs one only when a person sees a distinct outcome of it; otherwise
it is `model-only`. A command whose every outcome is a refusal (sending a
change the room cannot understand) is covered by its refusal scenario.
When one term models several commands, each needs its own scenario, and a
glossary that gives each its own term reads better (warning).
*Why: a command with no example is a command nobody agreed on.*

**C2 · Every invariant is shown enforced.** *Blocking.*
Each `inv<Name>` a person can observe is illustrated by the attempt most
likely to break it, ending in a refusal (B8); or, if no command can break
it, by the scenario where it is most at risk, showing it hold. A bookkeeping
invariant (a bound, an internal count) is `model-only`.
*Why: an invariant only stated in Quint is invisible to the people it
protects.*

**C3 · Every domain event is raised.** *Blocking.*
Each variant in the context's `events.qnt` is illustrated by a `Then` of a
scenario in its own context that says the event happened, using the term
that models the variant or its type, or that term's opposite when the
glossary defines one ("free access" for *PaidAccessEnded*). A `Then` saying
it did not happen does not count.
*Why: what a context publishes, it must show happening.*

**C4 · Every transition, legal and illegal.** *Blocking.*
For each status (see "Terms"), every transition some command makes has a
scenario. A status is **excluded** for a command when its guard (the
`all { … }` precondition) rules it out, or the action leaves the state
unchanged there (`if … else` a no-op). Each excluded status where a person
can still attempt the command — the product offers it, or the person can
express it (a move on the board) — has a refusal scenario; where the product
hides it, that scenario's `Then` is "cannot <command>" or "is not offered".
World events have no illegal rows.
*Why: the transitions nobody wrote are where the bugs live.*

**C5 · Every policy reacts.** *Blocking.*
For each relationship in the context map's "Relationships" where this
context is downstream, and each event in that upstream's `events.qnt` the
relationship names or implies, this context has a scenario whose `When` is
that event, or whose `Given` states it as a fact ("Alice's Plus membership
has ended"), in borrowed terms, and whose `Then` is the reaction. A mapped
relationship whose terms this context does not borrow is also an A4
finding.
*Why: integration is where two correct contexts produce a wrong product.*

**C6 · Features and model agree.** *Blocking.*
Every `When` of the context uses a term that some model of the context
names (a borrowed term counts when its lender's model names it). A `When` no
model names is reported once per context, not per aggregate: the model lacks
a command the features illustrate, or the feature belongs in another
context. A context with behavior but no model is `unmodelled` (warning).
Features that contradict a model's guard (a host who "leaves" where the
model forbids it) are C6 findings too.
*Why: the model is the map; features the map doesn't know are unaccounted
for.*

The coverage map has this shape, one per aggregate (rows illustrative):

```text
friends / friendship.qnt
| Kind       | Model name             | Term              | Illustrated by                                            | Status  |
| command    | block                  | block someone     | friend-block.feature:10 Blocking a friend ends …           | covered |
| invariant  | invBlockedCannotFind   | —                 | friend-block.feature:16 A blocked person cannot find …     | covered |
| event      | FriendshipEnded        | friendship        | friend-remove.feature:9 …                                  | covered |
| invariant  | invRequestsPair        | —                 | /// bookkeeping: a request is between two people           | model-only |
| transition | Friend → Blocking      | block someone     | friend-block.feature:10                                    | covered |
| illegal    | ask while Hidden       | friend request    | —                                                          | MISSING |
| policy     | SpaceEnded → live mark | live friend       | friends-live-space.feature:14 …                            | covered |
```

### D. Decoupling

**D1 · Feature text survives any rewrite.** *Blocking.*
Nothing in a spec file (feature, model, decision table, structure,
objective, glossary or the manifest) changes if the product is rewritten in
another language, framework, database or host. No file paths, package names,
or code identifiers appear in product prose. The product machine's
`source` arrays and a journey's `gherkin` list are traceability metadata:
they may point only to contracts in `specs/` and the statechart scope notes,
and the statechart gate rejects a missing address.
*Why: the spec is the contract the rewrite is checked against.*

**D2 · Steps bind through the harness, this repo's port.** *Blocking.*
A step definition or Quint binding for a harness domain (`specDomains`,
`tests/steps/**` and `tests/quint/**`) calls only exported
actions and reads of a package's `harness/` (`@libs/<pkg>/harness/…`,
`@pkgs/<pkg>/harness…`, `@pkgs/<name>-harness-ts`), the harness (`@libs/harness-ts…`,
`@pkgs/harness-root-shared-ts`, `@pkgs/gherkin…`), the package's own step helpers, another
package's exported `steps/`, and types and decided constants from a package's
public entry point (`@libs/<pkg>/public/…`, a `@pkgs/<pkg>` root,
`/shared` or `/interface` export). No selectors, test IDs,
DOM, HTTP, SQL or storage clients (a binding's `observe` reads what a
person sees through harness reads, not stored rows), and no `src/`, `server/`,
`client/` or `use-cases/` imports. Live domains bind through `apps/product-ts/tests/steps/`
(the live world), marked `// @io-wall-ok`.
*Why: the harness is the one place that knows the UI and wiring; steps above it
stay true when either changes, and the same wording runs against a live
deployment.*

**D3 · Steps hold no product logic.** *Blocking.*
One harness call or a short fixed sequence. `Given` builds state; it may assert
only that the state it just built took effect (a precondition guard), `When` performs the one event with no assertion, `Then`
observes and asserts. No branching on product rules, no loops computing
expected values, no step calling another step's text. Expected values come
from the scenario or a decided constant.
*Why: logic in glue is an untested second implementation.*

**D4 · One composition point.** *Blocking.*
Each package that runs a domain wires its world in one place — its
`tests/steps/index.ts` and the world it registers (`tests/steps/world.ts`,
or the harness world) — and nothing in `specs/` refers to it.
*Why: one seam to swap fakes for real adapters, and none leaking into the
spec.*

**D5 · Deterministic.** *Blocking.*
Harness steps run on virtual time (`w.s.until`), never sleep, `setTimeout` or the
wall clock; no skipped, pending or retried steps. A step the host cannot
perform throws `hostLimit(reason)`.
*Why: a spec that passes by luck proves nothing.*

**D6 · Bindings speak the model's language.** *Blocking.*
A Quint binding's `actions` and `observe` keys are the model's action and
variable names.
*Why: the binding is the model's translation, not a second vocabulary.*

### P. Process

**P1 · Spec text changes only in `spec:` commits.** *Blocking.*
A `spec:` commit touches only `specs/**` (this rulebook and the manifest
included) and docs; no other commit touches `specs/**`
(`bun run spec:ownership`).
*Why: the person approving behavior reviews exactly the behavior.*

**P2 · The implementer never edits specs.** *Blocking.*
A spec that cannot be implemented as written goes back to `spec-upsert` with
the scenario, the problem in product words, and a suggested wording.
*Why: whoever makes a test pass must not also choose what it checks.*

**P3 · Red before green.** *Blocking.*
Every new or reworded scenario is run and seen failing — undefined or
failing on its `Then`, never on a compile or setup error — before its steps
or product code are written.
*Why: a spec never seen failing may not test anything.*

**P4 · Demotion keeps every guard.** *Blocking.*
A scenario removed because it is not behavior (B17) is replaced first by a
code test that is seen failing when the behavior breaks; its `@regression`
moves to an example test marked `// regression: <id>`, in the commit before
the `spec:` commit that removes it.
*Why: cleaning up specs must never quietly drop coverage.*

### The gate

`bun run spec:verify` automates a subset of these rules, some with looser
thresholds (it allows up to three `When`s; B5 allows one); `spec-audit`
checks the rest. It fails on:

- undefined, ambiguous, pending or unused steps; a duplicate scenario name;
  stale step catalogs
- a missing or foreign `@domain`
- UI mechanics or implementation words in step text (`IMPLEMENTATION_WORDS`
  in `@pkgs/gherkin`), or a narrator ("I", "my", "the user")
- a scenario with no `Then`, or a `Given` after it has acted
- a file in `specs/` of a kind nothing runs, a nested folder, or a spec file
  without exactly one binding or a registered Quint campaign runner
  (`libs/tools-harness-ts/scripts/spec-packages.ts`)
- a `.feature` or product Quint interpretation outside `specs/`, or a `.qnt`
  outside `specs/` that is not test-only machinery marked `@spec-meta`
- TypeScript, JavaScript, or a Quint model marked `@spec-meta` or
  `@spec-interpretation` inside an unregistered campaign domain in `specs/`
- code in product prose (D1, `libs/tools-harness-ts/scripts/spec-decoupling.ts`; every
  file but this rulebook, excluding the product map's declared traceability
  fields): a
  `@pkgs/`/`@libs/`/`@apps/` name, a repo path, a source file name, or a tag
  other than `@domain:`, `@regression:` and the exact tag `@synthetic`
- a random walk outside a Quint model: `.explore(` or `randomActions(` in a
  spec-running package's test outside `tests/quint/`
- a BDD smell (`@pkgs/gherkin/smells`): more than 8 steps or 3 `When`s,
  acting after a `Then` outside `specs/journeys/`, a step naming architecture,
  a feature with no description
- a Quint aggregate whose shape cannot be checked (`@pkgs/quint/shape`,
  `libs/tools-harness-ts/scripts/model-shape.ts`): no invariant, an invariant that is
  literally true or false or names no state, an action `step` never reaches,
  a variable `init` never sets, a variable a person can observe that no
  invariant mentions, or no way for one device to lose its connection and
  come back while that changes what that device can do (`events.qnt` is the
  published language and is not an aggregate)
- the glossary (`libs/tools-harness-ts/scripts/spec-glossary.ts`, `@pkgs/gherkin/glossary`):
  a context without `ubiquitous-language.yml`; a term with no definition,
  source or lender, defined twice, redefining a kernel term, or borrowing
  what its lender does not publish; feature prose (not example tables,
  quoted text or placeholders) using an `avoid` word or another context's
  published term without borrowing it; a Quint type, variant, `var`,
  `action`, `val` or `def` that is not a `model` name of a term in its
  vocabulary or an imported `events` module (exempt: `init`, `step`, `inv*`,
  `SCREAMING_CASE` data and bounds, `_`-prefixed helpers); a Quint import
  other than `./events` or `../<domain>/events`; an `events.qnt` with state
  or actions; a glossary `model` no Quint spec in its context declares.

It warns on near-duplicate step wording (`--strict-duplicates` fails on it).
When a smell blocks what really is one rule, restate earlier steps as `Given`
facts before reaching for a longer scenario. A word used but never defined,
or used in another sense, is the auditor's to catch (A1, A3).

### Workflow

1. **Discover** (`spec-upsert`): rules, one concrete example per rule, open
   questions answered by a person, not guessed.
2. **Formulate**: read the catalogs and the glossary, write scenarios or a
   model, run `bun run spec:verify` (undefined steps and unbound models are the
   handoff; nothing else may fail) and `spec-audit` until it passes. A new
   domain needs a package to claim it in `specDomains`. Commit with a `spec:`
   subject (P1).
3. **Automate** (`spec-implement`): see each new scenario fail (P3), bind
   steps or the model, make the product pass, run the context
   (`bun run spec --package <workspace>`) and `bun run spec:catalog`. When the
   product disagrees with a model, a wrong product is a bug (fix it with a
   pinned regression); a wrong or ambiguous model goes back to the spec
   writer (P2).
4. **Gate**: `bun run spec:ownership`, then `bun check`.

`@regression:<bug-id>` scenarios have a
`libs/tools-harness-ts/goal/known-bugs/<bug-id>.json` pointing at the feature.

```sh
bun run spec --tags '@domain:friends'
bun run spec specs/friends/friend-block.feature
bun run spec specs/spaces/space-hosting.qnt
bun run spec --package @libs/friends -t 'ends the friendship'
bun run spec:catalog
bun run spec:verify [--strict-duplicates]
bun run spec:ownership
```

Every `test:spec` run writes its package's report bucket
(`<package>/.cache/harness-report`: step timelines with the harness calls
under each step, drawn traces, JUnit), cached by turbo with the verdict.
`bun check` has GitHub restore or rerun every bucket, snapshots included,
and publish each to the shared reports store on every run; `/reports/<commit
sha>` (its address is printed when the run starts) streams them in as they
land; nothing heavy runs locally. A feature failure
names the feature line, the matching definition, the completed steps and the
failing step's harness calls. The runner's Bun stubs in `.cache/spec/` are
never committed.
