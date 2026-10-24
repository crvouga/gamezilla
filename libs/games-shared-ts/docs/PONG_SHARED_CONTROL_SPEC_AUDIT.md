# Spec audit — shared Pong guidance — 2026-10-24

Verdict: PASS for authoring handoff (one B16 warning). Undefined steps and the
unbound new model are the implementer's handoff. No product, trace replay,
bounded proof or release verdict is claimed here.

## Gate and language

`.cache/pong/shared-control-spec-handoff.log` reports only undefined steps and
the unbound `pong-shared-control` model. The aggregate shape, glossary mapping
and published borrows pass. An earlier draft put “Pong” between “left” and
“paddle,” losing the existing compound term; the final wording uses “Pong's
left paddle.” An ordinary-word collision with another context's “control”
was removed by saying “guide their paddles.” No glossary exemption was added.

A0–A6: Pong, court, paddle, ball and guidance resolve in the Pong glossary.
Person, device and connection are kernel terms. The published Matchmaking
term “pair people up” and Spaces terms “space” and “join” are borrowed
directly, with the downstream relationships recorded in the context map.
No new term was invented and no unpublished Games word was borrowed.

## Per feature

`specs/pong/pong-shared-control.feature`: zero blocking findings.

- B1–B3: a capability title, one job story, every example under a rule.
- B4: guidance has allowed and foreign-paddle examples; seeing play has a
  late-arrival and a refused-guidance example; missing connections have
  suspension and recovery examples. The two stated no-counter-example rules
  promise that a person without a paddle does not stop the players and that
  an offline device keeps its earlier court.
- B5–B10: one choice or event per example, factual setup, outcomes visible on
  the court or in the offered paddles, and reasons in every refusal. Names
  belong to the cast and no app copy is quoted.
- B11–B15: all examples depend on the paired-Pong Background; the movement
  outline's six rows cover every transition between middle and both court
  edges. The two connection outlines vary which player loses the connection.
  Existing connection and space-joining phrasings are reused. No new tag.
- B16 warn at line 61: the recovery outline has six steps including its
  Background. Keeping the moved paddle, connection loss, return, shared court
  and restored assignment together is one recovery promise.
- B17/D1: no formula, pixel value, timing budget, transport detail, code name
  or stored row appears in the feature. Tick ordering, stale-input rejection,
  input leases, serialization and authority restart belong to code tests.

## Coverage — pong shared control

The aggregate follows an unfinished paired game with Alice on Left, Bob on
Right and Carol in Alice's space without a paddle. It models guidance and
connection changes, not scoring, victory, rematches or abandoning a game.
Those remain required elsewhere in the full implementation.

| ID | Obligation | Evidence | Status |
| --- | --- | --- | --- |
| C1 | `guidePaddle` succeeds for an assigned paddle | feature:10,30 | Covered |
| C1 | `loseConnection` is observed | feature:51,76 | Covered |
| C1 | `connectionReturns` restores guidance | feature:61 | Covered |
| C2 | `invCourt` | feature:10, all six movement rows | Covered |
| C2 | `invSharedCourt` | feature:10,30,37,61 | Covered |
| C2 | `invOfflineCourt` | feature:85, while Alice actually moves | Covered |
| C2 | `invOwnControls` | feature:25,43,51,61,76 | Covered |
| C2 | `invRefusedControl` | feature:25,43 | Covered |
| C2 | `invGameShown` | feature:61,85 | Covered |
| C3 | Owned domain events | Pong declares no `events.qnt` | Not applicable |
| C4 | Middle → upper, upper → middle | feature:10, rows 1–2 | Covered |
| C4 | Middle → lower, lower → middle | feature:10, rows 3–4 | Covered |
| C4 | Upper → lower, lower → upper | feature:10, rows 5–6 | Covered |
| C4 | Assigned guidance on the other side | feature:30 | Covered |
| C4 | Other player's paddle → unchanged, guidance not offered | feature:25 | Covered |
| C4 | No assigned paddle → unchanged, guidance not offered | feature:43 | Covered |
| C4 | Missing either player connection → no offered paddles | feature:51, both rows | Covered |
| C4 | Returning either player → own assignment restored | feature:61, both rows | Covered |
| C4 | Carol's missing connection → players retain assignment | feature:76 | Covered |
| C4 | Offline court → last-known court while players move | feature:85 | Covered |
| C4 | Connection events have no illegal rows | guards require the connection to change; these are world events | Model-only |
| C5 | Pairing gives each person their paddle | Background:6 and feature:10,30 | Covered |
| C5 | Joining the space reveals its current Pong court | feature:37 | Covered |
| C5 | Kernel connection changes preserve the offline court and recover | feature:51,61,76,85 | Covered |
| C6 | All When terms resolve to own or published upstream commands/events | `guidePaddle`, connection actions, Spaces `join` | Covered |

Repeated guidance to the place already reached is a valid idempotent choice;
the guide action has no guard excluding a court location. `_positions`,
`_lastCourt`, `_beforePositions`, `_refused` and `_show` are the model's
bookkeeping. The rule is checked through each person's visible court and
offered paddles, without asking people about that bookkeeping.

## Steps and handoff

D2–D6: the new steps and model are intentionally not bound at this authoring
handoff. Implement through the owning public harness actions and reads;
selectors and gestures belong below the bindings. Reuse the existing paddle
guidance phrase for both local and separate-device observations, extending its
decided values to the right paddle rather than adding a synonym.

P1–P2: only specification text, glossary, context map and this report belong
in the spec commit. P3: run every new example to an undefined-step failure
before adding bodies, then obtain a failing observable check before wiring
the live matched presenter. Run all Pong specs and relevant common Games
contracts after implementation. Refresh replay plans and prove all bound
actions reachable; do not trim traces or time budgets to make the model pass.
