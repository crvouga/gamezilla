# Spec audit — Pong bot choice, disclosure and recovery

Author review: zero blocking language/coverage findings; two B11 warnings.
Executable verdict: INCOMPLETE pending the new disclosure binding and the
existing finished-result observer repair. No implementation completion claimed.

Scope: choose-a-game, recognizing-synthetic-users and synthetic-user-continuity
features and models. Observatory policy is a separate aggregate and is unchanged
in this spec commit.

## Example mapping and vocabulary

Context: Synthetic Population. Games and account identification come from the
already published vocabulary. Battleship is an existing published game name;
person and connection borrow the kernel. No new terms or step phrasings.

| Aggregate | Event or command | Invariants | Examples |
| --- | --- | --- | --- |
| choose-a-game | startNextActivity | invOnlyOfferedGames, invLookingHasGame | four named offered games reach their queue |
| synthetic-user-continuity | reopenApp | invPersistentIdentity, invActivityRestored, invOngoingGamePreserved, invFinishedGamePreserved | available account and ongoing/finished games survive reopening; Pong joins the existing examples |
| recognizing-synthetic-users | openMultiplayer | invSyntheticRecognition, invPersonRecognition | Cedar is identified as automated, Bob never is |
| recognizing-synthetic-users | openMultiplayer offline | invOfflineKeepsIdentification | Bob keeps the identification and sees the missing connection |

Each invariant that cannot be broken by a person's command is illustrated at
the boundary where the app opens the game. Each Rule states its no-counter-example
reason. No new event module is published. Loss/return helpers affect one chosen
device while another can remain connected. Their bookkeeping is model-only.

Timing, packets, normalized controls, sampling and durable receipts are code
contracts; no technical details enter these specifications.

## Verification

| IDs | Evidence | Finding |
| --- | --- | --- |
| A0–A6 | All words resolve in the owning context, published lenders or kernel; Cedar is the named Synthetic User and Bob is a person | none |
| B1–B4 | Existing capability titles and stories; every scenario stays under its original Rule, with its existing counter-example explanation | none |
| B5–B10 | One event; Given facts; actual queue, identification and preserved game/account/result observations | none |
| B11 | Disclosure retains its game-specific setup in both outlines and the offline example; continuity retains per-rule setup | two warnings: keep context explicit beside each business case |
| B12–B17 | Game is a business dimension; at most four rows and five steps; no invented wording or quoted app copy | none |
| C1–C2 | Every public action and observable invariant is mapped above | none |
| C3 | No event module | not applicable |
| C4 | Opening/identification is idempotent online/offline; reopening guard allows a connected device; ongoing and finished recovery both covered | none |
| C5 | Pong/Battleship names are borrowed and published; Games owns the game; identity remains account-based | none |
| C6 | New disclosure model names openMultiplayer; existing choice/reopening commands remain unchanged | none |
| D1 | Product words and model data only | none |
| D2–D6 | Existing public harness bindings reused; new model binding intentionally pending | implementer handoff |
| P1–P3 | Spec-only commit; existing bindings run before additional implementation | evidence below |

The strict author gate reports only the new unbound disclosure model:
`.cache/pong/bot-policy-enrollment-author-final-gate.log`. The first draft's
connection-shape findings were repaired by specifying Bob's visible connection
availability and per-device loss/return; no verifier was weakened.

## Red and existing coverage

`.cache/pong/bot-policy-enrollment-first-examples.log` runs all seventeen
examples before further implementation: sixteen pass. The new chooser and
Pong disclosure/ongoing-recovery rows are already covered by actual definitions,
which is reported as existing coverage rather than manufacturing a failure.

The new finished-Pong example fails on its Then after the real game is completed
and reopened. The permanent victory is unchanged, but the announcement gains
`Your rating changed by +162.`. The observer must compare the actual game result,
reason and final position, rather than incidental rating copy. The example is
pinned with `pong-synthetic-finished-result-reopening`; its required known-bug
metadata accompanies this behavior-only commit in the implementation worktree.

The offline disclosure example is run separately before binding. Its evidence
is `.cache/pong/bot-policy-offline-disclosure-first.log`.

## Handoff

Bind disclosure to the same public identification reads as the feature, and
read the actual connection notice. Preserve account-based identification across
opening and connection loss; do not copy the model's expected flags.

Repair the result observer without weakening permanent-result checks: compare
original game, actual outcome/reason and final game position. Then run the entire
context, all drawn model traces, bounded proofs and strict/ownership gates.
