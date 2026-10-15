# Room match recovery audit

Scope: the returning-player scenario in `specs/room/match-recovery.feature`.
Context: Room. Aggregate: `match-recovery.qnt`.

The scenario previously required both players to see the new result while
White's phone remained offline. This conflicts with the shared kernel's
connection definition and `match-clock.feature`'s rule "Whoever runs out of
time while offline sees the result once back online". The corrected example
uses the existing catalogued offline-duration and return steps. The four-second
clock and exact four-second expiry boundary remain; the assertion that both
players see Black win is unchanged.

Positive example: after four seconds offline, White returns and both see the
same accepted loss on time. Negative example: two seconds offline still leaves
two seconds, as the following scenario already requires. Nobody's individual
connection pauses the shared clock.

A0–A6: existing Room and shared-kernel vocabulary and named players only; no
new words, borrowed concepts, technical mechanism or sub-second duration.
B1–B17: one observable return, declarative established steps, five steps,
unchanged Rule, outcome and deadline. The new title states the visible outcome.
C1/C4: the existing `_connectionReturns` and `timePasses` transitions already
cover the exact deadline; `match-clock.feature` also retains its five-second
return case. C2: `invDisconnectedClockNeverRestarts` remains illustrated by this
case and the two-second non-expiry case. C3/C5/C6: no event or policy change;
the example now agrees with its model and the existing clock feature.
D1: no implementation details. D2–D6: all phrasings are already catalogued;
no step definition is changed in this spec commit. P1: specs and docs only.

Audit status is incomplete until the Room implementation and the global
recovery bindings and strict-duplicate findings pass the automated gate.
This report does not claim a green verification verdict.

Implementation evidence: the returning-player feature passes, as do all 128
drawn `match-recovery.qnt` traces (133 checks including invariants, action
coverage and repeat replay). All 24 test, type-check and lint tasks pass across
the eight affected room, adapter and application harness packages. The literal
four-second-bank/two-second-outage regression is also exercised through the
private Bun host boundary. Shared work is fenced explicitly before stopping;
individual client disconnection never invokes that boundary. The host signal's
scope and limits are documented in `pkgs/room-root-server/README.md`.
