# Battleship traceability

Where each requirement of the Battleship specification (`BS-*`, `P-*` and
the mandatory scenario groups) is owned and proven. Shared behaviour is
owned once by the framework and proven by its shared specifications and
suites, which run for Battleship because it registers (`<scenario>
[Battleship]`); only Battleship's own rules, board and bots live in its
packages. The executable sources are the authority; this table points at
them and restates none.

Abbreviations:

- **Rules tests** — `libs/battleship-shared/tests/` (`placement`, `combat`,
  `properties`, `bots`, `game`), written against an independent oracle
  (`battleship-oracle.ts`), never the resolver.
- **BS features** — `specs/battleship/*.feature`, `battleship-fleet-setup.qnt` and `battleship-play.qnt`,
  bound in `libs/battleship-harness/tests/steps` and `tests/quint`.
- **Shared specs** — `specs/games/*`, bound in `libs/games-harness/tests`.
- **Laws** — `libs/game-session-harness/src/game-rules-laws.ts` and
  `game-capability-laws.ts`, run by `libs/games-harness/tests/conformance/rules`.
- **Privacy suites** — `libs/games-harness/tests/conformance/custom-games/private-setup-privacy.test.ts`
  and `…/matchmaking/private-setup-privacy.test.ts`.
- **Room contract** — `pkgs/room-root-harness/tests/private-events.contract.test.ts`.

## Ownership

| Owner | Holds |
| --- | --- |
| Framework (`@pkgs/turn-game-shared`, `@libs/game-session-*`, `@libs/game-matchmaking-*`, `@libs/spaces-*`) | registration, the game's choices, custom games, matchmaking, readiness, clocks, results, rematches, history, review, ratings, bots' lifecycle, the setup phase and its deadline, the shared screens |
| Private-information capability (`GameRules.setup`, `RoomModule.audience`, `chess_multiplayer_setups`, `rowImage.publish` honoured by the server) | authority-only resolution, withholding private events per connection, owner-only setups, the viewer's own setup on boards, bot observation (public position only) |
| Product policy (`@libs/permissions`, spaces, profile) | identity, guests, entitlements, space roles, denials, account deletion and export |
| Battleship (`libs/battleship-*`) | fleet geometry and placement, shots, hits, misses, sinking, victory, its labels and record, its setup board and battle board, its bots and automation, its known fleets and victory |

## Framework-change ledger

| Change | Missing contract or defect it answers | Game-independent shape | Existing games | Shared verification |
| --- | --- | --- | --- | --- |
| Private room events (`4d95ef1df`) | a room broadcast every event to everyone it served; no way to keep a setup to one person | `RoomModule.audience`; `RoomEventWithheld` at the same sequence on commit, welcome and replay | no module has an audience unless a registered game has private setups: one shared frame, unchanged | room contract (including a leak the check catches), viewer-aware convergence |
| Private setups in the rules and custom games (`0d9f4c7ae`) | positions were the whole state, shared with the space; devices predicted outcomes; solo games ran on the device | `GameRules.setup` (accept, random, resolve); `GameCommandContext.authority`; ready with setup; bot setups at start; never solo | rules without `setup` take the old paths (`publicAction` returns the proposal); puzzles refused only with setups | `game-session-shared/tests/private-setup.test.ts`, laws, privacy suites |
| Matched-game setup phase (`e4e13632b`, `3697a91c0`, `8b3181cef`) | matched rows synced to both people and watchers; no setup phase or deadline | `chess_multiplayer_setups` (owner-only), `setup_ready`, `SETUP_MS`, `chooseMultiplayerSetup`; the server fanout honours `rowImage.publish`; `chess.setup.chosen` telemetry | `setup_ready` is `null` and ignored for every other game | `game-matchmaking-shared/tests/private-setup.test.ts`, `telemetry.test.ts`, matched privacy suite, `matched-game-private-setup.feature` |
| Shared screens (`ed7394343`) | boards had no viewer; no setup surface | `GameBoardProps.setup`, `GamePresentation.SetupBoard`, the setup sections of the custom-game and matched screens | other boards ignore `setup`; history faces the first side as before | the private-setup features, `battleship-accessibility.feature` |
| Conformance (`e968d3b37`, `478eacf79`, `beeae459b`) | the laws called `play` with proposals; drivers readied without setups; no game-independent consumer | `playedRules`, `fixtures.setups`, `GameAutomation.arrange`, traits `a private setup` / `every position public` / `a seven-move victory`, the secret pick consumer | the laws are unchanged for public games; three specifications now name the traits they always assumed | the matrix, the isolated composition, faulty private-setup consumers |
| Offline move against a bot waits (`d58dd3af7`) | the decided policy: no secret-dependent result shown before the room answers | a waiting move, shown as waiting, played when the connection returns | games played on the device alone are unchanged | `custom-game-private-setup.feature` |

## Requirements

| Requirement | Owner | Proven by |
| --- | --- | --- |
| BS-001 first-class game, BS-002 shared infrastructure | framework | registration in `GAME_DEFINITIONS`, `GAME_CLIENT_DEFINITIONS`, `HARNESS_GAMES`; enrollment and matrix tests (`libs/games-harness/tests/game-enrollment.test.ts`, `game-conformance-matrix.test.ts`); `import-game-implementation.grit` |
| BS-003 deterministic, independent rules | Battleship | rules tests (P-016); `battleship-shared` has no I/O and no framework screens |
| BS-004, BS-100 canonical hidden state vs authorized view | private-information capability | positions are public by construction (laws: "no position or label it shows spells out a setup"); setups only at the authority |
| BS-005 authoritative fairness | private-information capability | `resolve` runs only where `authority` is true (custom) or on the server (matched); a forged public action is refused (`private-setup.test.ts` in both packages) |
| BS-006, BS-212 historical stability | Battleship + framework | versioned positions `bs:1:`; durable names unchanged; records read back (`battleship-record.test.ts`, record laws) |
| BS-010…BS-020 board and fleet | Battleship | rules tests (placement, random fleets, canonical fleets); `battleship-fleet-placement.feature` |
| BS-030, BS-032, BS-043, BS-128, BS-144 setup phase, independent preparation, start | framework | `custom-game-private-setup.feature`, `matched-game-private-setup.feature`, `battleship-start.feature`, `private-setup.qnt` |
| BS-031, BS-045, BS-105, BS-142 private placement | private-information capability | privacy suites; the setup board's arrangement never leaves the device until ready; `battleship-hidden-fleets.feature` |
| BS-033…BS-038, BS-221…BS-223 manual and random placement, rotation, refusal | Battleship (board) | `battleship-fleet-placement.feature`, `battleship-fleet-setup.qnt` (`invFleetLegal`, `invRejection`), `libs/battleship-client/tests/setup-board.test.tsx` |
| BS-039, BS-040, BS-041, BS-224 readiness, validation, locking | framework | private-setup features (incomplete refused; ready locks; changes refused while ready; P-026); `battleship-fleet-setup.qnt` (`invReadyFleet`, `invOffline`) |
| BS-042 unready | framework | custom games: withdrawing readiness unlocks; matched games offer no readiness to withdraw (a chosen setup is final) |
| BS-044, BS-165 first shooter | framework | the first side shoots first (`battleship-start.feature`, `game-turns.feature`); matched colours by the existing balance policy |
| BS-046, BS-148, BS-240 interruption and reconnection | framework | `custom-game-connection`, `-interruption`, `matched-game-recovery`, `-interruption` features [Battleship]; privacy suites read the catch-up sent to a reconnecting connection |
| BS-050…BS-061, BS-070…BS-082, BS-090…BS-093 turns, shots, sinking, victory | Battleship | rules tests and properties; `battleship-shots`, `battleship-sinking` features; `battleship-play.qnt` |
| BS-094…BS-099, BS-266 resignation, timeout, abandonment, cancellation, finality | framework | `custom-game-completion`, `-clock`, `-away`, `matched-game-abort`, `-results`, `-over` features [Battleship]; the setup deadline aborts with no result |
| BS-101…BS-104, BS-106, BS-109, BS-112, BS-116, BS-117, BS-154 visibility, serialization, noninterference | private-information capability | privacy suites (room history per connection, every device row, noninterference across worlds), room contract, `battleship-hidden-fleets.feature` |
| BS-107 spectators | framework | watchers receive neither setup (privacy suites, `matched-game-private-setup.feature`) |
| BS-108, BS-150, BS-251, BS-255 unauthorized access | product policy + capability | room refuses non-participants (`custom-game-access.dmn`, `custom-game-readiness.feature`); matched commands require the participant; queries read the actor's own setups only |
| BS-110 error privacy | capability | refusals are fixed reasons; "A refused move reveals nothing of the other private setup" |
| BS-111, BS-279 telemetry | capability | no mutation arguments in server event tables; `chess.setup.chosen` names readiness only (`telemetry.test.ts`) |
| BS-113, BS-184 bot information | Battleship + capability | `GameBots.choose` takes the public position only; noninterference test in `bots.test.ts` |
| BS-114, BS-115, BS-206, BS-207, BS-208 history and post-match privacy | framework | history review shows the viewer's own setup and the public shots only (`custom-game-private-setup.feature` history scenarios, `matched-game-private-setup.feature` review scenarios) |
| BS-118 administrative access | product | only the trusted server reads room state (`handleRoomService` read); no administrative screen shows setups |
| BS-120…BS-123, BS-125…BS-127, BS-129…BS-131 custom games | framework | every `custom-game-*.feature` [Battleship]; bots, rematch and invitation features |
| BS-124, BS-243 local shared-device play | — | not offered: the platform has no shared-device mode for two people, and a game with private setups is never played on one device alone |
| BS-140, BS-141, BS-143, BS-145…BS-147, BS-149, BS-151…BS-153 rooms, sync, races, duplicates, stale actions | framework | `game-turns`, `custom-game-*`, `matched-game-turns`, `-ownership` features and `match-authority` suite [Battleship] (repeated request, stale revision, concurrent requests) |
| BS-160…BS-168, BS-170 matchmaking | framework | `finding-an-opponent*` features, `matched-game*` models and suites [Battleship]; queues by clock namespace `battleship/` |
| BS-169 bot fallback | — | not applicable: the platform has no matchmaking bot fallback |
| BS-171, BS-211 ratings and statistics | framework | ratings per speed in Battleship's namespace (`matched-game-ratings.feature`); `game-history.feature` statistics [Battleship] |
| BS-180…BS-183, BS-185…BS-194 bots | Battleship + framework | `bots.test.ts` (legal unique shots, follow-up, bounded strength ordering, termination, determinism); `battleship-bots.feature`; bot lifecycle shared (`custom-game-control` holds for public games; bot wakes and cleanup in `custom-game-effects`) |
| BS-200…BS-205, BS-209, BS-210, BS-213 history and replay | framework | `game-history.feature`, `matched-game-record`, `-review` features [Battleship]; record laws; replay is read-only |
| BS-220, BS-225…BS-233, BS-244 layout and boards | Battleship (boards) + framework (screens) | `battleship-accessibility.feature`, `libs/battleship-client/tests/board.test.tsx` |
| BS-234…BS-239 responsive and accessible | Battleship (boards) | `battleship-accessibility.feature` (keyboard placement and shots, listening, marks not by colour, reduced motion); `CellGridBoard`, `PairedPanels` tests |
| BS-241 pending actions | framework | a shot shows aiming until the room answers; a move without a connection waits (`custom-game-private-setup.feature`) |
| BS-242 help | Battleship | `instructions` of `battleshipGameClient` |
| BS-250, BS-252…BS-254, BS-256 permissions | product policy | `chooseMultiplayerSetup` is the matched-game play permission (`mutation-actions.ts`); every shared access specification [Battleship] |
| BS-260…BS-265 clocks | framework | `custom-game-clock`, `matched-game-clock`, `-daily-clock` features [Battleship]; the setup deadline (`SETUP_MS`) |
| BS-270…BS-278 observability and health | framework + Battleship | lifecycle telemetry (created, setup chosen, started, completed, aborted); `battleship-health.feature` (`@synthetic`, bound in `apps/product`); `specs/journeys/battleship-game.feature` |

## Properties

| Property | Proven by |
| --- | --- |
| P-001 bounds, P-002 completeness, P-003 occupancy, P-004 contiguity, P-005 non-overlap | rules tests (placement), random-fleet property |
| P-006 placement immutability | ready locks (private-setup features); `resolve` reads the setup chosen at readiness; a matched setup is final |
| P-007 shot uniqueness, P-008 alternation, P-010 hit, P-011 miss, P-012 sinking, P-013 victory, P-014 finality, P-015 monotonicity, P-016 determinism, P-017 replay, P-025 symmetry | rules properties against the independent oracle; `battleship-play.qnt` invariants |
| P-009 rejection immutability | rules tests; "the Battleship boards and turn are unchanged" scenarios; shared refusal scenarios |
| P-018 match isolation | rematches have new ids and no setups (private-setup tests and features) |
| P-019 retry safety, P-020 concurrency | room command-id dedup; matched request receipts and owner lock (`match-authority` suite) |
| P-021 recovery equivalence | catch-up from the room log; recovery and interruption features |
| P-022 private-view correctness, P-023 noninterference | privacy suites |
| P-024 bot fairness | bots receive the public position only; `bots.test.ts` noninterference |
| P-026 readiness validity | readiness needs a complete setup (`private-setup.qnt` `invPlayNeedsReady`, `battleship-fleet-setup.qnt` `invReadyFleet`, features) |
| P-027 public-result consistency | shared custom-game and matched-game convergence; `battleship-shots.feature` (both see the result) |
| P-028 information monotonicity | public positions only grow; laws (replay) |
| P-029 historical authorization | history and review scenarios of the private-setup features |
| P-030 lifecycle integrity | `private-setup.qnt`, `battleship-fleet-setup.qnt`, `battleship-play.qnt`, the custom-game and matched-game models |
