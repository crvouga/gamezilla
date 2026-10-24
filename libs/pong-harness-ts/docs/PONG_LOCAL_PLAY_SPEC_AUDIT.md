# Pong local-play spec audit

Verdict: **PASS for local play**. No wording, coverage or binding finding remains.
The ten expanded examples and all sixteen model traces pass through the actual
Pong opener. This is local-play evidence, not a completed online integration.

Scope: `pong-local-play.feature`, `pong-local-play.qnt`, their Pong glossary
entries, the Games publications they borrow and the context-map relationships.

## Feature verifications

| Verification | Evidence |
| --- | --- |
| A0, A5, D1 | People share one device, play a bot, start, finish, lose or regain their connection and reopen the app. There are no transport, storage or timing mechanisms in the prose. |
| A1, A2 | Pong, local play, the local Pong start, paddles and victory are Pong terms. Game, custom game, under way and bot are borrowed published Games terms. Person, device, the app and connection come from the kernel. No avoid-list synonym is used. |
| A3 | The person's brief explicitly requests starting local Pong, two people on one device, a bot, no connection dependency, completion and reopening. The qualified local-start name describes that supplied action. No new role or product policy is invented. |
| A4 | Games publishes under way and bot; Pong borrows both. Journeys borrows the newly published bot term it already uses. Both relationships are declared in the context map. Generic start and ready words remain unpublished. No model imports another context's aggregate. |
| A6 | Alice, Pong and the connection are the subjects. Bob is the other local person, not an invented account. |
| B1, B2 | The title names playing Pong on one device without a connection. The description gives one situation, motivation and outcome. |
| B3, B4 | All examples belong to four rules. Each rule states why no counter-example exists: local play needs nobody else's availability or agreement. |
| B5–B10 | Each example has one event, factual preconditions and observable outcomes. Titles name outcomes. No app copy, procedures, placeholder data or internal counts appear. |
| B11 | No Background hides a precondition from an example. |
| B12, B13 | The opponent outline has two business cases: Bob and a bot. Connection outlines each cover ready, under-way and finished games. No outline exceeds three rows. |
| B14 | Connection loss, connection return and reopening reuse the platform's catalogued wording. New phrases distinguish the local game's stage and its available paddles from the ball's countdown and scoring stages. |
| B15, B16 | Only the required domain tag appears. Every expanded example has at most five steps. |
| B17 | Each outcome is a game that remains visible, its visible stage or which paddles the person can guide. Simulation tick ordering, persistence formats and protocol failures remain code verifications. |

## Coverage: pong-local-play.qnt

| Kind | Model name or transition | Evidence | Status |
| --- | --- | --- | --- |
| command | startLocalPong | Offline-start outline, both opponent rows | covered |
| world event | loseConnection | Losing-connection outline, all three stages | covered |
| world event | connectionReturns | Getting-connection-back outline, all three stages | covered |
| world event | finishLocalPong | Bot finishes offline; person finishes in the scoring feature | covered |
| command | reopenApp | Before-start example here; countdown, in-play and finished examples in pong-scoring.feature | covered |
| invariant | invLocalAvailability | Both connection outlines and before-start reopening | covered |
| invariant | invLocalPaddles | Offline-start rows distinguish both local paddles from only Alice's paddle against a bot | covered |
| invariant | invFinishedPaddles | Finished bot game cannot keep taking paddle guidance, with its finished state as the reason | covered |
| transition | ready → playing | Offline-start outline | covered |
| transition | playing → finished | Bot completion here; final point in the scoring feature | covered |
| transition | each stage → itself on connection loss | Losing-connection outline | covered |
| transition | each stage → itself on connection return | Getting-connection-back outline | covered |
| transition | each stage → itself on reopening | Ready here; under way and finished in the scoring feature | covered |
| illegal command | start after start or finish | Starting is no longer offered; this model's start command applies to the ready game. Modified-device refusals belong to the shared Games start contract. | model-only |
| illegal world event | finish before start or after finish | No playing ball can finish such a game; finishLocalPong is guarded by playing. | model-only |
| illegal world event | losing an already missing connection or regaining one already present | There is no new connection change; these are world-event guards. | model-only |
| published events | none | Pong publishes no events. | not applicable |
| downstream policies | Games → Pong | Games publishes no events; the borrowed concepts describe this local game's start, progress and opponent. | covered |
| unmapped When | none | Every event maps to one of the five public actions. | covered |

The model follows availability and guidance only. It does not duplicate Pong
physics or scoring. A ready local game has no enabled paddle, a game under way
has its locally assigned paddles, and a finished one accepts no more guidance.

## Steps and process

`/tmp/pong-local-red.log`: all ten examples fail on the undefined local-Pong
precondition, without composition, import, fixture or setup failures. This was
observed before local step bodies or the binding were written.

`/tmp/pong-local-model-gate.log`: the owning package's model verification passes.
`/tmp/pong-local-spec-gate.log`: the strict gate reports only the undefined
local-play steps and the missing new binding, the allowed implementation handoff.
Spec input manifests were regenerated. There are no remaining wording,
ownership, glossary or cross-context findings in that gate.

The contract was committed separately as `891995898`. The subsequent binding
names all five public actions plus init and reads the visible game stage,
opponent kind, court availability and enabled paddle controls. Its actions use
the shared custom-game flow, native start control and actual human paddle
inputs. It never injects a winner or gives Alice control of the bot's paddle.
Steps contain only public harness calls, predetermined parameter translations,
virtual time and assertions. Each package entry discovers its modules. There
are no selectors, SQL, stored-state reads, skips, retries or wall timers in the
steps or binding (D2–D6).

The whole Pong context passes twenty-eight checks, including eighteen expanded
scenarios and both product model replays: `/tmp/pong-complete-context.log`.
Every one of the local-play model's sixteen traces also passes:
`/tmp/pong-local-all-traces.log`. Latest type and lint checks pass in
`/tmp/pong-local-quality.log`. The bound strict gate is green in
`/tmp/pong-local-bound-spec-gate.log`; ownership is green in
`/tmp/pong-current-ownership.log`. No full `bun verify` verdict is claimed.

This covers local play only. Shared custom play, matchmaking, spectators,
reconnection authority and the remaining Pong mechanics still need their full
contracts and implementation.
