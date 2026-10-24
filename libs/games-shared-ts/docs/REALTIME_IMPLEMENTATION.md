# Real-time implementation

This is the implementation ledger for
[the Pong brief](../../../docs/GAMEZILLA_IMPLEMENT_PONG_PROMPT.md).
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
and score boundaries; latest-published-state recovery remains required.

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
integration also uses the real space module and authorizer. Full adverse-network
campaigns remain pending.

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

An optional `RoomModule.createLive` creates one owned execution controller. Normal
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
execution generation. The current implementation restores its last durable
boundary; preservation of the latest published tick across process loss still
needs a bounded durable snapshot design and verification.

`LocalSimulationSession` uses the same controller on the creator's device and
checkpoints through the existing offline custom-game queue. Only the creator of
a game involving no other account can submit those checkpoints. A second person
on the device is an explicit local seat with no account identity. Local bot and
two-seat controls have in-process room-client coverage, including preserving a
finished offline bot game on return. Local games are unrated. Transient streaming
to online spectators of a locally owned game is not wired yet.

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

This is framework and persistence evidence. Pong is now registered by the shared,
client and harness registries. Matched client presentation, real matchmaking
journeys and continuous inputs from the existing synthetic population remain
unfinished.

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
The scenarios also exercise the existing client mutation boundary; complete
confirmation-modal and natural completion/rematch journeys remain required.

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

1. Complete natural matched completion, confirmation-modal and rematch journeys,
   remaining continuous-specific history coverage, and finish
   the remaining population/fallback policy and recovery verification.
2. Complete capability-aware shared behavior coverage and continuous counterparts
   of the offered lifecycle policies. The registries and common/turn/simulation
   suite planning are now wired; never give Pong fake turn fixtures.
3. Recovery of the latest published tick after authority loss; duplicate-owner
   and device behavior; complete hybrid capability conformance. Custom, matched
   and local command rebasing and local spectator delivery have current probes.
4. Product Gherkin, Quint and glossary, audited spec-only commits, deterministic
   adverse-network campaigns and full local/online end-to-end journeys.
5. Finish telemetry for input latency, round-trip latency and prediction error;
   reproducible production failure artifacts; measure performance and bandwidth.
6. Readiness evidence, automated responsive visual verification, the full current
   `bun verify` gate and appropriate deeper verification, and a reviewable PR.

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
[PR #227](https://github.com/crvouga/gamezilla/pull/227). Full-CI, complete
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
