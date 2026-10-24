# Spec audit — Synthetic Users playing Pong — 2026-10-24

Verdict: INCOMPLETE (new steps and model intentionally unbound). Author review
finds zero blocking language or coverage findings, with two warnings.

Scope: `specs/synthetic-population/playing-pong.feature`, `playing-pong.qnt`,
their glossary mappings and published-language metadata. Existing chooser,
disclosure and recovery contracts remain unchanged in this authoring change.

## Example mapping

Context: Synthetic Population. Aggregate: playing-pong.
Story: a person wants their automated opponent to keep playing their Pong game.
Command: `continueActivity` — activity, performed autonomously by a Synthetic User.
World: losing and regaining a connection, represented by private model helpers.
Events: this context publishes no event module.

R1: the ongoing game can reach a result with a connection. Positive: first
scenario. Negative: the offline scenario names the missing connection and
preserves the same ongoing game.
R2: returning permits the preserved game to continue. Positive: final scenario.
Its counter-example is R1's offline refusal.

No questions or new terms. Pong and game borrow their existing published owning
contexts. The existing multiplayer-result term remains borrowed from Chess.
Input cadence, validation, reaction quantization, stale inputs, legal moves and
worker scheduling are code contracts, not additional product vocabulary.

## Per feature

| Verification | Evidence | Findings |
| --- | --- | --- |
| A0, A5, D1 | Product words throughout prose and model headers | none |
| A1–A4 | Synthetic User/activity; published Games game; published Pong; kernel connection; existing multiplayer opponent/result | none |
| A6 | Cedar is the named Synthetic User from the first Given | none |
| B1–B3 | Capability title, one job story, every scenario under a Rule | none |
| B4 | R1 positive/refusal; R2 explicit counter-example reference | none |
| B5–B10 | One autonomous activity event; facts first; visible final result or connection refusal | none |
| B11 | Repeated ongoing-game Given is deliberately visible across both rules | warning: common Given could be a Background |
| B12–B13 | No outline; Cedar/Pong are concrete product data | none |
| B14 | Existing ongoing-game Given, offline/return kernel wording and same-game Then reused; new continue-activity event and result observation; executable gate reports only undefined steps/unbound model | none |
| B15–B17 | Domain tag only; scenarios have 4, 5 and 6 steps; no internal assertions | B16 warning: return setup plus explicit identity/result observations require six steps |
| D2–D6 | No new implementation in this authoring change | binding audit pending |
| P1–P2 | Spec-only commit required; implementation remains frozen during authoring | none |

## Coverage

| Kind | Element | Illustration | Verdict |
| --- | --- | --- | --- |
| command/world activity | continueActivity | all three scenarios | covered |
| invariant | invPersistentIdentity | first/final scenarios explicitly retain account and username | covered |
| invariant | invGamePreserved | offline scenario's explicit same-game outcome; result is for the original game | covered |
| invariant | invFinishedGamePreserved | first/final scenarios' finished result, existing finished-game recovery rule | covered |
| invariant | invOfflineKeepsActivity | offline scenario's ongoing same-game observation | covered |
| transition | Playing → Finished while connected | first and final scenarios | covered |
| transition | Playing → Playing offline | second scenario, visible refusal | covered |
| excluded | Finished continuing an ongoing game | No ongoing activity remains to perform; no offered command | model-only |
| world | connection loss/return in either status | private helpers retain identity/game/activity | model-only |
| policy | Games supplies game; Pong is offered | all three scenarios name Pong and read its real result | covered |

C1–C6: no missing row within this aggregate. Existing unrelated Observatory
commands are outside this aggregate; this change makes no completeness claim
for those commands. Final executable verdict and D2–D6 review follow binding.

## Handoff

Run all three examples undefined before binding. The Given must create a real,
fresh matched Pong game, without a turn fixture or fabricated clock. Continue
through the normal client controls; observe the original game and account and
the rendered ongoing/final result. Offline continuation must preserve that
game and expose the existing connection refusal. Replay the model against
those same exported harness actions and visible reads.

Author gate: `.cache/pong/synthetic-pong-author-audit.log` reports only the new
undefined steps and unbound model. Each example ran separately before binding:
`.cache/pong/synthetic-pong-undefined-{online,offline,return}.log`. The first
reaches the undefined When after its real fresh-Pong Given succeeds; the latter
two currently reach the undefined Cedar kernel-actor wording. Bind that actor
to the existing kernel actions; do not add duplicate connection steps.
