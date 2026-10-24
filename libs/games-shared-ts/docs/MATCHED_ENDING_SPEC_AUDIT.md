# Spec audit — matched games without turns — 2026-10-24

Verdict: PASS for authoring handoff (two B16 warnings). Undefined new steps
and the unbound ending model are the implementer's handoff. No product or
release verdict is claimed.

## Gate and language

`.cache/pong/matched-ending-spec-handoff.log` runs strict duplicate checking.
The remaining findings are undefined new steps and the unbound
`matched-game-ending` model. The initial draft omitted the kernel connection
cases; those are now included, with no model-profile exemption. No conflict
markers are present.

A0–A6: all domain words resolve in Games or the kernel. Abort, resign, under
way, result, over, turn, opponent, finding an opponent, victory and matched
game keep their existing meanings. Under way now explicitly covers a
matched game, with both first moves remaining the boundary in games with
turns. Games without turns use their own beginning of play. No term is
added, no avoid-list synonym is introduced, and no unpublished foreign
language is borrowed. Only the existing form “gets under way” and public
model names are added to existing entries. The cast is Alice and Bob.

## Per feature

`specs/games/matched-game-without-turns.feature`: zero blocking findings.

- B1–B3: one capability, one job story, every example under one of four rules.
- B4: early aborts and accepted resignations have both boundary refusals;
  lasting results have repeated commands and unavailable ending choices;
  the connection rule has offline refusals and accepted-result recovery.
- B5–B10: one event per example, factual setup, visible result or offered
  choice, and reasons on refusals. Opening finding an opponent is used
  only to observe which choices and last-known game are then available.
- B11–B15: every example needs the without-turns Background. Outlines vary
  the two people, the winner, or the person attempting a terminal command;
  the largest has six rows. Existing abort, resign, result, offline,
  connection-return and opening phrases are reused. “New matched game”
  reuses the existing Given rather than inventing another initial setup.
- B16 warn at lines 130 and 142: each outline has six steps including its
  Background. Both need the existing game, the missing connection, one
  attempted choice, its reason and the unchanged unfinished game.
- B17/D1: no timer, tick, storage detail, renderer, package or transport
  appears in the contract. Timing, scheduling, duplicate command receipts,
  authorization and durable progress remain code checks.

`specs/games/matched-game-abort.feature`: zero blocking findings in the
three changed rule qualifications. All fifteen examples and every boundary
are unchanged. The qualifications say that first moves belong to games
with turns. The timed first-move aggregate is not generalized with fake
moves or zero clocks; its clocks, draw/rematch, account and turn policies
remain in their existing models and features.

## Coverage — matched game ending

The aggregate begins with two already-paired people and follows only
beginning play, aborting, resigning, missing connections and return. It does
not own pairing, clocks, moves, draw offers, rematches, ratings, account
deletion or space membership. Those policies retain their existing
aggregates. Terminal outcomes here are aborted, Alice's victory and Bob's
victory; each has explicit attempted-command rows.

| ID | Obligation | Evidence | Status |
| --- | --- | --- | --- |
| C1 | `playBegins` | feature:20, visible replacement of abort by resignation | Covered |
| C1 | `abortGame` | feature:10, both people | Covered |
| C1 | `resignGame` | feature:39, both people and both winners | Covered |
| C1 | `loseConnection` | feature:124 | Covered |
| C1 | `connectionReturns` | feature:154, both people | Covered |
| C2 | `invSharedResult` | feature:10,39,154 | Covered |
| C2 | `invAbortBoundary` | feature:10,20,26,108 | Covered |
| C2 | `invResignBoundary` | feature:20,39,49,108 | Covered |
| C2 | `invLastingResult` | feature:62,72,83,96 | Covered |
| C2 | `invOfflineView` | feature:164, opponent's accepted resignation while offline | Covered |
| C2 | `invRefusal` | feature:26,49,72,83,130,142 | Covered |
| C3 | Owned domain events | Games declares no `events.qnt` | Not applicable |
| C4 | Before play → under way | feature:20 | Covered |
| C4 | Before play → aborted, either person | feature:10 | Covered |
| C4 | Before play → resignation refused, either person | feature:49 | Covered |
| C4 | Under way → abort refused, either person | feature:26 | Covered |
| C4 | Under way → opponent wins, either person | feature:39 | Covered |
| C4 | Aborted → unchanged on another abort, either person | feature:62 | Covered |
| C4 | Aborted → resignation refused, either person | feature:72 | Covered |
| C4 | Alice won → unchanged on either ending command, either person | feature:83,96, Alice rows | Covered |
| C4 | Bob won → unchanged on either ending command, either person | feature:83,96, Bob rows | Covered |
| C4 | Online → offline, result unchanged | feature:124,164 | Covered |
| C4 | Offline → online, agreed result shown | feature:154, both rows | Covered |
| C4 | Offline abort/resign → unchanged game | feature:130,142, both rows | Covered |
| C4 | Beginning play has no illegal person-attempt row | world event guarded until play begins; an over game cannot begin again | Model-only |
| C5 | Pairing supplies the two people and their sides | feature:11,27 and all given matched games | Covered |
| C5 | Kernel missing/returning connection preserves and restores the game | feature:124,130,142,154,164 | Covered |
| C6 | All When terms map to own actions or existing upstream vocabulary | abort, resign, under way, connection, finding an opponent | Covered |

The existing turn-based ending coverage is unchanged: before either move,
after only the first move, after both first moves, and over are all still
represented in `matched-game-abort.feature`. Its abort/resign transitions
remain the ones in `matched-game.qnt`; first-move expiry, repeated abort,
resigning an aborted game and unchanged ratings retain their examples.

## Steps and process

D2–D6: new phrases and model bindings are intentionally undefined at the
authoring handoff. The implementer must bind through the public framework
harness. Offered choices and results are read from what people see; no
invented moves, fixed clock choices or private Pong setup may stand in for
an actual game without turns.

P1–P2: the authoring change touches specifications, their existing glossary
and this report only. P3 requires an undefined-step red for all new examples,
then an observable failure of the offered ending choice before changing
the client. Existing turn-based examples must also pass after implementation.
Refresh the replay plan and part allocation through their generators, keep
all bound actions reachable, and replay every drawn trace when checking
connection recovery.
