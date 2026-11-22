# Real-time implementation

This is the implementation ledger for the Pong brief (the brief itself is
not kept in the repository).
The product contract belongs in `specs/`; the existing framework is described
in [GAME_FRAMEWORK.md](GAME_FRAMEWORK.md).

## Architecture assessment

The registries compose shared game definitions, client presentations and harness
adapters. `defineGame` registers common position rules and independently optional discrete
turn rules and fixed-step simulation. A continuous game supplies no fake turn
automation. Genuine turn games retain their stronger type. Puzzles still require
the discrete rules they use. The registration installs the existing custom and
matched-session infrastructure once. Custom
games already own side selection, readiness, invitations, bots, rematches,
results and offline local games. Matchmaking already owns opponent searches,
bot population, ratings and durable history. Those are extension points, not
reasons to add another session or matchmaking service.

Spaces compose typed command and event routers into a `RoomModule`. The room
server authenticates connections, serializes commands, validates through the
module, commits events atomically with deduplication outcomes, and broadcasts
them. Reconnect replays the durable event log. Presence and host availability
are distinct inputs. Schedule effects recover deadline work on both the
Durable Object host and virtual-clock harness. The web and memory adapters
already share this protocol and transport lifecycle.

The durable log currently retains every event and every command verdict.
Recording 60 game-state events per second would make storage and reconnect
cost grow with match duration. The transient signal path described below
addresses this for live state. Custom and matched sessions checkpoint lifecycle
and score boundaries. Persistent authorities now also replace one bounded
recovery value before publishing a court; see [authority recovery](#authority-recovery).

Rendering is a game-owned board inside framework screens. Product screens
compose the design system. Solid context supplies clocks, timers, input,
sound and room state; simulation must have no dependency on any of these
rendering or device mechanisms.

## Execution foundation

`@pkgs/turn-game-shared-ts/simulation` owns the pure contracts, and
`game-simulation` validates and composes independently optional bot,
presentation and discrete-command parts. `@libs/game-session-shared-ts` owns execution:

- `simulation-engine`: bounded fixed-step execution using the repository's
  seeded RNG. Each tick gets an independent derived random stream, so restoring
  a checkpoint does not require replaying all earlier random draws.
- `simulation-driver`: one owned injected timer; snapshot publication has its
  own configurable cadence. Presentation is scheduled by the client separately.
- `simulation-prediction`: bounded unacknowledged local input history,
  selective projection, monotonic authoritative reconciliation and an explicit
  reconnect fence/reset. The game chooses which entities can be predicted.
- `simulation-interpolation`: bounded, renderer-independent snapshots sampled
  at fractional logical ticks; stale snapshots are ignored and exhausted
  history holds the last state rather than inventing future authority.
- `simulation-bots`: tick-based input generation in stable player order,
  validated through the same input parser as human controls.
- `simulation-authority`: input ownership, match fences, bounded input delivery,
  independently scheduled snapshots and late spectator state, hosted by a
  session's room. It owns execution, not session creation or results.
- `simulation-failure`: the seed/options, checkpoint and literal inputs of a
  failed pure step, sufficient to replay its tick-local random stream.

Time is milliseconds at the scheduler boundary and integer logical ticks in
the simulation. The tick being stepped starts at one. Input for committed ticks
is refused, simultaneous inputs sort by ASCII player identity then sequence,
and duplicate sequences cannot apply twice. A scheduler stall advances at most
the configured catch-up bound and drops excess wall time. Pausing clears the
partial tick; reconnect/checkpoint restore discards queued controls.

Mechanics must be pure and treat their arguments as immutable. JavaScript
floating-point operations are reproducible in the supported runtime with
identical input and configuration. Cross-runtime bitwise determinism is not
claimed. Game codecs validate data before a checkpoint reaches execution.

## Room signals

The room wire protocol carries `signal` frames alongside commands. A client
sends only while connected and synced. Signals never enter the optimistic
event fold, durable outbound queue, event log or persisted deduplication map.
The server serializes them with room commands and applies its ordinary
authorization, connection-view and session-expiry gates before invoking the
live-session handler. A signal captures its admitted connection at ingress;
removing or replacing that connection invalidates queued frames.

`RoomServer.publishSignal` fans one frame out through the existing connections,
with optional audience filtering and session expiry checks. Subscribers are
released on client teardown. The game execution adapter owns compact typed
payloads, sequence acknowledgments and bounded snapshots. A snapshot request
returns the current authoritative state to an admitted reader, including a late
spectator. Spectators cannot control a player's seat.

The execution adapter has been exercised over actual in-process `RoomServer`,
`RoomClient` and memory transports, composing the framework's existing counting
race and its normal schedule handlers. The contract suites check invalid
controls, another player's seat, stale rounds, duplicates, reordering,
independent publication, pause/resume and teardown. Product custom-session
integration also uses the real space module and authorizer. The
[seeded live-network campaign](#seeded-live-network-campaign) now exercises the
session and presentation adapters under bounded faults; product-wide
adverse-network campaigns remain pending.

## Pong mechanics

`@libs/pong-shared-ts` supplies only typed configuration, normalized inputs,
serializable state, a pure step, a validated codec and bot strategies. The
shared simulation engine executes it without a browser or network. Court
coordinates are independent of viewport pixels. Tick and publication rates are
separate configuration values; the initial defaults are 60 and 20 per second.

The square ball uses swept paddle, wall and goal intersections. A collision
consumes its part of the timestep and integrates the remainder after reflection.
Paddle contact sets a bounded angle from its impact offset and accelerates only
up to the speed cap. Collision iterations have a safety bound; exhausting it
holds at the last safe contact. Points reset the ball into a timed serve;
completed states are absorbing. Paddle displacement is bounded for keyboard
directions and normalized touch targets alike. Unrefreshed controls expire.

Bots decide at different reaction intervals and with different aiming errors
and anticipation, using the same validated controls and physical speed limits.
Their retained control is part of the serialized game state, with no hidden bot
timer or human identity. Geometry, deterministic replay, codecs, displacement,
score and bot input invariants have automated example/property coverage.

## Custom sessions and local execution

An optional `RoomModule.createRuntime` creates one owned execution controller. Normal
turn and puzzle rooms allocate no simulation timer. Bun, Durable Object and
in-process harness hosts pass explicit timers. Timer wakes and lifecycle commands
join the room serial chain, so a physics tick cannot race a durable checkpoint.
Disposal releases execution and connection references.

`SessionSimulation` attaches execution to an existing session. Custom-game
checkpoints are trusted service commands, validated for game identity, generation,
monotonic checkpoint ticks, acknowledgments and codec validity. Input delivery and
snapshots stay transient; accepted controls never become a move list. Completion
uses the existing result and rematch lifecycle. A failed step cancels from the
last valid checkpoint and releases every timer rather than leaving an active
orphan.

An interruption clears queued controls and neutralizes the game's retained input.
The physics timer is suspended. A persisted 30-second absence deadline ends the
game by forfeit when one side stays away, or cancellation when both stay away.
Reconnection restores the current tick and state with a new control generation,
without changing the logical random seed. A recreated authority receives a new
execution generation. Persistent authorities restore their latest published
court through the bounded [recovery value](#authority-recovery). Local execution
now has the same publication guarantee through its client store; see
[local authority recovery](#local-authority-recovery). Browser and hosted
Durable Object recovery rehearsals remain open.

`LocalSimulationSession` uses the same controller on the creator's device and
checkpoints through the existing offline custom-game queue. Only the creator of
a game involving no other account can submit those checkpoints. A second person
on the device is an explicit local seat with no account identity. Local bot and
two-seat controls have in-process room-client coverage, including preserving a
finished offline bot game on return. Local games are unrated. Online spectators
receive the creator's current court through the validated local relay described
below.

## Matched execution and persistence

The same `SessionSimulation` runs inside the existing matched room. Both admitted
players control their assigned seats; watchers receive current snapshots. The
room's serial command path can project current live progress into a terminal
decision, so a resignation captures the current tick rather than the previous
score boundary. Countdown and running progress use a genuine `started` marker,
without fabricated turn moves. The existing permission decisions issue matched
watch/play grants; transient inputs still undergo seat ownership checks.

The injected room service returns a command receipt: the stored refusal, or
current authoritative state for an accepted command. Duplicate accepted no-ops
also retain their verdict, without adding a history row. Matched terminal
mutations send a stable command identity to this same authority and project its
accepted result through the existing SQL repository. SQL deliveries update
ratings/rematch metadata while preserving authoritative mechanics and outcomes.

Continuous matches start without turn clocks. Existing outbox deadlines project
live results every five seconds through a host-invoked mutation; a subsequent
search or rematch also reconciles live results before judging unfinished games.
The existing repository rates a newly finished game once and frees its owners.
Configuration-preserving rematches use the game's position rules. Automated
contracts exercise actual rooms and SQLite, including a rollback after room
acceptance, retrying the receipt, and rating/freeing both people once.

This is framework and persistence evidence. Pong is registered by the shared,
client and harness registries. Matched presentation, synthetic-population input
and the natural completion/rematch journey have additional evidence below;
the outstanding acceptance work is listed separately.

## Client presentation

`SimulationReplica` combines the bounded prediction and interpolation primitives.
Raw events are coalesced into a bounded input cadence; held input is refreshed,
and missing snapshots stop new controls. A snapshot is accepted only for the
execution and control generation agreed by the durable session. Prediction
changes only the local paddle; ball, opponent and score remain authoritative.
Passed unacknowledged ticks are discarded, and a reconnect clears held controls.

The custom-game screen now connects its game-owned board to this replica. Local
play uses its owned local session; shared play uses the existing room signals.
Presentation runs independently at 60 frames per second through injected timers.
A hidden page releases presentation work and held controls, without pausing the
shared authority. Score-target configuration uses the game's typed position
rules, and native sliders complement keyboard and touch controls.

Pong's client composes `@pkgs/ui` throughout. `PaddleCourt` is the geometric design
system component: normalized pointer fractions, independent simultaneous touches,
keyboard directions, focus cleanup and a stable logical viewBox. Automated DOM
checks cover these mechanics and Pong's role-specific controls, paused state,
score display and malformed-position recovery. The real product harness also
drives local Pong through the shared custom-game flow and rendered paddle
sliders. Eighteen scoring and local-play scenarios pass, including both local
people, starting offline with a bot, bot completion offline, connection changes
at every local stage and reopening. Two bound Quint projections cover scoring
and local availability; all sixteen scoring traces pass through that same UI.
The client now joins the global registry. These local checks do not claim finished
online integration.

`HarnessGame` accepts real discrete-turn and simulation harness contracts.
Simulation fixtures independently state inputs and expected positions, including
a natural completion, without fabricated moves. The game system and custom
lineup accept a guest creator and an explicit second local person. The client
bootstrap now builds its capability catalog from canonical registrations, so a
simulation-only game receives its actual shared choices. Global conformance
planning accepts that common registration, with separate real-turn and simulation
obligations. Pong's fixed-step, namespace, presentation and result-record laws use
independent simulation examples. Move-history laws require actual turn rules;
a hybrid owes both execution suites. Common access checks now send a normalized
Pong control through the real room and require an authoritative tick acknowledgment.
They keep participants connected and supply authored private setups for games
that need them. Shared navigation checks exposed and pinned a cancelled-Pong
history crash: cleanup now releases input through the last mounted control
surface rather than reading a disposed board's reactive props.

Installing simulation beside a turn game does not require simulation timers for
that turn session. The room exposes the injected timer port lazily, and the
custom/matched bindings preserve that access until actual simulation launch. A
mixed-registry regression hydrates and plays a real untimed turn with no simulation
timer port; requesting scheduled live work without that port still fails clearly.

The enrollment checkpoint passes 566 unit/conformance checks, including the
existing turn and puzzle suites. Thirty-five common specification checks also
pass: discovery/navigation, custom-game access decisions, host-follow navigation
and matched-game structure. Replay planning now includes Pong as the sixth
host-follow variant, with the existing replay depth and shard caps unchanged.
The affected room/session packages pass their twelve type-check, test and lint
tasks after the timer-independence fix. These are scoped checks, not a full
`bun verify` verdict.

Enrollment is not finished shared behavior coverage. Existing mixed features
still contain turn-specific preconditions, clocks, moves and review expectations.
They need precise applicability and real continuous-play counterparts; continuous
games must not disappear from the common policies they offer.

## Clockless matchmaking

The shared matchmaking capability advertises its namespace and, independently,
whether it offers turn-clock choices. `MatchChoice` carries an optional actual
clock and its rating pool. A clockless game advertises one `play` choice and
uses its game rating pool; its searches, formed games and rated results use
the existing matchmaking and rating machinery. Timed games retain their clock
choices and speed pools. No compatibility field or alternate matchmaker was
added. The old clock-only namespace field was removed from every call site.

The common client conditionally composes the clock choices, clock display,
first-move countdown, rating panels and turn announcements from actual
capabilities. Pong no longer supplies invented timeout copy; the shared and
client registration contracts require that copy only where clocks are offered.
The public presentation contract makes timeout copy optional. Timed games still
owe the full description laws.

Contracts and coverage are in [the matchmaking audit](MATCHMAKING_SPEC_AUDIT.md),
committed separately as `72f91e8fb` and regression tag `f26656377`. The shared
model observes rendered match ids, seats, opponent ratings and search controls;
the harness normalizes ids without assuming a second id is the same match.
The model's refused commands read the actual client verdict or rendered denial.

Current scoped evidence under `.cache/pong/`:

- `matchmaking-after-dependency-updates.log`: 175 checks pass across every
  eligible game, covering all four search features and every drawn trace of
  the new model on the updated DOM dependency.
- `opponent-search-deep.log`: all sixteen actual eight-step traces pass,
  together with all six clockless scenarios (27 checks).
- `opponent-search-model-proof.log`: the new aggregate's bounded invariant
  proof passes. Eighteen model parts retain one aggregate per part; existing
  proof phases and time budgets are unchanged.
- `matchmaking-shards-minimal.log`: replay/load caps and minimality pass;
  the product replay partition count remains 95.
- `matchmaking-five-verified.log`, `matchmaking-games-quality.log`,
  `clock-copy-quality.log`: the affected type checks, tests and lints pass.
- `matchmaking-goals-verified.log`: ownership and regression registration pass.
- `matchmaking-final-static-gates.log`: strict specs, goals and ownership pass
  after both new regressions are registered.
- `matchmaking-final-conformance.log`: affected rules/simulation and turn
  matchmaking contracts, plus the common harness type check and lint, pass.

This establishes finding an opponent without a clock. The shared paddle
checks below separately cover matched presentation and guidance. Completion
journeys and synthetic-population inputs remain required, together with a
current full `bun verify` verdict.

## Matched paddle presentation and recovery

The matched board now connects its existing open room to the same
`SimulationReplica` presenter used by custom and local play. The common
presenter owns injected display timers, typed room snapshots, visibility
cleanup and bounded prediction; it introduces no transport or game mechanics.
Only each person's assigned paddle is offered. Viewers receive the court
without controls, including when joining after play begins.

An unavailable or stale connection preserves the last displayed court while
suspending controls. Refreshing when both room and query connection readiness
change closes a race where a returning viewer could otherwise miss a paused
court snapshot. These behaviors have literal model traces registered as
`pong-matched-paddle-controls`, `pong-offline-presentation-rollback` and
`pong-spectator-return-during-pause`, each with its own known-bug entry.

The Pong harness uses the framework's public `pairGamePlayers` fixture, real
account/search/space actions, rendered paddle sliders and visible court
geometry. It does not invent turns or read private framework internals.
Gherkin parameter vocabulary is discovered from flat `parameter-types*.ts`
entries; adding a game's decided values does not append to a common register.

Current scoped evidence under `.cache/pong/`:

- `shared-control-undefined-red.log`: all sixteen new examples undefined
  before bindings; `shared-control-observable-red.log` then exposes the
  missing live controls with a failing observable outcome.
- `shared-control-public-api-red.log`: the literal offline rollback fails
  through the public harness connection actions before the presenter fix.
- `pong-context-all-traces.log`: the deeper draw exposes a viewer returning
  while a player is offline; its literal trace is also pinned.
- `pong-context-recovery-all-traces.log`: all 97 checks pass across the whole
  Pong context, including every drawn trace of all three models, every
  example and the three pinned regressions.
- `pong-shared-control-proof.log`: all three aggregate shapes and bounded
  invariant proofs pass at their existing four-step bound.
- `shared-control-recovery-quality.log`: ten affected type/lint tasks pass.
- `shared-control-final-packages.log`: 23 affected package tasks pass,
  including client/shared/UI/harness tests and the final board change.
- `shared-control-common-contracts.log`: common rules/simulation and timed
  matchmaking contracts pass, together with the Games harness type/lint checks.
- `shared-control-static-gates.log`: strict specs, ownership and registered
  regressions pass. No specification wording changed while implementing.

This proves shared paddle guidance and the stated recovery cases. It does not
prove natural matched completion, rematches, population bots, multi-device
control ownership or the rest of the integration work listed below.

## Ending matched play without turns

The shared ending policy now distinguishes the game's actual beginning of
play from a discrete move count. The existing first-move rules still apply
to turn games. A game without turns offers abort during its initial wait and
resign once its authoritative execution has started, including a subsequent
pause or countdown. Room revisions never stand in for first moves.

`spec(games)` commit `e8bf63659` records the four ending rules, the new
`matched-game-ending` aggregate and its connection cases. Its 36 examples
first failed undefined. The rendered model then exposed resignation during
Pong's initial countdown; its literal trace is pinned as
`simulation-revision-is-not-a-first-move`. An additional literal trace keeps
the winner observer correct when adjacent own-seat labels have no space.
The model observes the actual offered buttons, seats and result announcement.
The scenarios also exercise the existing client mutation boundary. Complete
confirmation-modal journeys and production-like execution of the natural
completion/rematch journey remain required.

Specification eligibility is now a discovered directory with one JSON entry
per specification. The first-move abort feature requires genuine turns; the
new ending feature and model require simulation without turns. This keeps
both counterparts executable without invented moves or clocks.

The replay plan now includes all nineteen Games aggregates. The new model
has its own proof part; the existing split proofs retain their phases and
allowances after their part numbers move. The smallest valid replay
partition is now 99, with four corresponding task templates added. Existing
replay/load caps, trace depths, property counts and task budgets are unchanged.

The visual evidence graph had omitted Pong and retained the old Games part
count. Its sources are now generated from package declarations during
`bun install`, with the consumer's dependencies reconciled in the same step.
The derived source list is gitignored. The literal missing-Pong regression
is `pong-visual-evidence-not-enrolled`. This establishes evidence enrollment,
not a completed visual-quality verdict.

Current evidence under `.cache/pong/`:

- `matched-ending-undefined-red.log`: all 36 new examples fail undefined.
- `matched-ending-initial-choice-red.log`: the real rendered initial choices
  disagree with the model before the execution-marker fix.
- `matched-ending-deep-and-turns.log`: 119 checks pass, including all 36 new
  examples, all sixteen drawn eight-step traces, two pinned regressions, five
  model checks and all sixty applicable existing turn-based abort examples.
- `matched-ending-proof.log`: the six ending invariants hold at the existing
  four-step bounded proof depth.
- `pong-after-matched-endings.log`: the whole Pong context passes all 52
  PR-profile checks after the ending and generation changes.
- `matched-ending-choice-quality.log`: twelve affected package tasks pass.
- `matched-ending-stable-quality.log`: eight final type/lint tasks pass.
- `matched-ending-shards-stable.log`: all replay/load caps and the minimal
  partition check pass. `matched-ending-proof-budget-guards.log` and the
  later task-planning checks preserve the split proof allowances.
- `matched-ending-tools-test-final.log` and
  `matched-ending-tools-quality-final.log`: planning, generated-source and
  visual-input checks, plus the tools type/lint checks, pass after the final
  generator and policy changes.
- `matched-ending-final-gates.log`: strict specs, ownership and registered
  regressions pass after all generation changes.
- `visual-evidence-install.log`: install runs all eight generation tasks;
  `visual-evidence-generation.log` reruns the package-owned generator.

The earlier `atlas-zod-issue-current.json` and `atlas-version-current.json`
recorded the then-open upstream issue and the then-latest package,
0.10.0 with Zod `^3.25.76`. No dependency patch or suppression was used.

The earlier full gate (`.cache/pong/verify-current.log`) stopped at `ci:audit`
after 67 tasks passed. The catalog and existing transitive version pins were
updated to Happy DOM/global-registrator 21.0.4, Serialize JavaScript 7.1.3 and
Undici 7.30.1, using the published fixes. The direct Zod dependency was already
4.6.7. The remaining entry then was Atlas's transitive Zod 3.25.76, tracked in
[Atlas #16](https://github.com/crvouga/atlas/issues/16), which also reproduced
the finding on npm Atlas 0.10.0. No Atlas override, patch, advisory
suppression or duplicate issue was introduced. The upstream fix is now released
and installed in its own commit, as recorded below. The full gate still needs
its current verdict.

`dependency-audit-after-updates.json` records only that remaining entry.
`post-audit-updates-quality.log` passes twelve affected tasks after the DOM
dependency update; `timed-registration-quality.log` passes eleven tasks for
the existing timed game registrations. These scoped checks do not turn the
failed full gate into a pass.

## Integration work

### Synthetic Population continuous controls

The existing population now runs registered continuous inputs through the real
client. `GameAutomation` composes optional turn decisions and continuous
controls. Existing turn registrations use `turnAutomation`; continuous games
may supply `continuousAutomation`, and a hybrid may supply both. The catalog
contains actual adapters only, including Pong, without placeholder moves or
legal-action lists.

Pong reuses its registered medium strategy and reaction interval. The controller
reads the displayed position and the account's actual seat, validates normalized
inputs and gestures on the existing paddle slider. The normal replica supplies
wire sequences and authoritative tick association. A delayed worker samples the
present once. The worker's single owned timer schedules controls independently
of slower activity decisions, checkpoints and administrative work. Repeated UI
telemetry is sampled with counts; recent actions remain available for inspection,
and failures are always recorded.

The native test listener now shares the browser harness's existing room upgrade
and socket handlers. It had previously omitted WebSocket upgrades, leaving Pong
reconnecting. Actual native realms now sign in by their existing internal links,
join the normal clockless queue and deliver inputs for both paddles. Pairing
fixtures use explicit shared policy seeds instead of assuming independent random
game choices happen to match. No bot identity, authority or transport was added.

This exposed a real queued-checkpoint race: consecutive departures could make
an older presence checkpoint look fatal. Custom and matched handlers preserve
the newer projected state and its schedules through the ordinary event receipt,
without weakening room's nonempty-event invariant. The deterministic contract
disconnects both people before settling, then reconnects and reads the advancing
authority tick.

Evidence under `.cache/pong/`:

- `synthetic-context-stable.log`: all 47 Synthetic Population checks pass,
  including natural Pong completion, offline preservation and return.
- `synthetic-native-worker-stable-quality.log`: all three worker tasks pass;
  its suite has 29 passing tests, including real Pong inputs, independent
  scheduling, timer disposal and retained inspection history with sampled events.
- `continuous-registration-final-quality.log`: full shared-session test/type/lint
  checks pass; 78 tests include both departure races and existing fencing rules.
- `synthetic-framework-fixtures-tests.log`: 102 harness and 163 common-game
  tests pass after all automation call sites are updated.
- `synthetic-common-game-contracts.log`: registered rules and simulation
  conformance passes, including existing turn games.
- `pong-after-synthetic-controls.log`: all 52 Pong context checks pass.
- `synthetic-pong-model-final-deep.log`: all two drawn six-step traces and
  four model checks pass; `synthetic-pong-formal-final.log` passes the existing
  bounded model proof. No full nightly verdict is claimed.
- `synthetic-all-static-final.log`: fourteen type/lint tasks pass; the later
  `synthetic-fixture-stable-quality.log` and `synthetic-result-final-quality.log`
  cover the final fixture split and stricter result observer.
- `synthetic-final-spec-gate.log` and `synthetic-final-policy-gates.log`: strict
  specs, ownership and registered regression gates pass.

The new product contract is the spec-only commit `9eb0031cb`; its audit is
[`PLAYING_PONG_SPEC_AUDIT.md`](../../synthetic-population-harness-ts/docs/PLAYING_PONG_SPEC_AUDIT.md).
Pong's paused-game example and the broader Observatory model coverage remain
open. Choice, disclosure and reopening enrollment is described below.

### Bot choice, identification and reopening

The spec-only commit `fcff75567` enrolls all four offered games in next-activity
choice, adds Pong to account identification and ongoing/finished recovery, and
adds a model for identification through connection loss. The binding reads real
account identification and the connection notice through public harness reads.

The finished-Pong example found an observer bug: a delayed rating addition made
an unchanged victory announcement differ after reopening. The observer now
compares the game, actual result/reason and final position. Aborted games cannot
count as finished victories. The earlier pause assertions also manufactured the
game's finish and sign-out; the pause harness now runs that autonomous work,
and its Thens only read the outcome. `707e76c38` pins this regression to the
existing executable pause scenario. Pong's pause row is not enrolled yet.

Evidence under `.cache/pong/`:

- `bot-policy-read-only-red.log` reproduces assertion-side gameplay; the repaired
  Observatory feature passes all seven checks in `bot-policy-observatory-autonomous.log`.
- `bot-policy-enrollment-first-examples.log` reproduces finished-Pong's rating-copy
  mismatch. `bot-policy-pong-result-semantic.log` passes with actual result reads.
- `bot-policy-context-current.log` passes all 59 checks in the whole context.
- `bot-policy-enrollment-all-traces.log` passes all eighteen drawn six-step traces
  across choice, identification and continuity, plus twelve model checks.
- `bot-policy-enrollment-model-proofs.log` passes the package's bounded proofs.
- `bot-policy-binding-quality.log` passes the harness type/lint tasks, and
  `bot-policy-enrollment-final-gates.log` passes strict specs, ownership and regressions.

Audit: [`PONG_BOT_ENROLLMENT_SPEC_AUDIT.md`](../../synthetic-population-harness-ts/docs/PONG_BOT_ENROLLMENT_SPEC_AUDIT.md).
No full nightly or full-gate pass is claimed.

### Hybrid commands in custom rooms

`SimulationCommands` is an optional mechanics capability. Its `key` identifies
command-owned fields and stays unchanged by ordinary simulation steps. Its
`rebase` merges an accepted command into the current live state. A game combining
turn rules and simulation must provide it; a registration without it fails early.

Custom-room commands are decided against the projected live state on the room's
serial chain. Rebasing preserves the tick, fractional scheduling progress, input
acknowledgments and queued future controls. Action-history validation compares
the command-owned position, so elapsed time does not make an honest history
invalid. A same-tick checkpoint from before a turn retains the newer command
state. Simulation conformance also checks that stepping preserves command keys.
Durable custom-game timestamps round fractional scheduler time at the boundary.

The existing counting-race example supplies the hybrid probe. Literal regressions
are `hybrid-simulation-overwrites-discrete-command`,
`hybrid-queued-checkpoint-rolls-back-command` and
`hybrid-fractional-turn-timestamp`.

- `hybrid-custom-observable-red.log`: a durably accepted token is missing in the
  next live snapshot.
- `hybrid-same-tick-checkpoint-observable-red.log`: an older service checkpoint
  rolls the accepted token back at the same tick.
- `hybrid-second-turn-quality.log`: the second turn at 116.66666666666669 ms
  fails durable-event validation before timestamp normalization.
- `hybrid-second-turn-green.log`: the three hybrid checks pass, including two
  consecutive turns, preserved queued input/acks, and invalid-history refusal.
- `hybrid-second-turn-stable-quality.log`: all eight affected package tasks pass.
- `pong-after-hybrid-custom-rebase.log`: the full Pong context passes 52 checks.
- `hybrid-common-game-contracts.log`: common rules/simulation conformance and
  the Games harness type/lint checks pass, three tasks total.
- `synthetic-after-hybrid-custom.log`: all 59 Synthetic Population checks still
  pass after live custom-state projection changes.
- `hybrid-custom-final-policy-gates.log`: strict specs, ownership and known-bug
  registration pass after all hybrid changes.

Matched turns now use the authoritative mutation/receipt path described below.
Local hybrid command projection was added after the matched probe below; its
evidence is recorded in the local-command section.

### Matched hybrid commands

The existing service-only match decision now accepts a discrete move with its
actual revision and action. It reuses `playMultiplayerMove` against projected
live mechanics, the room's injected command time and the game's real rules.
The mutation still checks the person's permissions, space and ownership, locks
the SQL owner records, and reads private setups when the game requires them.
Those setups remain trusted command input and are never published in an event.

Live moves use the normal room receipt. A SQL rollback after acceptance retries
that receipt instead of playing twice. The other person's next move follows the
same path. Checkpoints preserve an actual turn owner, and a checkpoint queued
before a move cannot roll its command fields back at the same tick.

The counting-race fixture uses declared app-config, billing and space schemas
for real permission checks. Its actual match choice is clockless; no turn clock
is fabricated to exercise simulation. Evidence under `.cache/pong/`:

- `hybrid-match-turn-owner-red.log` reproduces a real turn owner being cleared.
- `hybrid-match-move-unbound-red.log` shows the missing live decision protocol.
- `hybrid-mutation-old-route-red.log` restores the former SQL-only route: the
  legal room revision 3 is wrongly compared to SQL revision 0 and refused.
- `hybrid-matched-checkpoint-red.log` reproduces a same-tick checkpoint rolling
  a matched command back from one accepted token to zero.
- `hybrid-matched-final-quality.log` passes all six shared matchmaking/session
  tasks; the session suite has 85 passing tests, including actual mutation
  rollback, receipt retry, the other player's turn and queued input progress.
- `pong-after-hybrid-matched.log` passes all 52 Pong checks.
- `matched-ending-after-hybrid.log` passes 68 shared ending/abort checks, and
  `matched-no-turns-after-hybrid.log` passes all 36 continuous-game examples.
- `hybrid-matched-final-tool-gates.log` passes all six tools test/type/lint and
  spec/ownership/regression tasks after the mutation integration.

The registered regressions are `hybrid-match-checkpoint-erases-turn`,
`hybrid-match-move-bypasses-live-authority` and
`hybrid-matched-checkpoint-rolls-back-command`. Local projection now has its own
probe below. Broader recovery, observability and visual work remain required.

### Upstream audit fix and release enrollment

Atlas published its Zod fix while this work was in progress. Commit `ecd91a8ab`
upgrades the catalog and resolution to Atlas 0.10.2 and removes the obsolete
Atlas-specific Vite override. It contains only those dependency changes. The
published package uses Zod 4.6.7 and Vite 7.3.7. `ccbfa0026` separately adapts
the JUnit fixtures to its required suite, class and elapsed-time fields.

The earlier full-gate audit blocker is resolved:

- `atlas-zod-issue-after-bots-hybrid.json` records the upstream issue as closed;
  `atlas-version-after-bots-hybrid.json` records the published package metadata.
- `atlas-upgrade-install.log`: install and all eight generation tasks pass.
- `atlas-upgrade-current-audit.log`: fresh current registry evidence passes the
  enforced audit. No additional exception, suppression or patch is used.
- `atlas-upgrade-consumer-final-quality.log`: all eighteen consumer test, type
  and lint tasks pass across six packages. The harness has 102 passing tests
  and the tools package has 863. `atlas-upgrade-product-quality.log` passes
  the product app's type and lint tasks too.

The broader tools run exposed missing Pong integration metadata. The spec-only
commit `0bd234128` adds Pong to the closed-world conformance inventory. Its audit
is [`CONFORMANCE_ENROLLMENT_AUDIT.md`](../../pong-harness-ts/docs/CONFORMANCE_ENROLLMENT_AUDIT.md).
The UI evidence generator is declared by its qualified package task in the root
graph, the capacity document is regenerated from the actual corpus, and the
existing shard/API fixtures use the current 99-part plan and composed public
module name. No replay, load, time or worker cap was increased.

`verify-after-bot-enrollment-hybrid.log` records a queued full run cancelled
cleanly before acquiring its slot, so the dependency upgrade could be included
in the next snapshot. It is neither a verification failure nor a pass. The new
full run's verdict is still required; a passing dependency audit and scoped
checks alone do not establish release readiness.

The next full run, `verify-after-atlas-pong-integration.log`, passed the audit
and stopped at the stale Lingui catalog after seven tasks passed. Extraction
and compilation refresh the committed English `.po`; compiled `messages.ts`
remains generated and ignored. `pong-catalog-literal-red.log` pins three exact
Pong lookup ids against the old catalog: all return their opaque ids. The
refreshed catalog passes the app shared package's three tasks in
`pong-catalog-quality.log`, and all four freshness/spec/ownership/regression
tasks pass in `pong-after-catalog-policy-gates.log`. The registered regression
is `pong-copy-missing-lingui-catalog`. No source-text fallback is used by the
lookup regression. A further full gate is still required.

`verify-after-pong-catalog.log` captures the next isolated full run. It completed
generation and the current audit, then reached the existing 600-second run
deadline during a cold `verify:models:10:11` task. It exited 124 and retained
completed task caches and diagnostics. No failing assertion was reported before
the deadline; this is still an incomplete full-gate verdict. The time, proof,
replay and worker limits remain unchanged. It predates the matched hybrid
changes above, which require their own current full verdict.

The following remain required before the brief is complete:

1. Execute the natural matched completion/rematch journey in the production-like
   browser, complete confirmation-modal journeys and continuous-specific history
   coverage, and finish
   the remaining population/fallback policy and recovery verification.
2. Complete capability-aware shared behavior coverage and continuous counterparts
   of the offered lifecycle policies. The registries and common/turn/simulation
   suite planning are now wired; never give Pong fake turn fixtures.
3. Production-like browser recovery and a hosted Durable Object rehearsal;
   duplicate-owner/device behavior and complete hybrid capability conformance.
   Custom, matched and local latest-published-state recovery now have bounded
   storage contracts and repeated-crash properties. Local command rebasing and
   spectator delivery also have current probes.
4. Product Gherkin, Quint and glossary, audited spec-only commits, deterministic
   product-level adverse-network campaigns and full local/online end-to-end journeys.
5. Validate performance across target hosts and devices, including socket,
   storage and rendering costs. The [in-process performance profile](#in-process-performance-profile)
   now measures simulation CPU and room JSON traffic. Bounded deterministic
   failure records travel through the existing root error traces; see
   [failure reproduction](#failure-reproduction).
6. Readiness evidence, automated responsive visual verification, the full current
   `bun verify` gate and appropriate deeper verification, and a reviewable PR.

## Matched room handover

The displayed SQL game already rejected a room with another match identity or
an older checkpoint. Live execution metadata and the presentation connection
did not share that check. `matched-simulation-room-handover` pins both the
previous-match/rematch case and an older checkpoint of the same match. The
public room selector now gates the displayed game, execution metadata and
presentation readiness/generation together. Until the new room catches up,
controls stay stale rather than adopting the previous match's generation.

`matched-room-handover-red.log` records three failing checks, including a
property shrunk to revision zero followed by one; that literal case is pinned.
`matched-room-handover-quality.log` records all three affected package tasks
passing, and `pong-after-room-handover.log` records 61 passing Pong checks.
This mechanical handover coverage does not establish the remaining natural
matched completion/rematch journeys or unclean authority-loss recovery.

## Natural matched Pong journey

`specs/journeys/pong-game.feature` follows fresh accounts through the real Pong
search, natural score-target victory and UI rematch. It uses the existing
`JourneyHost` in both runners. The host now supplies elapsed time explicitly:
the harness advances virtual time and the live adapter uses its injected wall
timer. The game-owned court reader is shared with the local Pong specifications.

Alice follows the displayed ball with her offered paddle slider; Bob guides his
own away from it. No result, winning position, move, clock choice or replacement
room is injected. Both people must see Alice's finished target-score victory
before Bob offers and Alice accepts the rematch. The new game must have another
identity, swapped assigned controls, zero scores, active play and the same target
score on both devices. The existing live cleanup retires the unfinished rematch
and closes both spaces.

`pong-journey-undefined-red.log` records the missing journey step, and
`pong-journey-bound-second.log` records the complete journey passing in the
simulated product. `pong-journey-quality.log` records six passing package
unit/type/lint tasks, while `pong-journey-type-lint.log` also covers the live
product adapter. `pong-journey-bound-policy-current.log` records passing strict
spec and ownership gates. Full-context execution is recorded separately.
This is not a live-browser, rating/history completeness or full-gate claim.

`runtime-after-pong-journey.log` records 126 passing runtime/journey checks,
including the existing turn-game journeys and the new Pong flow.
`pong-after-journey-reader.log` records all 61 Pong checks passing with the
shared court reader. Both runs completed without assertion failures; no
verification budget or replay depth changed.

## Input acknowledgment timing

The replica records submission-to-authoritative-acknowledgment durations on its
own injected client clock. `game.simulation.input.ack.duration` aggregates those
durations in seconds with only the existing finite game-mode dimension. It
includes delivery, authoritative processing and snapshot cadence; it is not
pure network RTT or server processing duration. No timestamp is sent over the
wire or subtracted from a different machine's clock.

Retention is bounded to the prediction capacity for each controlled side.
Cumulative acknowledgments release and measure each tracked input once; unknown
acknowledgments do not fabricate samples. Reset, epoch change and pause discard
old timing. Invalid or backward clock readings never emit negative durations.
The public timing contract checks translation of the client clock, cumulative
delivery, independent sides and bounded retention through the existing property
runner. The actual Pong replica pins the literal 37 → 100 ms input/acknowledgment
case and checks all three lifecycle fences.

`input-ack-timing-red.log` records the missing 63 ms sample.
`input-ack-framework-quality.log` records three passing framework tasks;
`input-ack-client-static.log` records six passing consumer type/lint tasks.
`input-ack-timing-quality.log` includes all new replica checks passing, but an
existing replay property exceeded its unchanged five-second limit during the
combined test/lint run. In the subsequent separate test run,
`input-ack-pong-serial.log`, all 16 Pong code checks pass; the same replay
property takes 2.35 seconds. No input budget, assertion, retry configuration or
time limit changed. Full verification remains required.

The queued full run for the preceding matched-journey checkpoint was cancelled
cleanly before admission (exit 130) so it could not snapshot changing source.
`verify-after-matched-pong-journey.log` is a queue/cancellation record, not a
full verdict. Another worktree's machine-wide verification lease was untouched.
Actions run `40115052693` on `0a5e588c2` also started no jobs because of the
Actions budget; its exact annotation is retained under `.cache/pong/`.

## Future-game checks

An Asteroids-like simulation can store any number of moving entities in its
state. The step and input contracts contain no ball, paddle, two-player, board,
collision or renderer assumptions. Its codec and interpolator can operate on
the whole entity collection; its own rules own physics and projectiles.

A board game with live timers can opt into fixed-step work for timers while
retaining its discrete turn commands. Optional simulation must compose with
the existing capabilities; registering a simulation must not replace the
game's other capabilities or create a second game identity. Registration accepts
that composition under one game identity. The mechanics-owned command capability
and custom/matched/local probes implement its shared execution paths. Broader
capability conformance and adverse-network verification remain required.

### Local hybrid commands

The custom-game screen now owns one simulation connection for both its board
and its commands. A local choice enters that controller's serial queue. The
controller records current live progress, then the ordinary local choice, in
the existing offline room queue. Only the revision caused by that checkpoint
is advanced; stale choices keep their original revision. No second transport,
local registry or simulation engine was added. Integer timestamps are derived
from the injected clock.

The literal counting-race regression advances seven 60 Hz ticks before an
offline turn. Previously, the saved distance stayed at zero; it now preserves
116.66666666666667, the accepted token, execution tick and original epoch.
A queued tick-ten input is still acknowledged and applied after the choice.
On reconnect, the server replays the checkpoint and choice to the same state.

Evidence under `.cache/pong/`:

- `hybrid-local-choice-red.log`: the fractional local-choice timestamp fails
  the existing payload schema.
- `hybrid-local-progress-red.log`: the saved distance is zero after seven ticks.
- `hybrid-local-final-quality.log`: all seven affected type/lint/test tasks pass.
- `pong-after-hybrid-local.log`: the whole Pong context passes all 52 checks.
- `hybrid-local-policy-gates.log`: all three strict spec, ownership and regression
  registration tasks pass.

The regressions are `hybrid-local-choice-loses-live-progress` and
`local-custom-choice-fractional-timestamp`. This does not establish the still
outstanding spectator relay, authority-loss recovery or complete hybrid suite.


### Draft checkpoint and trunk synchronization

The implementation checkpoint is `53d38f4f5`, published in draft
PR #227. Full-CI, complete
coverage and person-facing readiness claims remain unchecked while their
obligations are open. The user-provided implementation prompt remains untracked.

Current main initially conflicted with the draft and prevented Verify PR from
starting. The merge preserves main's batched matchmaking, due-clock checks,
outbox consumers, stricter private-setup UI and spec-part allocation, together
with Pong's live room ports, clockless choices, native bridge and continuous
controls. Clockless simulation projection remains eligible when there is no
turn-clock deadline. Fresh native peers use their requested shared policy seed;
registered peers retain their checkpoint.

Evidence under `.cache/pong/`:

- `merge-main-type-lint-second.log`: all eighteen affected type/lint tasks pass.
- `merge-main-unit-contracts.log`: all six affected unit/contract tasks pass.
- `merge-main-pong-context.log`: the complete Pong context passes 52 checks.
- `merge-main-synthetic-context.log`: the complete Synthetic Population context
  passes 59 checks.

The JUnit fixture's overlapping upstream/branch fields were reconciled to the
upstream typed fixture. Resolution paths pass whitespace checking. Generated
SQLite assets inherited from main are byte-identical to that parent and were
not patched. No new spec text was authored in this merge.

### Local court forwarding and close recovery

The existing custom room now forwards local play from its creator. A bounded
relay retains one current court and allocates no engine, timer or transport.
It validates the creator, input epoch, codec, command-owned fields and progress;
viewers cannot publish courts or send player inputs. Late viewers receive the
current court, missing connections preserve it, and return refreshes it through
the same room signal channel. Shared competitive play keeps its room authority.

The expanded local model exposed closing a controller without recording its
current pose. Waiting for that lost pose after reopening let the bot finish.
Local closure now records current progress once through the ordinary room queue
before releasing the controller. The literal trace is in the PR profile as
`pong-local-reopen-after-paddle-guidance`; the isolated kitchen-sink example
preserves tick three rather than restoring tick zero.

Evidence in `.cache/pong/`: `local-watch-product-second.log` passes all eight
viewing examples; `local-viewing-all-traces-fixed.log` passes all sixteen drawn
twelve-step traces, four model checks and that pinned regression;
`local-viewing-recovery-final-quality.log` passes eight affected type/lint/unit
tasks; `local-viewing-final-policy-gates.log` passes all three policy gates.
The full context before the close fix passes sixty checks in
`pong-after-local-viewing.log`. The current audit is
`@libs/pong-harness-ts/docs/PONG_LOCAL_WATCH_SPEC_AUDIT.md`.

### First Actions verdict

Verify PR run `40103944542` on merge checkpoint `93053b228` failed. Jobs that ran
exposed turn/clock specification entries selecting real Pong, including invented
`pong/5+0` and `pong/3d` choices. The existing capability traits now express those
contracts' genuine requirements. Common and continuous obligations remain
enrolled; complete continuous counterparts are still required. See
`@libs/games-harness-ts/docs/SIMULATION_SPECIFICATION_ENROLLMENT.md`.

The five affected turn/clock feature families ran 248 checks: 244 passed and
four old listener assertions expected a former sentence layout. The corrected
listener observer retains opponent, rating, actual clock and side checks; all
four eligible registrations pass in `matched-accessibility-listener-clock-green.log`.

Other Actions jobs never started. Their check-run annotation is exactly:
“The job was not started because an Actions budget is preventing further use.”
`ci-budget-annotation.json` records it. This external limit is separate from the
executable failures. No full CI pass, merge readiness or budget change is claimed.

### Seeded opening and record controls

The common creation contract exposed an unseeded expected opening for Pong.
`initialHarnessPosition` uses the declared simulation initializer with the real
session seed, preserving the ordinary turn-game initializer. The literal
`02ef41f0-b6e9-4c3e-86f9-d762b0ea8aba` opening serves right; the unseeded default
serves left. All other initial-state fields are still compared exactly.
`seeded-opening-product-green.log` passes all thirty creation checks;
`seeded-opening-quality-current.log` passes five type/lint/unit tasks, and
`seeded-opening-policy-gates.log` passes all three policy tasks. The regression
is `simulation-starting-position-uses-unseeded-fixture`.

Custom and matched record components now use actual registered turns to offer
move-list review controls. A custom game's history selector/statistics and a
finished matched game's record controls remain available. An unfinished game
without turns allocates no empty Moves section. Styling still comes entirely
from the existing design-system components.

`pong-after-move-list-cleanup.log` passes the whole Pong context (61 checks).
`pong-move-list-all-traces.log` passes all thirty-two traces of scoring/shared
control, eight model checks and three existing regressions (43 checks).
`pong-move-list-quality-current.log` passes eight type/lint/unit tasks;
`pong-move-list-final-policy-gates.log` passes four policy/freshness tasks.
`turn-game-review-after-cleanup.log` passes all seventy-four ordinary-game
review/history checks across the eligible production/kitchen-sink registrations.
The existing pinned inputs retain every prior field/action and add only the
new false availability field. The audit is
`@libs/pong-harness-ts/docs/PONG_MOVE_REVIEW_SPEC_AUDIT.md`.

### Latest full-gate attempts

The full local run on `f6f13592e` reached the unchanged 600-second deadline
during `@libs/games-harness-ts#verify:models:10:6`. It completed eleven tasks
before cancellation, with no reported assertion failure. The final exit is
124, not a passing verdict. Generation passed all eight tasks and fresh
dependency audit returned zero; completed caches and diagnostics were retained
in `verify-after-local-viewing-diagnostics.tar.gz`. This snapshot predates the
seeded-opening helper and record-control cleanup.

Actions run `40108754500` on that same pushed commit could not start its first
job. `ci-current-budget-annotation.json` records the exact Actions-budget
annotation quoted above. No manual rerun or resource-budget change was made.


## Authority recovery

Persistent custom and matched execution now saves each published court in one
replaceable `RoomStorage` value. It does not append physics ticks or snapshot
requests to the event/deduplication journals. The value is capped at one MiB
of UTF-8 JSON; a replacement compares the durable event tip transactionally.
Its exact durable anchor includes the game, command-owned position, execution
and controllers. A committed choice or changed round supersedes an older value.
Both the memory adapter and the existing Durable Object storage adapter implement
the port, and harness snapshots preserve the recovery bytes.

Hydration applies a validated recovery value through the existing trusted
checkpoint command before starting execution or recovering deadline effects.
Restart retains the tick, court and seeded random continuation, creates a new
execution generation, and drops queued controls and acknowledgments from the
old generation. A failed replacement publishes no unsaved court and terminates
from the last successfully published one. Custom and matched terminal behavior
continues through their existing policies.

The new one-MiB cap is below the SQLite-backed Durable Object combined key/value
limit documented by [Cloudflare](https://developers.cloudflare.com/durable-objects/platform/limits/).
The existing storage transaction API is documented in the
[Durable Object KV API](https://developers.cloudflare.com/durable-objects/api/legacy-kv-storage-api/).
No resource, binding, storage engine or infrastructure configuration changed.
An actual hosted rehearsal remains unverified while Actions cannot start jobs.

Literal red-first regressions restore published tick six instead of tick zero
in both custom and matched rooms. A second pair pins storage failure at tick
nine and retains the previously visible tick six instead of rewinding to zero.
The repeated-crash property varies the room mode and tick partitions. Additional
contracts preserve an accepted hybrid choice over a stale recovery value;
compare uninterrupted and restarted RNG continuation; reject stale writes;
retain prior bytes on oversized or interrupted writes; isolate snapshot aliases;
and apply identity erasure to the recovery value in the same transaction.

Evidence in `.cache/pong/`: `live-recovery-restart-red.log` and
`live-recovery-failed-publication-red.log` record the two failures before fixes.
`live-recovery-property-current.log` passes all 98 game-session checks;
`live-recovery-foundation-final.log` passes all four foundation test tasks;
`live-recovery-quality-final.log` passes eighteen affected type/lint tasks.
The broader dependent type pass exposed three remaining call sites, corrected
in `live-recovery-callsites-types.log` (three tasks pass).

The deeper Pong run also exposed a scoring-driver precondition: after a point,
the helper left the losing paddle at the far edge. Reopening repeatedly used
part of the next serve's travel time, and following the displayed ball no
longer caught it. The helper now guides both paddles to the middle during the
countdown through their actual sliders. It changes no physics, score, model or
winner oracle. The literal `pong-scoring-after-repeated-reopen` trace is pinned
in the PR profile; `pong-scoring-reopen-pin-red.log` reproduces it and
`pong-scoring-reopen-prepared.log` passes all six scoring checks. The next
whole-context run reached 106 passing checks and a second scoring-driver
failure on trace eight: following the delayed ball and avoiding its current
y could accidentally return later wall rebounds. The helper now projects
the landing from consecutive visible ball positions and drawn court bounds.
The literal `pong-scoring-after-long-rally` trace is also pinned; both regressions
and all seven bounded scoring checks pass in `pong-scoring-visible-landing.log`.
Neither change alters the model, its oracle or the game mechanics.
`pong-live-recovery-full-context.log` passes all 108 whole-context checks,
including every drawn trace and both new pins.
`live-recovery-current-units.log` passes all seven affected package test tasks;
`live-recovery-policy-gates.log` passes all four policy tasks;
`live-recovery-dependent-types-final.log` passes all 117 dependent type tasks;
`live-recovery-current-lint.log` passes all thirteen affected lint tasks.

This server recovery work does not establish local durability after an unclean
browser-process loss, duplicate-owner behavior, adverse-network campaigns,
performance budgets or a hosted recovery rehearsal. The full current Verify
gate is still required, along with the other open items above.


## Local authority recovery

Local execution now saves its published court through `ClientRoomStorage` and
the existing `RoomClient` persistence chain. Memory, web storage and the injected
KV adapter implement the same bounded live-value contract. Physics frames do
not become queued commands or committed log entries. The store compares the
durable tip, validates the same byte cap as server recovery and returns copies.
Resetting committed cache storage clears its live value without changing the
storage adapter’s queued choices; the existing room invalidation policy still
decides which choices may be replayed. No new storage service, transport, wall I/O or compatibility path was
introduced; every execution host now supplies persistent publication.

Startup reads recovery before launching the controller and applies it through
the existing creator-authorized local checkpoint command. The source anchor
must still match the restored optimistic choices. A later accepted hybrid choice
wins over older live bytes. Restart retains tick, court and seeded continuation,
creates a new execution generation, and drops old pending inputs/acknowledgments.
Graceful close still records current progress through the ordinary choice queue.

A slow local write holds the next wake on the controller's serial chain. It does
not expose an unsaved frame or accumulate a frame per waiting tick. A transient
recovery-read error starts no engine and preserves queued choices. Reopening can
retry the read without creating a choice; successful reads cannot clear failed
queue/log writes or allow a new live frame past unsaved choices. A blocked-write
regression also exposed publishing the earlier hybrid token after its choice
was accepted. Publication now revalidates the full source anchor before emitting
the saved frame; `simulation-published-frame-reverts-accepted-choice` pins the
literal `[0, 1, 1]` rollback. Presentation also waits for the first durable
publication before requesting snapshots from a restored local input epoch;
`local-simulation-refresh-before-recovery-ready` pins the earlier ready-before-
restore ordering. The generic
failure copy now directs the person to reopen, which is available both before
restoration and after a stopped game; rematch remains the normal ended-game
policy.

`local-simulation-process-loss-rewinds-court` copies actual serialized web-storage
bytes before cleanup, reproducing published tick six restoring as zero for both
a local bot and two seats. The frozen copy now restores six, retains an applied
input, drops a future old-generation input and continues with exactly the
uninterrupted RNG/state. A property varies mode and tick partitions across
repeated losses. Additional contracts cover stale hybrid recovery, pending-store
backpressure, failed-read retry, and all three client storage adapters. The
separate literal `client-live-recovery-read-error-blocks-retry` fixes a latched
read failure while retaining the unsaved-write fence.

The red evidence is `local-process-loss-red.log` (98 pass, two literal failures)
and `local-recovery-read-retry-red.log`. Current `local-recovery-retry-contracts.log`
passes both game-session and room-harness tasks (104 and 95 checks).
`local-recovery-choice-publication-red.log` records the later publication race;
`local-recovery-choice-publication-fixed.log` passes all 105 game-session checks.
`local-recovery-readiness-red.log` records readiness being true while recovery
is held; `local-recovery-readiness-fixed.log` passes the added readiness contract. Storage and
runtime tasks pass together in `local-recovery-storage-and-runtime.log`.
All logs are under `.cache/pong/`. The copy's mechanical detector returned no
findings in `local-recovery-ui-detect.json`; the message catalog was extracted
and compiled through the existing tasks. This is automated contract evidence,
not a browser-process-kill or hosted recovery verdict.

Full verification waits in an owned detached checkout at
`~/.cache/<namespace>/pong-verification-2b59d5985`, initially prepared from the
server-recovery checkpoint. Its Verify and nightly-random commands use the
normal machine-wide queue. A checkpoint refresh stops only owned queued workers
before changing that checkout, then installs and queues the complete new
checkpoint. Other worktrees' workers and lease are unchanged. Results belong
only to the exact checked-out commit; earlier checkpoints cannot establish a
full verdict for later changes.


Current local-recovery checkpoint evidence in `.cache/pong/`:

- `local-recovery-deeper-units.log`: all five affected test tasks pass at
  `PBT_NUM_RUNS=200`, including 106 game-session and 95 room-harness checks.
- `pong-after-local-durable-recovery.log`: all 108 whole-context checks pass,
  including every drawn trace and the existing pinned regressions.
- `local-recovery-dependent-types-final.log`: all 115 dependent type tasks pass.
- `local-recovery-lint-final.log`: all eight affected lint tasks pass.
- `local-recovery-policy-gates-final.log`: all five policy/catalog tasks pass.
- `local-recovery-ui-final-detect.json`: no mechanical findings for the two
  changed client modules. This is not responsive visual evidence.

The complete current Verify gate, hosted/browser recovery, duplicate-owner and
adverse-network work, full shared policy/journey coverage, telemetry and measured
performance/visual evidence remain required as listed above.

## Authoritative input-processing timing

`game.simulation.input.processing.duration` records seconds from receipt by the
authority's input handler to successful application in a committed simulation
tick. Both endpoints use the same injected authority clock. It includes input
validation and the wait for a due tick; it excludes transport before that handler
and snapshot publication afterward. Custom, matched and local authorities supply
the same metric adapter, with only the finite `game.mode` dimension. No client
timestamp, identity dimension or per-tick log/span is added.

The pure engine exposes committed ticks and their exact applied inputs. The
bounded receipt tracker accepts reordered arrivals and keeps each first accepted
receipt once. It does not derive samples from cumulative acknowledgments:
sequence two can apply before a previously queued sequence one, superseding that
older input. Rejected, duplicate, superseded and failed-step inputs produce no
sample. Pause, epoch replacement, disposal and driver failure discard timing
state; backward or invalid clock readings cannot fabricate a later duration.

`simulation-input-processing-latency-unreported` pins receipt at 7 ms and successful
application at 17 ms, before the next 50 ms snapshot is due. Its initial run in
`input-processing-red.log` had 106 passes and the missing 10 ms sample failure.
`input-processing-green.log` passes all 117 game-session checks. Further contracts
exercise reordered/duplicate delivery, supersession during catch-up, rejected
controls, pause/epoch fences and failed mechanics. A property varies authority
clock offsets, arrival order and the global retention bound. The tick observer
contract also checks committed state, failure atomicity and unsubscription.
`input-processing-deeper.log` passes the same 117 checks at `PBT_NUM_RUNS=200`;
`input-processing-static-final.log` passes package types and lint, and
`input-processing-dependent-types.log` passes all 35 dependent type tasks.
`input-processing-policy.log` passes goals, spec ownership and package naming.

This adds authority processing evidence; production failure artifacts and
measured performance remain open. Full Verify
and nightly-random runs from the preceding local-recovery checkpoint remain in
the normal machine-wide queue; they cannot establish a verdict for this change.

## Room heartbeat round-trip timing

The existing browser room transport now reports application-heartbeat round-trip
duration through its composition's metric adapter. Its clock and observer are
required ports, and every production and harness factory caller is migrated.
The contract, measurement boundary and bounded label policy are documented with
the [room adapters](../../../pkgs/room-root-harness-ts/README.md#entrypoints).
The ping/pong wire and heartbeat cadence stay the existing room protocol.

`room-heartbeat-round-trip-unreported` pins a foreground ping at 7 ms and its
pong at 32 ms. `room-round-trip-red.log` records the missing 25 ms sample.
`room-heartbeat-probe-postpones-timeout` pins a further probe at 4006 ms that used
to postpone the unanswered ping's 8007 ms deadline; its old implementation is
reproduced in `room-heartbeat-deadline-red.log`. Periodic and foreground probes
now share one outstanding ping, preserving both its timestamp and deadline.
Reconnect, close, disposal, malformed traffic, failed send and invalid clocks
have explicit transport contracts, including callbacks retained from an old
socket while a new connection is waiting for its own reply.

`room-round-trip-deeper-properties.log` passes all 15 adapter checks at
`PBT_NUM_RUNS=200`. Its two properties vary clock offset and partitions of
foreground probes: replies retain the original elapsed time, and missing replies
retire the original socket at its original deadline. All five affected test
tasks pass in `room-round-trip-affected-tests.log`. All 60 dependent type tasks
and eight affected lint tasks pass in `room-round-trip-dependent-types-final.log`
and `room-round-trip-lint-complete.log`; the later property module and manifest
also pass package types/lint in `room-round-trip-property-static.log`. Goals,
spec ownership and package naming pass in `room-round-trip-policy.log`.

The bounded whole-Pong run passes 63 checks in
`pong-after-authority-and-rtt.log`. The all-trace run is recorded separately in
`pong-after-authority-and-rtt-all-traces.log`: all 108 checks pass, including
every drawn trace and the pinned scoring regressions (88.26 s test body,
101.429 s task). These remain automated contract
and product-harness evidence, without a hosted network measurement, browser
performance result or full Verify verdict. The readiness matrix records the
heartbeat deadline regression; the broader Pong readiness gaps stay open.

## Prediction-error timing and replay

`game.simulation.prediction.error` records the chosen entity's normalized
distance from authoritative state at the same acknowledged input tick. Games
optionally supply `presentation.predictionError`; a game without prediction or
without that comparator emits no error sample. Pong compares only the chosen
paddle's center, divided by court height, and excludes a phase or point boundary.
The framework accepts only finite distances in `[0, 1]` and retains the existing
finite `game.mode` dimension. A perfect prediction records zero.

`InputPrediction` retains at most its existing input capacity of projected states,
keyed by input sequence and logical tick within the current epoch. Future
projections are refreshed when reconciliation rebases them. A sample needs an
accepted snapshot matching both its input acknowledgment and its tick; unmatched
ticks, expired controls, repeated acknowledgments and replaced epochs cannot
produce a sample. This deliberately leaves incomparable updates unmeasured rather
than comparing a future local paddle with an earlier authoritative paddle.

The implementation also fixes replay counting already elapsed movement twice.
`PredictionProjection` receives its logical `fromTick`; submission starts at the
preceding input, and replay starts at the new authoritative tick and then the
preceding remaining input. The replica computes the remaining duration from
those ticks, retaining its existing 100 ms displacement bound. There is no
stored duration from the older snapshot to replay again.

`simulation-prediction-error-unreported` pins a projection at center 430 and
authority at 410 at input tick 13: the error is `20 / 800 = 0.025`.
`prediction-error-red.log` records the missing sample (15 passes, one failure).
`simulation-prediction-rebase-repeats-elapsed-movement` pins authority tick 14,
center 410 and the future tick-16 input: only two ten-unit ticks remain, so the
projection must be 430. `prediction-rebase-elapsed-red.log` records the earlier
440 result (16 passes, one failure).

`prediction-error-deeper-contracts.log` passes 129 game-session checks and 21 Pong
checks at `PBT_NUM_RUNS=200`. The properties vary authority checkpoint partitions,
projection capacity, chosen paddle, authoritative positions and future input.
They verify that rebasing preserves the future logical position, expired/fenced
projections are unavailable, and future movement or the other paddle does not
inflate error. Contracts also cover normalization, absent optional capabilities,
zero error after a future projection rebases, and phase/point boundaries. The
readiness matrix includes the literal movement regression and its coverage.

`prediction-error-dependent-types.log` passes all 105 dependent type tasks;
`prediction-error-lint.log` passes the three affected lint tasks.
`prediction-error-turn-game-tests.log` passes all nine registration checks,
`prediction-error-client-tests.log` passes the available Pong client test task,
and `prediction-error-policy.log` passes goals, spec ownership and package naming.
`pong-after-prediction-error-all-traces.log` passes all 108 whole-context checks
with `QUINT_REPLAY_TRACES=all` (51.93 s test body, 61.021 s task). Full current
Verify and hosted/browser evidence remain required.

## Failure reproduction

`SimulationFailure` now carries the `simulation-step.v1` replay record through
the existing root error infrastructure. It contains execution options and seed,
the last committed tick/state/acknowledgments, and the literal queued human
inputs. A session also supplies a recognized position identifying its registered
mechanics and the bot sides/difficulties. This host context matters because bot
inputs are generated inside the step, after the human-input mailbox is captured.
Replay restores `before`, selects the recorded build's registered mechanics,
wraps its step with the saved bot recipe, enqueues the saved inputs and advances
one tick. The per-tick seeded stream reproduces both bot choices and mechanics
randomness without a journal of prior ticks.

The root [replay contract](../../../pkgs/observability-root-shared-ts/README.md#reproducible-failures)
bounds and validates the data before attaching it to an existing error trace.
It adds no per-tick span, report store or product API. Plain logger JSON does
not include the replay data; the trace does. Existing browser, room-authority,
`withSpan` and root diagnostic boundaries retain ordinary exception recording.
Local execution now forwards its original exception through the injected logger,
while preserving its recovery flag and saved game even if the logger throws.

Three literal regressions are pinned in the known-bug directory:
`simulation-failure-reproduction-lost-in-telemetry` (tick one, input four),
`simulation-failure-reproduction-loses-bot-context` (a medium bot on tick two),
and `local-simulation-failure-not-observed` (the original saved-game read error
`saved race temporarily unreadable`). Their red logs are
`failure-reproduction-red.log`, `failure-reproduction-bots-red.log` and
`framework-local-failure-red.log` under `.cache/pong/`.

`failure-reproduction-framework-final-tests.log` passes all eight affected test
tasks at `PBT_NUM_RUNS=200`. The real injected HTTP OTLP exporter preserves and
replays both one input and a full 256-input queue, including a record larger than
16 KiB. The bot regression reconstructs the registered step and reproduces the
same second-tick exception. Contract properties cover UTF8 limits and round trips;
examples cover sensitive fields, unsupported values, original causes, ordinary
logs, existing browser/authority boundaries and a throwing local diagnostic sink.
The client hook uses the framework's counting-race example, keeping private
framework APIs outside Pong. `failure-reproduction-framework-final-types.log`
passes all 114 dependent type tasks, and
`failure-reproduction-framework-final-lint.log` passes all ten affected lint tasks.
Goals, spec ownership and package naming pass in
`failure-reproduction-framework-final-policy.log`.
`pong-after-failure-reproduction-all-traces.log` passes all 108 whole-context
checks with `QUINT_REPLAY_TRACES=all` (57.08 s test body, 67.095 s task).
These automated in-process and exporter checks do not establish a hosted
production ingestion or full Verify verdict.

## Seeded live-network campaign

The framework's counting-race example now runs through its real custom-session
module, `RoomServer`, three `RoomClient`s and `connectCustomSimulation`, using
the existing room harness and root `defineSystem`/`defineAction` execution.
Its seeded network supplies a bounded 480 ms impairment window: mean latency
0–80 ms, jitter 0–40 ms, loss 0/10/30%, duplication 0/50/100%, reordering and
an optionally held spectator link. Both people use the normal replica controls;
one admitted viewer observes. Admission-policy suites remain separate.

The property checks unique processed control identities, real input processing,
valid controls, monotonic displayed race progress, fresh replicas and agreement
with authority. Liveness assumes that the finite impairment window ends, the
links heal and authority then pauses after 200 ms of healthy delivery, permitting
comparison at one stable checkpoint. It claims no convergence during a permanent
partition and no exact same-time presentation for a continuously moving court.
The scheduler and all delivery are virtual; happy-dom supplies the presentation
adapter's document lifecycle. No browser or external network is launched.

This campaign found `simulation-presentation-clock-rewinds-on-snapshot`. Its
literal seed 12912, 1 ms jitter, 10% loss, reordered frames and held viewer link
made displayed distance retreat from `550.0000000000001` to
`500.0000000000002`. `live-network-rewind-literal-red.log` reproduces that input
in 32.93 ms. Receiving a newer snapshot resets its observed age, which previously
could move the interpolation target backward. The replica now retains a
monotonic playback tick bounded by the latest authoritative tick, resetting it
with its execution/pause history. A long gap cannot reserve future playback.
There is no change to authoritative mechanics or snapshot cadence.

`live-network-rewind-green-contracts.log` passes all five affected test tasks at
`PBT_NUM_RUNS=200`, including the 200-seed campaign and pinned regression.
The isolated `simulation-replica-clock.test.ts` pins ticks 33 and 36, a 100 ms
packet age, the 550-to-500 rewind, a later long gap and a fresh execution.
`live-network-rewind-static.log` passes both packages' type and lint tasks.
`live-network-rewind-dependent-types.log` passes all 35 dependent type tasks,
and `live-network-rewind-policy.log` passes goals, spec ownership and package
naming. `pong-after-network-playback-all-traces.log` passes all 108 Pong checks
with `QUINT_REPLAY_TRACES=all` (46.54 s test body, 60.56 s task).
Product-level adverse-network journeys, physical Pong presentation measurements,
socket fidelity, hosted recovery and the full current gate remain required.

## In-process performance profile

`@libs/pong-harness-ts#bench` now joins the existing nightly performance group.
Its standalone `pong-profile.v1` JSON reports the registered engine with two
medium bots, a saturated 256-input mailbox, and actual custom-room wire traffic
with 0, 2 and 20 spectators. The admitted-session fixture is shared with the
counting-race network campaign; no framework imports Pong. Method, command and
limits are defined once in the [Pong harness README](../../../libs/pong-harness-ts/README.md#performance-profile).

`pong-profile-artifact-measurement.log` and the standalone
`pong-profile-artifact-measurement.json` under `.cache/pong/` record the completed
entry on Bun 1.4.3, macOS arm64, an M2 Max with 12 physical cores and 32 GiB RAM.
`pong-profile-machine-context.log` records that machine/load context; concurrent
verification was active. The final batch-mean timings, in microseconds per
operation, were:

| Workload | Median | p95 | p99 |
| --- | ---: | ---: | ---: |
| Engine tick, two medium bots, result check | 1.635 | 4.491 | 95.337 |
| Restore, 256 enqueues, one tick | 394.021 | 1804.333 | 4863.729 |

These are quantiles of 200 batch means, not individual-operation tail latency.
The preceding measurements' bot-tick medians were 1.266 and 2.590 µs; these local elapsed
timings vary with JIT/GC/load and are not deployment capacity claims.

Each ten-second virtual room window published 600 further ticks, delivered
20 snapshots per second to every peer, processed about 30 controls per second
per player, added seven durable lifecycle events and ended with a 1,850-byte
live recovery value. Measured JSON bytes per virtual second were:

| Spectators | Room uplink | Room downlink | Snapshot bytes per recipient |
| ---: | ---: | ---: | ---: |
| 0 | 18,041 | 31,115 | 14,516 |
| 2 | 18,041 | 62,230 | 14,516 |
| 20 | 18,041 | 342,285 | 14,517 |

The largest observed input and snapshot envelopes were 301 and 748 UTF8 bytes.
Room execution plus virtual scheduling and JSON accounting took 46.127, 46.032, 94.848 ms elapsed for those windows. The report retains process CPU separately;
it includes all process threads. No machine-dependent threshold gates a release.
Socket/TLS framing, remote persistence latency, rendering and target-device or
hosted limits remain unmeasured by this task.

`pong-profile-contracts-final.log` passes both affected test tasks at
`PBT_NUM_RUNS=200`, including the original seeded network regression after the
fixture extraction. `pong-profile-integrity-final.log` passes the Pong
test/type/lint tasks. The new contracts check UTF8 envelopes, repeated deliveries,
reset boundaries, actual input/tick progress and identical mechanics across
fanouts. Each broadcast's recorded bytes multiply by its recipient count;
independent rooms can differ by revision-number width. The profile refuses a
game that ends before the measurement window completes.

`pong-profile-complete-static.log` passes six affected type/lint tasks;
`pong-profile-dependent-types.log` passes all 11 dependent type tasks, and
`pong-profile-policy.log` passes goals, spec ownership and package naming.
`pong-profile-nightly-policy-tests.log` passes existing nightly/profile policy
checks. `pong-profile-artifact-static.log` passes the entry's final type/lint
checks, and the benchmark writes its standalone JSON through the existing
object-store adapter in the package's `.cache/performance/`. These measurements and contracts do not establish the full current gate.

## Verification after the network and profiling checkpoints

The frozen `5c5cc0688` full run acquired the machine slot and reached the unchanged
600-second deadline. `verify-frozen-network-playback.log` records exit 124 after
648.4 seconds including planning and cleanup. A games-harness model phase had
been active for 31 seconds; no assertion failure was printed. This is an
incomplete gate, not evidence of a stuck proof. Its 41,307,164-byte diagnostic
archive is preserved as `.cache/pong/verify-network-playback-diagnostics.tar.gz`.

The same checkpoint's nightly random group found an existing OpenSLO property
oracle defect with fresh seed `1269405076`, shrunk to `[144,144]`. The product
and its pinned threshold regression correctly fire at 144 bad events of 10,000
for a 99.9% objective and 14.4x threshold. The property's own float division
rounded below that threshold. Its expected result now uses the independent exact
integer boundary, with no change to product comparison, policy or threshold.

`burn-rate-property-float-oracle` registers the literal 144/144 pair and mixed
144/143, 143/144 cases in the PR suite. `alert-oracle-literal-red.log` reproduces
the contradictory oracle in 0.30 ms. `alert-oracle-green.log` passes all 98
OpenSLO tests with the actual failing seed and `PBT_NUM_RUNS=200`, plus types and
lint. `alert-oracle-policy.log` passes goals, spec ownership and package naming.
The older frozen nightly run still contains its original code and cannot prove
this fix; a fresh exact-commit verdict remains required.

That frozen nightly group ultimately exited 1 after 656.9 seconds: mutants
passed, while fresh-seed properties and determinism fuzz failed. The fuzz
failure was seed `1615826050` in the Bun host availability contract, where
`StartMatch({ whiteMs: 4000, blackMs: 4000 })` expected the old empty 204 send
response. The shared service returns a 200 `RoomServiceReceipt`; its availability,
disconnect and erase operations still return 204. The sibling socket/dedup
contract also retained the stale send expectation.

`room-host-service-tests-stale-send-status` pins that literal command. Both
contracts now assert 200, the accepted receipt and its authoritative clock/tally
state. The retry still must return tally one; the original pause/resume,
socket fanout, erasure and 204 control-operation assertions remain.
`bun-host-availability-red.log` reproduces the old send-status assertion.
`bun-host-receipt-green.log` passes all three Bun-host tests with the actual fuzz
seed, plus types and lint; `bun-host-receipt-policy.log` passes the three policy
tasks. No service implementation or response contract was changed to clear the
failure. The complete nightly diagnostics are retained in
`.cache/pong/verify-nightly-random-network-playback-diagnostics.tar.gz`.

## Pong delivery campaign checkpoint

The next technical campaign runs the registered Pong mechanics and production
presentation adapter against real room clients under seeded delay, jitter, loss,
duplication, reordering, held spectator frames and a returning player or viewer.
It starts from a valid rally prepared by the shared engine. Normal room recovery
reestablishes reliable metadata delivery after impairment. The assertions cover
own-seat controls, retroactive-input refusal, offline court retention, score
progress and agreement after guidance stops and authority pauses.

The pinned `pong-recovered-court-pause-not-observed` example exposed a shared
presentation gap: Alice retained a fresh running snapshot from an older input
generation after the authority paused. Signals can arrive before their durable
metadata or while the room is unsynced. The adapter now resets obsolete controls
and requests a current snapshot when the generation changes or synchronization
returns, retaining the last painted court during recovery. The counting-race
adapter contract pins both delivery windows and failed before the fix.

`recovery-invalidation-packages-final.log` passes all 12 type, lint and test tasks
across the client, shared framework, framework harness and Pong harness.
`pong-recovery-property-200.log` passes all 200 seeded Pong fault cases with
45,468 assertions; `recovery-invalidation-policy.log` passes all three policy
tasks. The literal seed-1 integration also passes. Every distinct presented court
is still checked; consecutive identical paints are recorded once. Profiling
identified validation/serialization cost, and this compaction reduced the
200-case runtime from about nine to six seconds on this machine. The new
integration property has an explicit 20-second runner timeout to accommodate
the nightly depth; its 250-virtual-millisecond convergence bound, generated case
count and state assertions are unchanged.

This closes the pinned delivery failure. Current full verification, scheduler
stall/teardown integration and the previously identified hosted/browser and
product-flow coverage remain outstanding.

## Seats, input policy, rounds and disconnection

Added for multi-participant real-time games; Pong keeps every default.

- **Two to four seats.** `assertGameSides` accepts 2–4 seats in the fixed
  order `white, black, red, blue`. Custom and matched simulation controllers,
  client seat filters, the execution's `missing` seats, match formation
  (`multiplayerSeatOwners`) and rematch rotation (`rotatedSeatOwners`) iterate
  the declared seats.
- **Input policy** (`RegisteredSimulation.input`). `held` (default) keeps
  Pong's coalesced, refreshed controls at a client-requested tick inside the
  lead window. `commands` sends each command once and in order. The message
  `tick` is only the latest authoritative tick the device saw; the authority
  assigns every accepted command to its next uncommitted tick in arrival
  order, refuses a basis newer than the committed tick or older than
  `maxAgeTicks`, and rate-limits beyond `maxPendingPerPlayer` waiting
  commands. Duplicates by sequence stay idempotent. The replica's bounded
  `SimulationCommandOutbox` never resends, releases commands on
  acknowledgment, a new round or a new epoch, and does not predict commands.
  Fairness is the arrival order at the authority; equal ticks resolve in ASCII
  seat order, so replay is deterministic for identical arrivals.
- **Round fence** (`RegisteredSimulation.rounds`). A command whose round is
  not the state's current round is refused at admission; games still ignore a
  mismatched round inside their own step.
- **Disconnection policy** (`RegisteredSimulation.disconnection`). `pause`
  (default) pauses the simulation for any absence. `continue` keeps the arena
  running: only the absent seat's waiting inputs are discarded (and counted as
  answered so a returning device stops waiting), present players keep their
  input epoch, and from the tick the absence began plus the grace period the
  pure `retire(state, side)` runs before and after every step while the seat
  stays away, so a step that begins a new round never publishes an away seat
  riding. Retirement depends on ticks only.
- **Absence deadline.** The persisted 30-second deadline runs for any absence
  of a paused game, but only when every controller of a continuing game is
  away. When it passes, a two-seat game is forfeited to the seat that stayed;
  any other absence abandons the game. More than two seats never forfeit
  everyone's game to one absence.
- **Lifecycle.** Contract tests repeat resign and rematch over a real room and
  assert exactly one owned simulation timer per running game and none after
  completion or disposal.
