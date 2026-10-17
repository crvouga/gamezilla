# Network recovery coverage

This ledger maps the requested app-wide work to executable product contracts.
Product decisions are in `specs/`; this file records their coverage and the
engineering checks needed to implement them. A row remains open until its
scenarios and model bindings pass against the product.

## Decisions and vocabulary

The person requested local-first behavior across every game, game mode and
space, with no traps and clear degradation for client and service failures.
They explicitly chose pausing clocks and resuming the same timed game during
an outage affecting both players. `multiplayer clock`, `match clock`,
`connection`, `control` and the existing game outcomes are reused; no new
term is introduced. Clock pause/resume meanings come from that explicit
choice. Physical connectivity, shared service availability and local readiness
are independent facts; a browser online event cannot prove the service works.

## Product contract inventory

| Surface | Contract | Additional continuity claim | State |
| --- | --- | --- | --- |
| App opening, tabs, Settings, preferences | `specs/runtime/offline-open.feature`, `connection-continuity.feature`, `voluntary-offline.feature` | An unfinished choice cannot block other places; missing connectivity is named; voluntary offline persists. | Bind and implement |
| Profile edits and sign-out | `specs/profile/offline-username.feature`, `offline-sign-in.feature` | Local acceptance survives reopening; changed shared rules give a clear refusal without destroying other work. | Existing contract; fault-matrix replay |
| Own spaces | `specs/spaces/space-needs-connection.feature`, `space-interruption-recovery.feature` | Create, rename, end and return locally; an end never becomes an open space after recovery. | Bind and implement |
| Joining, leaving, presence and multiple devices | `specs/spaces/space-interruption-recovery.feature`, `space-offline-devices.feature`, `space-connection-comes-and-goes.feature` | No endless join or false success; explicit departures survive recovery; no duplicate presence. | Bind and implement |
| Puzzle feed, current attempt, hints, results and ratings | `specs/chess/puzzle-offline.feature`, `puzzle-offline-days.feature`, `puzzle-interruption-recovery.feature` | Existing puzzles remain playable; empty feeds explain the limit and can be left; first results count once. | Bind and implement |
| Local Custom Games against bots and between bots | `specs/chess/custom-game-connection.feature`, `custom-game-local-continuity.feature` | Bot computation, agreed clocks and endings remain local; watcher outages do not stop the host. | Bind and implement |
| Shared Custom Games, timed and untimed | `specs/chess/custom-game-shared-interruption.feature`, `specs/games/custom-game-play.qnt` | Shared interruption is distinct from being away; no clock penalty or away win during interruption; accepted choices persist. | Bind and implement |
| Rated multiplayer at bullet, blitz, rapid, classical and daily | `specs/chess/shared-game-interruption.feature`, `shared-clock-recovery.qnt` | No abort, win, increment, record or rating during a pause; same board and remaining time on return; final result counts once. | Bind and implement |
| Matchmaking and rematches | `specs/matchmaking/waits-after-time-away.feature`, `specs/chess/multiplayer-offline.feature` | Last known search is labeled; refused choices never execute later; an accepted match retains identity. | Existing contract; interruption replay |
| Watchers and personal review | `specs/chess/multiplayer-recovery-and-privacy.feature`, `custom-game-local-continuity.feature` | No stale picture presented as current; reviewing and leaving remain local; watchers cannot make a participant's choices. | Existing and new contracts; replay |
| Social choices, search and inbox | `specs/friends/offline-friend-request.feature`, `social-needs-connection.feature`, `inbox-items.feature` | Known offline friend requests are retained; unknown search and online-only inbox choices refuse clearly; no privacy leak during rebase. | Existing contract; fault-matrix replay |
| Billing and external sign-in | `specs/billing/billing-offline-grace.feature`, `payment-failures.feature`, `specs/auth/failing-provider.feature` | Last known access follows existing grace; failed external choices never block the app or falsely claim payment/sign-in. | Existing contract; interruption replay |
| Generic shared rooms and clocks | `specs/room/match-recovery.feature`, `match-recovery.qnt`, `tally-recovery.qnt` | Local accepted changes survive; an unavailable shared match pauses while an individual disconnect does not. | Changed contract; bind and implement |
| Saved shared changes | `specs/sync-engine/note-recovery.qnt`, `note-refusal-recovery.qnt` | Retain acknowledged local changes; recover uncertain acknowledgements idempotently; rejection does not discard unrelated work. | Existing contract; fault-matrix replay |

The shipped game inventory currently contains Chess. The common room,
connection and action-continuity checks must be required for every offered
mode, including modes added later. A new mode without a continuity adapter
is a missing obligation, not an exemption. Planned modes do not become
launch features merely through this ledger.

## Example mapping and self-check

| Context and aggregate | Person's goal | Commands | World effects | Main invariants |
| --- | --- | --- | --- | --- |
| App: `connection-continuity.qnt` | Carry on while another choice has not finished. | Open a tab; open Settings; put aside a choice; reopen. | Device connection loss/return; shared choice unavailable/available; accepted answer, definitive refusal, lost answer and later confirmation. | Local preference kept; navigation and dismissal remain possible; confirmation truthful; refused choice not replayed. |
| Chess: `shared-clock-recovery.qnt` | Keep one rated game and its time through interruption. | Play next opening move; resign; open multiplayer. | Device loss/return; shared pause/return; passage of time. | Pause preserves moves, time and outcome; exactly one rated result; offline moves refused; one lasting game record. |
| Games: `custom-game-play.qnt` | Keep a shared custom game of any game without an artificial winner. | Move; resign; cancel; claim away win. | Device loss/return; shared interruption; passage of time. | Shared pause preserves time; absence does not grow during a shared interruption; final state immutable. |
| Room: `match-recovery.qnt` | Keep an accepted timed match even when the start or move was not heard back about. | Start; move. | Device loss/return; shared interruption; passage of time. | No time spent during shared unavailability; no extra time on return; ordinary disconnect time retained; winner permanent. |
| Spaces: `space-recovery.qnt` | Leave or end locally and learn the same outcome on return. | Leave; end; leave as host. | Independent device loss/return. | End never revives; departure is not undone; presence counts once. |
| Chess: `puzzle-result-recovery.qnt` | Keep the first attempt outcome and its rating. | Finish; retry; read stats; reopen. | Independent app closure and device loss/return. | First result permanent; only solver rated; account devices converge. |

Existing glossary terms, their forms and generated step catalogs were read.
Features use named people, observable outcomes, one `When`, known tags and
at most eight steps. Speed outlines have five rows. Refusal examples are
paired with permitted examples, or a rule states its true lack of a
counter-example. New phrasing is limited to outcomes absent from the
catalog, including paused clocks, incomplete choices and uncertain joins.
Model helpers carry faults; app features do not name HTTP codes or servers.

## Aggregate coverage map

| Aggregate | Commands and legal transitions | Illegal attempts and observable invariants | World-only effects |
| --- | --- | --- | --- |
| `connection-continuity` | Tab and Settings while unfinished; putting aside; reopen offline: `runtime/connection-continuity.feature`. Connection restore: `runtime/connection-restore.feature`. | False completion and refused choice on return: continuity feature. | Acceptance, definitive refusal, lost-answer and shared availability helpers; an unknown outcome remains unknown on interruption and reopening. |
| `shared-clock-recovery` | Move and resignation: existing multiplayer play/completion features. Open game and resume: `chess/shared-game-interruption.feature`. | Move while paused; no rating or record while unfinished; completed result retained; both devices offline without a shared pause: interruption feature. | Shared availability helpers; elapsed time is covered at every speed. |
| `custom-game-play` | Existing Custom Game play, clock and completion features. | Existing participant, cancellation, illegal move and away-claim refusals; shared outage time and away-claim refusals in the Custom Game interruption feature. | Shared availability helpers; device loss and return. |
| `match-recovery` | Start and move: `room/match-clock.feature`; return preserving accepted start/move: `room/match-recovery.feature`. | Disconnect still spends ordinary time; shared interruption cannot invent a winner; existing clock refusals. | Uncertain acknowledgements and independent availability helpers. |
| `space-recovery` | Existing leave, host-leave and end scenarios; independent return order in new interruption feature. | Explicit rejoin required; ended spaces never offered; existing membership and permission refusals. | Presence recalculation is bookkeeping; observed counts covered by presence features. |
| `puzzle-result-recovery` | Existing finish, retry, review, stats and reopen scenarios; offline first-result scenarios in new interruption feature. | First result not replaced by a later solve; watcher not rated; other account isolated. | Simultaneous finish and closure helpers; first-result reconciliation. |

Coverage states above are authoring evidence, not an implementation verdict.
No binding may skip a fault, make an expectation true by changing the fixture,
or assign a pause directly without driving the product's failure boundary.

## Technical fault matrix

These belong to injected-port contract/model tests beneath the features.
Each relevant mode must run the same matrix; a cross-product is explored
through a model, not a product random walk.

- Device offline, voluntary offline, online hints with unreachable service,
  abrupt disconnect, silent/stalled connection and repeated flapping.
- API only unavailable, room only unavailable, pubsub only unavailable,
  missed invalidation, external provider unavailable, and combined outage.
  Healthy independent local capabilities continue in every case.
- Request never sent, sent but not accepted, accepted with lost response,
  acknowledged before failure, and repeated delivery after recovery.
- Retryable failure, permanent refusal, expired identity, unsupported app
  edition, lost permission, ended space, removed membership and a changed
  account. An outage must not erase saved state or expose another account.
- An operation pending before loss, started after loss, dismissed while
  pending, reopened while pending, and a later different operation. Old
  completion must not overwrite newer intent or falsely report cancellation.
- Server or collector termination while active, termination before a clock
  deadline, termination after a decided result, delayed alarms, and durable
  restoration. An interrupted first-move deadline pauses too.
- One device returns first, service returns first, one person stays offline,
  all devices reopen before service returns, and another failure during
  reconciliation. Closing a waiting surface does not end a match or a space.
- Human/shared bot participant, local bot, two local bots, spectator, timed
  and untimed Custom Game, all rated speeds and puzzle modes. Local bots
  never depend on the shared-service health or an unrelated watcher.
- Accepted move versus outage at the same boundary; accepted resignation
  versus outage; deadline versus accepted move; accepted end versus late
  join; explicit leave versus return; stale configuration versus new game.
- Rating/history publication interrupted before, between or after writes:
  each finalized game contributes once; paused/aborted/unrated games follow
  their existing distinct policies; Glicko-2 arithmetic remains a code test.
- Persistent local state and outbox recovery, including interrupted writes,
  reopening, deterministic rebase, bounded delivery attempts and retention.

## Current audit verdict

INCOMPLETE: new steps and new models are intentionally unbound until the
`spec:` contract is committed. This is red authoring evidence, not a pass.
The strict gate is invoked through the package-owned `ci:specs` task with
`--strict-duplicates`; the root alias currently forwards that option to
Turbo itself and rejects it. Type checking and invariant exploration are
separate from successful product replay.

## Authoring validation

The strict spec gate currently reports only undefined new steps and the two
new model bindings. No other wording or shape finding remains in that gate.
All four touched models type-check with the installed Quint 0.32.0. Each
was explored for 100 traces of 35 steps at seed 424242 with every named
invariant selected; no invariant violation was found. This validates the
specification models only and is not product implementation evidence.

The few scenarios over five steps keep the complete reopening or two-device
context and remain within the eight-step hard limit. Binding-level audits
and product replay remain incomplete until implementation. The unchanged
aggregates are referenced here, not claimed fully re-audited by this pass.
